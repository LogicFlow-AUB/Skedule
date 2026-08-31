import PDFDocument from 'pdfkit';

import type { ScheduleDetail } from './schedules.service.js';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

// Match the Skedule in-app calendar (AIScheduler / SavedSchedules).
const COURSE_COLORS = [
  '#4338CA',
  '#059669',
  '#0284C7',
  '#7C3AED',
  '#D97706',
  '#10B981',
  '#F59E0B',
  '#DC2626',
];
const START_HOUR = 7; // 7 AM
const END_HOUR = 21; // 9 PM
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR);

function formatTime(time: string | null): string {
  if (!time) {
    return 'TBA';
  }

  const match = /^(\d{1,2}):(\d{2})/.exec(time.trim());

  if (!match?.[1] || !match[2]) {
    return time;
  }

  const hours = Number(match[1]);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;

  return `${displayHours}:${match[2]} ${period}`;
}

function formatDays(days: number[]): string {
  return days.length ? days.map((day) => DAY_LABELS[day] ?? '').join('/') : 'TBA';
}

/** Parses an "HH:MM" or "HHMM" time into minutes of the day, or null. */
function toMinutes(time: string | null): number | null {
  if (!time) {
    return null;
  }
  const compact = /^(\d{2})(\d{2})$/.exec(time.trim());
  const match = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  const hours = Number(compact?.[1] ?? match?.[1]);
  const minutes = Number(compact?.[2] ?? match?.[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours > 23 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
}

/** Renders a time like the site's hour label ("12 PM", "1 PM", "9 AM"). */
function formatHourLabel(hour: number): string {
  if (hour === 12) return '12 PM';
  if (hour > 12) return `${hour - 12} PM`;
  return `${hour} AM`;
}

type CalendarBlock = {
  day: number;
  startMinutes: number;
  endMinutes: number;
  code: string;
  section: string;
  room: string;
  color: string;
};

function assignCourseColors(schedule: ScheduleDetail): Map<number, string> {
  const colors = new Map<number, string>();
  let index = 0;
  for (const course of schedule.courses) {
    if (!colors.has(course.section.id)) {
      colors.set(course.section.id, COURSE_COLORS[index % COURSE_COLORS.length]!);
      index += 1;
    }
  }
  return colors;
}

/**
 * Builds the canonical weekly blocks, one per day per meeting, using the same
 * schedule/calendar data the frontend uses (the single source of truth).
 */
function buildCalendarBlocks(schedule: ScheduleDetail): CalendarBlock[] {
  const colors = assignCourseColors(schedule);
  const blocks: CalendarBlock[] = [];
  for (const course of schedule.courses) {
    const color = colors.get(course.section.id) ?? COURSE_COLORS[0]!;
    const baseRoom = course.section.room ?? '';
    const meetings = course.section.meetings;
    if (meetings.length > 0) {
      for (const meeting of meetings) {
        if (meeting.days.length === 0) continue;
        const start = meeting.startMinutes ?? toMinutes(meeting.startTime);
        const end = meeting.endMinutes ?? toMinutes(meeting.endTime);
        if (start === null || end === null) continue;
        const section = `${course.section.sectionNumber} ${meeting.meetingType ?? ''}`.trim();
        for (const day of meeting.days) {
          blocks.push({
            day,
            startMinutes: start,
            endMinutes: end,
            code: course.code ?? 'Unknown',
            section,
            room: [meeting.building, meeting.room].filter(Boolean).join(' ') || baseRoom,
            color,
          });
        }
      }
    } else {
      const start = course.section.startMinutes ?? toMinutes(course.section.startTime);
      const end = course.section.endMinutes ?? toMinutes(course.section.endTime);
      if (start === null || end === null) continue;
      for (const day of course.section.days) {
        blocks.push({
          day,
          startMinutes: start,
          endMinutes: end,
          code: course.code ?? 'Unknown',
          section: course.section.sectionNumber,
          room: baseRoom,
          color,
        });
      }
    }
  }
  return blocks;
}

/**
 * Draws a block of text (up to N lines, truncated with an ellipsis) inside a
 * rectangle, wrapping onto the given width. Returns the y position after the
 * last drawn line.
 */
function drawWrappedText(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  fontSize: number,
  color: string,
  lineHeight: number,
): number {
  doc.fontSize(fontSize).fillColor(color);
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return y;

  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (doc.widthOfString(candidate) > width && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  if (lines.length === 0) lines.push('');

  let cursor = y;
  for (let i = 0; i < lines.length; i++) {
    doc.text(lines[i]!, x, cursor, { width, height: lineHeight, ellipsis: true });
    cursor += lineHeight;
  }
  return cursor;
}

export async function generateSchedulePdf(schedule: ScheduleDetail): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 40, size: 'LETTER' });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  const done = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  const headerY = doc.y;
  doc.fontSize(20).text(schedule.name ?? 'My Schedule', { align: 'left' });
  doc
    .fontSize(10)
    .fillColor('#64748B')
    .text(`${schedule.courseCount} courses • ${schedule.totalCredits} credits`);
  if (schedule.notes) {
    doc.moveDown(0.25).fontSize(10).fillColor('#1E293B').text(schedule.notes);
  }

  // ────────────────────────── Page 1: Weekly Calendar ──────────────────────────
  const blocks = buildCalendarBlocks(schedule);
  const onDayBlocks = blocks.filter((block) => block.day >= 0 && block.day <= 4);

  // Fixed 7 AM – 9 PM axis matching the in-app calendar; scale to fill the page.
  const hourCount = HOURS.length;
  const gutterWidth = 42;
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const margin = doc.page.margins.top;
  const bottomMargin = doc.page.margins.bottom;

  const headingGap = 14;
  const gridTop = Math.max(headerY + 56, margin) + headingGap;
  const availableHeight = pageHeight - bottomMargin - gridTop - 12;
  const hourHeight = Math.max(22, availableHeight / hourCount);
  const gridBottom = gridTop + hourCount * hourHeight;

  const gridLeft = margin + gutterWidth;
  const gridRight = pageWidth - margin;
  const gridWidth = gridRight - gridLeft;
  const dayWidth = gridWidth / DAY_LABELS.length;

  // Day headers
  doc.fontSize(9).fillColor('#334155');
  for (let day = 0; day < DAY_LABELS.length; day++) {
    const label = schedule.days.includes(day) ? `${DAY_LABELS[day]} *` : DAY_LABELS[day]!;
    doc.text(label, gridLeft + day * dayWidth, gridTop - headingGap + 2, {
      width: dayWidth,
      align: 'center',
    });
  }

  // Horizontal hour lines + time labels
  doc.lineWidth(0.5);
  for (let i = 0; i <= hourCount; i++) {
    const y = gridTop + i * hourHeight;
    doc.moveTo(gridLeft, y).lineTo(gridRight, y).strokeColor('#E2E8F0').stroke();
    if (i < hourCount) {
      const hour = START_HOUR + i;
      doc
        .fontSize(8)
        .fillColor('#64748B')
        .text(formatHourLabel(hour), margin, y - 4, { width: gutterWidth - 6, align: 'right' });
    }
  }

  // Vertical day separators
  doc.lineWidth(0.5);
  for (let day = 0; day <= DAY_LABELS.length; day++) {
    const x = gridLeft + day * dayWidth;
    doc.moveTo(x, gridTop).lineTo(x, gridBottom).strokeColor('#E2E8F0').stroke();
  }

  // Course blocks (solid color, white code + room like the in-app calendar)
  const onDayMin = Math.min(...onDayBlocks.map((block) => block.startMinutes));
  const onDayMax = Math.max(...onDayBlocks.map((block) => block.endMinutes));
  const rangeStart = Math.min(onDayMin, START_HOUR * 60);
  const rangeEnd = Math.max(onDayMax, (START_HOUR + hourCount) * 60);

  for (const block of onDayBlocks) {
    const start = Math.max(block.startMinutes, rangeStart);
    const end = Math.min(block.endMinutes, rangeEnd);
    if (end <= start) continue;
    const top = gridTop + ((start - rangeStart) / 60) * hourHeight;
    const height = ((end - start) / 60) * hourHeight;
    const left = gridLeft + block.day * dayWidth + 1.5;
    const width = dayWidth - 3;

    doc
      .save()
      .rect(left, top, width, height)
      .fillColor(block.color)
      .fill()
      .restore();

    const innerX = left + 3;
    let innerY = top + 3;
    const innerWidth = width - 6;

    // Course code (bold, white)
    innerY = drawWrappedText(doc, block.code, innerX, innerY, innerWidth, 8, '#FFFFFF', 9) + 1;

    // Section when there is room
    if (height >= 34) {
      innerY = drawWrappedText(doc, block.section, innerX, innerY, innerWidth, 7, '#EAF0FF', 8) + 1;
    }

    // Room when there is room
    if (block.room && height >= 52) {
      drawWrappedText(doc, block.room, innerX, innerY, innerWidth, 7, '#DCE5FF', 8);
    }
  }

  if (schedule.courses.length === 0) {
    doc
      .fontSize(10)
      .fillColor('#94A3B8')
      .text('This schedule has no courses yet.', gridLeft, gridTop + 20);
  }

  // ────────────────────────── Page 2: Course List ──────────────────────────
  doc.addPage();

  doc.fontSize(16).fillColor('#0F172A').text('Course List');
  doc.moveDown(0.75);

  const columns = [
    { label: 'Course', width: 90 },
    { label: 'Title', width: 150 },
    { label: 'Section', width: 55 },
    { label: 'Days', width: 55 },
    { label: 'Time', width: 90 },
    { label: 'Room', width: 80 },
  ];

  const tableLeft = doc.page.margins.left;
  let y = doc.y;
  let x = tableLeft;

  doc.fontSize(9).fillColor('#0F172A');
  for (const column of columns) {
    doc.text(column.label, x, y, { width: column.width, continued: false });
    x += column.width;
  }

  y = doc.y + 4;
  doc
    .moveTo(tableLeft, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .strokeColor('#E2E8F0')
    .stroke();
  y += 8;

  doc.fontSize(9).fillColor('#374151');

  for (const course of schedule.courses) {
    const professor = course.professor
      ? `${course.professor.firstName} ${course.professor.lastName}`
      : null;
    const cells = [
      course.code ?? 'Unknown',
      course.title ?? '',
      course.section.sectionNumber,
      formatDays(course.section.days),
      `${formatTime(course.section.startTime)} - ${formatTime(course.section.endTime)}`,
      course.section.room ?? 'TBA',
    ];

    x = tableLeft;
    for (const [index, cell] of cells.entries()) {
      const width = columns[index]?.width ?? 80;
      doc.text(cell, x, y, { width });
      x += width;
    }

    y += 16;

    if (professor) {
      doc
        .fontSize(8)
        .fillColor('#94A3B8')
        .text(`Instructor: ${professor}`, tableLeft, y);
      doc.fontSize(9).fillColor('#374151');
      y += 14;
    }

    if (y > doc.page.height - doc.page.margins.bottom - 40) {
      doc.addPage();
      y = doc.page.margins.top;
    }
  }

  if (schedule.courses.length === 0) {
    doc
      .fontSize(10)
      .fillColor('#94A3B8')
      .text('This schedule has no courses yet.', tableLeft, y);
  }

  doc.end();

  return done;
}
