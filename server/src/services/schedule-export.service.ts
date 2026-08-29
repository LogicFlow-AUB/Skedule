import PDFDocument from 'pdfkit';

import type { ScheduleDetail } from './schedules.service.js';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

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

export async function generateSchedulePdf(schedule: ScheduleDetail): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 40, size: 'LETTER' });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  const done = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  doc.fontSize(20).text(schedule.name ?? 'My Schedule', { align: 'left' });
  doc
    .fontSize(10)
    .fillColor('#64748B')
    .text(`${schedule.courseCount} courses • ${schedule.totalCredits} credits`);

  if (schedule.notes) {
    doc.moveDown(0.5).fontSize(10).fillColor('#1E293B').text(schedule.notes);
  }

  doc.moveDown(1);

  const columns = [
    { label: 'Course', width: 90 },
    { label: 'Title', width: 150 },
    { label: 'Section', width: 55 },
    { label: 'Days', width: 55 },
    { label: 'Time', width: 90 },
    { label: 'Room', width: 80 },
  ];

  let y = doc.y;
  let x = doc.x;

  doc.fontSize(9).fillColor('#0F172A');
  for (const column of columns) {
    doc.text(column.label, x, y, { width: column.width, continued: false });
    x += column.width;
  }

  y = doc.y + 4;
  doc
    .moveTo(doc.page.margins.left, y)
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

    x = doc.page.margins.left;
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
        .text(`Instructor: ${professor}`, doc.page.margins.left, y);
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
      .text('This schedule has no courses yet.', doc.page.margins.left, y);
  }

  doc.end();

  return done;
}
