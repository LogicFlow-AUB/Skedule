/**
 * Database seed script.
 *
 * Run with:  npm run seed  (or: npx tsx src/db/seed.ts)
 *
 * Idempotent — safe to run multiple times. Creates auth users, profiles,
 * reviews, schedules, posts, friendships, events, activities, and
 * notifications. Skips catalog data (terms, courses, professors, sections)
 * that already exists in the database.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function insert(table: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return [];
  const { data, error } = await db.from(table).insert(rows).select();
  if (error) {
    // Ignore duplicate key errors
    if (error.code === '23505') return [];
    console.error(`  ✗ ${table}: ${error.message}`);
    return [];
  }
  return data ?? [];
}

async function count(table: string, match?: Record<string, unknown>): Promise<number> {
  let query = db.from(table).select('*', { count: 'exact', head: true });
  if (match) {
    for (const [k, v] of Object.entries(match)) {
      query = query.eq(k, v);
    }
  }
  const { count: c } = await query;
  return c ?? 0;
}

async function select(table: string, cols: string, match?: Record<string, unknown>) {
  let query = db.from(table).select(cols);
  if (match) {
    for (const [k, v] of Object.entries(match)) {
      query = query.eq(k, v);
    }
  }
  const { data } = await query;
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Auth users  (created via admin API so we get real UUIDs)
// ---------------------------------------------------------------------------

const TEST_PASSWORD = 'TestPass123!';

const authUsers = [
  { email: 'alice@mail.aub.edu', password: TEST_PASSWORD, firstName: 'Alice', lastName: 'Mansour' },
  { email: 'bob@mail.aub.edu', password: TEST_PASSWORD, firstName: 'Bob', lastName: 'Haddad' },
  { email: 'carol@mail.aub.edu', password: TEST_PASSWORD, firstName: 'Carol', lastName: 'Najem' },
  { email: 'dave@mail.aub.edu', password: TEST_PASSWORD, firstName: 'Dave', lastName: 'Fares' },
  { email: 'eve@mail.aub.edu', password: TEST_PASSWORD, firstName: 'Eve', lastName: 'Khalil' },
];

type AuthUserRecord = { id: string; email: string; firstName: string; lastName: string };
const createdUsers: AuthUserRecord[] = [];

async function createAuthUsers() {
  console.log('Creating auth users…');
  const existing = await db.auth.admin.listUsers();
  const existingByEmail = new Map(existing.data.users.map((u) => [u.email, u.id]));

  for (const u of authUsers) {
    const foundId = existingByEmail.get(u.email);
    if (foundId) {
      createdUsers.push({
        id: foundId,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
      });
      continue;
    }
    const { data, error } = await db.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { first_name: u.firstName, last_name: u.lastName },
    });
    if (error) {
      console.error(`  ✗ ${u.email}: ${error.message}`);
      continue;
    }
    console.log(`  ✓ ${u.email}`);
    createdUsers.push({
      id: data.user.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
    });
  }
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

const profileData = [
  { major: 'Computer Science', level: 'Senior' },
  { major: 'Electrical Engineering', level: 'Junior' },
  { major: 'Computer Science', level: 'Sophomore' },
  { major: 'Mathematics', level: 'Senior' },
  { major: 'Computer Science', level: 'Junior' },
];

async function createProfiles() {
  console.log('Creating user profiles…');
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < createdUsers.length; i++) {
    const u = createdUsers[i]!;
    const p = profileData[i]!;
    const existing = await count('users', { id: u.id });
    if (existing > 0) continue;
    rows.push({
      id: u.id,
      email: u.email,
      first_name: u.firstName,
      last_name: u.lastName,
      major: p.major,
      level: p.level,
      presence_status: i < 2 ? 'online' : 'offline',
    });
  }
  await insert('users', rows);
  console.log(`  ✓ ${rows.length} new profiles created`);
}

// ---------------------------------------------------------------------------
// Helper: find existing IDs
// ---------------------------------------------------------------------------

async function getExistingIds(table: string, match?: Record<string, unknown>): Promise<number[]> {
  const rows = (await select(table, 'id', match)) as unknown as { id: number }[];
  return rows.map((r) => r.id);
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

const courseComments = [
  'Great course, very informative.',
  'Challenging but rewarding.',
  'Could use more practical examples.',
  'One of the best courses I have taken.',
  'Hard workload but the professor explains well.',
  'Interesting material, fair exams.',
  'Would recommend to anyone interested in the field.',
  'Too much theory, not enough labs.',
];

const profComments = [
  'Excellent lecturer, really knows the material.',
  'Fair grading, available during office hours.',
  'Strict but teaches well.',
  'Makes complex topics easy to understand.',
  'Good at explaining but moves fast.',
];

async function createReviews() {
  console.log('Creating reviews…');
  const userIds = createdUsers.map((u) => u.id);

  // Only create reviews if none exist yet
  if ((await count('course_reviews')) > 0) {
    console.log('  (reviews already exist, skipping)');
    return;
  }

  const courseIds = (await getExistingIds('courses')).slice(0, 10);
  const profIds = (await getExistingIds('professors')).slice(0, 6);

  const courseReviewRows: Record<string, unknown>[] = [];
  const profReviewRows: Record<string, unknown>[] = [];

  for (let i = 0; i < userIds.length; i++) {
    const userId = userIds[i]!;
    // Each user reviews 2-3 courses
    for (let j = 0; j < Math.min(3, courseIds.length); j++) {
      const courseId = courseIds[(i + j) % courseIds.length]!;
      courseReviewRows.push({
        user_id: userId,
        course_id: courseId,
        rating: 3 + Math.floor(Math.random() * 3),
        difficulty: 2 + Math.floor(Math.random() * 4),
        workload: 2 + Math.floor(Math.random() * 4),
        would_retake: Math.random() > 0.3,
        comment: courseComments[Math.floor(Math.random() * courseComments.length)],
      });
    }
    // Each user reviews 1-2 professors
    for (let j = 0; j < Math.min(2, profIds.length); j++) {
      const profId = profIds[(i + j) % profIds.length]!;
      profReviewRows.push({
        user_id: userId,
        professor_id: profId,
        rating: 3 + Math.floor(Math.random() * 3),
        difficulty: 2 + Math.floor(Math.random() * 4),
        would_retake: Math.random() > 0.3,
        comment: profComments[Math.floor(Math.random() * profComments.length)],
      });
    }
  }

  await insert('course_reviews', courseReviewRows);
  await insert('professor_reviews', profReviewRows);
  console.log(
    `  ✓ ${courseReviewRows.length} course reviews, ${profReviewRows.length} professor reviews`,
  );
}

// ---------------------------------------------------------------------------
// Schedules + schedule_sections
// ---------------------------------------------------------------------------

async function createSchedules() {
  console.log('Creating schedules…');
  if ((await count('schedules')) > 0) {
    console.log('  (schedules already exist, skipping)');
    return;
  }

  const userIds = createdUsers.map((u) => u.id);
  const termIds = await getExistingIds('terms');
  const termId = termIds[0] ?? null;
  const sectionIds = (await getExistingIds('sections')).slice(0, 12);

  if (sectionIds.length === 0) {
    console.log('  (no sections found, skipping)');
    return;
  }

  const schedules = await insert('schedules', [
    { user_id: userIds[0], name: 'Fall 2025 Plan A', notes: 'Main schedule', term_id: termId },
    {
      user_id: userIds[0],
      name: 'Fall 2025 Plan B',
      notes: 'Alternative with lighter load',
      term_id: termId,
    },
    { user_id: userIds[1], name: 'My Fall Schedule', term_id: termId },
    {
      user_id: userIds[2],
      name: 'CS Senior Plan',
      notes: 'Trying to finish requirements',
      term_id: termId,
    },
  ]);

  const scheduleIds = schedules.map((s) => s.id as number);

  // Assign 3-4 sections per schedule
  const assignments: { schedule_id: number; section_id: number }[] = [];
  if (scheduleIds[0]) {
    for (let i = 0; i < Math.min(4, sectionIds.length); i++) {
      assignments.push({ schedule_id: scheduleIds[0], section_id: sectionIds[i]! });
    }
  }
  if (scheduleIds[1]) {
    for (let i = 2; i < Math.min(5, sectionIds.length); i++) {
      assignments.push({ schedule_id: scheduleIds[1], section_id: sectionIds[i]! });
    }
  }
  if (scheduleIds[2]) {
    for (let i = 0; i < Math.min(3, sectionIds.length); i++) {
      assignments.push({ schedule_id: scheduleIds[2], section_id: sectionIds[i + 6]! });
    }
  }
  if (scheduleIds[3]) {
    for (let i = 0; i < Math.min(3, sectionIds.length); i++) {
      assignments.push({ schedule_id: scheduleIds[3], section_id: sectionIds[i + 3]! });
    }
  }

  await insert('schedule_sections', assignments);
  console.log(`  ✓ ${schedules.length} schedules with ${assignments.length} section assignments`);
}

// ---------------------------------------------------------------------------
// Friendships
// ---------------------------------------------------------------------------

async function createFriendships() {
  console.log('Creating friendships…');
  if ((await count('friendships')) > 0) {
    console.log('  (friendships already exist, skipping)');
    return;
  }

  const ids = createdUsers.map((u) => u.id);
  if (ids.length < 3) return;

  await insert('friendships', [
    { user_id: ids[0], friend_id: ids[1], status: 'accepted' },
    { user_id: ids[0], friend_id: ids[2], status: 'accepted' },
    { user_id: ids[1], friend_id: ids[2], status: 'pending' },
    { user_id: ids[3], friend_id: ids[0], status: 'pending' },
  ]);
  console.log('  ✓ 4 friendships created');
}

// ---------------------------------------------------------------------------
// Posts, comments, likes, saves
// ---------------------------------------------------------------------------

async function createPosts() {
  console.log('Creating feed posts…');
  if ((await count('posts')) > 0) {
    console.log('  (posts already exist, skipping)');
    return;
  }

  const ids = createdUsers.map((u) => u.id);

  const posts = await insert('posts', [
    {
      user_id: ids[0],
      type: 'tip',
      content:
        'CS 330 with Prof. Khalil is amazing — her real-world examples make databases click.',
      tags: ['CS', 'databases'],
    },
    {
      user_id: ids[1],
      type: 'question',
      content: 'Has anyone taken CS 311 with Prof. Nasri? How hard are the exams?',
      tags: ['CS', 'algorithms'],
    },
    {
      user_id: ids[2],
      type: 'review',
      content: 'Just finished ECE 210 — Prof. Hajj is great but the labs take forever.',
      tags: ['ECE', 'signals'],
    },
    {
      user_id: ids[3],
      type: 'tip',
      content:
        'If you are struggling in Linear Algebra, try the MIT OCW problem sets. They help a lot.',
      tags: ['math', 'linear-algebra'],
    },
    {
      user_id: ids[4],
      type: 'schedule',
      content: 'Here is my optimized fall schedule — 15 credits, no overlaps!',
      tags: ['schedule', 'fall2025'],
    },
    {
      user_id: ids[0],
      type: 'question',
      content: 'What electives would you recommend for a CS senior interested in AI?',
      tags: ['CS', 'AI', 'advice'],
    },
  ]);

  const postIds = posts.map((p) => p.id as number);

  if (postIds[0]) {
    await insert('post_comments', [
      {
        post_id: postIds[0],
        user_id: ids[1],
        content: 'Agreed! Her project assignments are really well-designed too.',
      },
      {
        post_id: postIds[0],
        user_id: ids[2],
        content: 'I am taking it next semester, this makes me excited!',
      },
    ]);
    await insert('post_likes', [
      { post_id: postIds[0], user_id: ids[1] },
      { post_id: postIds[0], user_id: ids[2] },
      { post_id: postIds[0], user_id: ids[3] },
    ]);
  }
  if (postIds[1]) {
    await insert('post_comments', [
      {
        post_id: postIds[1],
        user_id: ids[0],
        content: 'The midterm was fair but the final was tough. Make sure you understand DP well.',
      },
    ]);
    await insert('post_likes', [{ post_id: postIds[1], user_id: ids[0] }]);
  }
  if (postIds[3]) {
    await insert('post_saves', [{ post_id: postIds[3], user_id: ids[0] }]);
  }

  console.log(`  ✓ ${posts.length} posts with comments, likes, and saves`);
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

async function createEvents() {
  console.log('Creating events…');
  if ((await count('events')) > 0) {
    console.log('  (events already exist, skipping)');
    return;
  }

  const termIds = await getExistingIds('terms');
  const termId = termIds[0] ?? null;
  const now = Date.now();

  await insert('events', [
    {
      title: 'Fall 2025 Registration Opens',
      type: 'registration',
      starts_at: new Date(now + 3 * 86400000).toISOString(),
      ends_at: new Date(now + 10 * 86400000).toISOString(),
      description: 'Course registration for Fall 2025 semester.',
      location: 'Online Portal',
      term_id: termId,
    },
    {
      title: 'CS Career Fair',
      type: 'social',
      starts_at: new Date(now + 14 * 86400000).toISOString(),
      ends_at: new Date(now + 14 * 86400000 + 4 * 3600000).toISOString(),
      description: 'Meet top tech employers.',
      location: 'Assembly Hall',
      term_id: termId,
    },
    {
      title: 'Midterm Break',
      type: 'academic',
      starts_at: new Date(now + 45 * 86400000).toISOString(),
      ends_at: new Date(now + 49 * 86400000).toISOString(),
      description: 'No classes during midterm break.',
      term_id: termId,
    },
    {
      title: 'Study Group: Algorithms',
      type: 'study',
      starts_at: new Date(now + 5 * 86400000).toISOString(),
      ends_at: new Date(now + 5 * 86400000 + 2 * 3600000).toISOString(),
      description: 'Weekly algorithms study session.',
      location: 'Library Room 204',
      term_id: termId,
    },
    {
      title: 'CS Department Seminar',
      type: 'academic',
      starts_at: new Date(now + 7 * 86400000).toISOString(),
      ends_at: new Date(now + 7 * 86400000 + Math.round(1.5 * 3600000)).toISOString(),
      description: 'Guest lecture on machine learning in healthcare.',
      location: 'Bechara Building 301',
      term_id: termId,
    },
  ]);
  console.log('  ✓ 5 events created');
}

async function createEventRsvps() {
  console.log('Creating event RSVPs…');
  if ((await count('event_rsvps')) > 0) {
    console.log('  (event_rsvps already exist, skipping)');
    return;
  }

  const ids = createdUsers.map((u) => u.id);
  const eventIds = await getExistingIds('events');

  if (eventIds.length === 0) {
    console.log('  (no events found, skipping)');
    return;
  }

  const rsvps: { event_id: number; user_id: string }[] = [];
  for (const eventId of eventIds.slice(0, 3)) {
    for (const userId of ids.slice(0, 3)) {
      rsvps.push({ event_id: eventId, user_id: userId });
    }
  }

  await insert('event_rsvps', rsvps);
  console.log(`  ✓ ${rsvps.length} event RSVPs created`);
}

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------

async function createActivities() {
  console.log('Creating activities…');
  if ((await count('activities')) > 0) {
    console.log('  (activities already exist, skipping)');
    return;
  }

  const ids = createdUsers.map((u) => u.id);
  await insert('activities', [
    {
      user_id: ids[0],
      actor_id: ids[0],
      type: 'schedule_created',
      message: 'You saved the schedule "Fall 2025 Plan A".',
      data: {},
    },
    {
      user_id: ids[0],
      actor_id: ids[0],
      type: 'course_review_created',
      message: 'You reviewed CS 214.',
      data: {},
    },
    {
      user_id: ids[0],
      actor_id: ids[1],
      type: 'friend_request_accepted',
      message: 'Bob Haddad accepted your friend request.',
      data: {},
    },
    {
      user_id: ids[1],
      actor_id: ids[1],
      type: 'post_created',
      message: 'You shared a new post.',
      data: {},
    },
    {
      user_id: ids[1],
      actor_id: ids[0],
      type: 'friend_request_sent',
      message: 'Alice Mansour sent you a friend request.',
      data: {},
    },
  ]);
  console.log('  ✓ 5 activities created');
}

// ---------------------------------------------------------------------------
// Notifications + preferences
// ---------------------------------------------------------------------------

async function createNotifications() {
  console.log('Creating notifications…');
  if ((await count('notifications')) > 0) {
    console.log('  (notifications already exist, skipping)');
    return;
  }

  const ids = createdUsers.map((u) => u.id);
  await insert('notifications', [
    {
      user_id: ids[1],
      type: 'friend_request_received',
      message: 'sent you a friend request.',
      actor_id: ids[3],
      data: {},
    },
    {
      user_id: ids[0],
      type: 'friend_request_accepted',
      message: 'accepted your friend request.',
      actor_id: ids[1],
      data: {},
    },
    {
      user_id: ids[0],
      type: 'post_liked',
      message: 'liked your post.',
      actor_id: ids[2],
      data: { postId: 1 },
    },
    {
      user_id: ids[0],
      type: 'post_commented',
      message: 'commented on your post.',
      actor_id: ids[1],
      data: { postId: 1 },
    },
    {
      user_id: ids[2],
      type: 'review_liked',
      message: 'liked your review.',
      actor_id: ids[0],
      data: { reviewId: 1 },
    },
  ]);
  console.log('  ✓ 5 notifications created');
}

async function createNotificationPreferences() {
  console.log('Creating notification preferences…');
  const rows = createdUsers.map((u) => ({ user_id: u.id }));
  await insert('notification_preferences', rows);
  console.log(`  ✓ preferences for ${rows.length} users`);
}

// ---------------------------------------------------------------------------
// Study groups + members
// ---------------------------------------------------------------------------

async function resolveCourseId(courseCode: string): Promise<number | null> {
  const parts = courseCode.trim().toUpperCase().replace(/\s+/g, ' ').split(' ');
  if (parts.length < 2) return null;
  const subject = parts.slice(0, -1).join(' ');
  const courseNumber = parts.at(-1) ?? '';
  const rows = await select('courses', 'id', {
    subject,
    course_number: courseNumber,
  });
  const first = rows[0] as { id?: number } | undefined;
  return first?.id ?? null;
}

async function createStudyGroups() {
  console.log('Creating study groups…');
  if ((await count('study_groups')) > 0) {
    console.log('  (study_groups already exist, skipping)');
    return;
  }

  const ids = createdUsers.map((u) => u.id);
  const [u0, u1, u2, u3] = ids;

  const definitions = [
    {
      name: 'CMPS 330 — HW 5',
      course_code: 'CMPS 330',
      description: 'Working through the database normalization homework together.',
      meeting_days: [1],
      start_time: '18:00:00',
      end_time: '19:00:00',
      location: 'Library Room 204',
      host_user_id: ids[0],
      max_members: 10,
    },
    {
      name: 'MATH 201 — Finals',
      course_code: 'MATH 201',
      description: 'Preparing for the calculus II final exam.',
      meeting_days: [0, 2],
      start_time: '17:00:00',
      end_time: '18:30:00',
      location: 'AUB Science Hall',
      host_user_id: ids[1],
      max_members: 15,
    },
    {
      name: 'CMPS 214 — Project',
      course_code: 'CMPS 214',
      description: 'Final project collaboration for Data Structures.',
      meeting_days: [2],
      start_time: '17:00:00',
      end_time: '18:00:00',
      location: 'Online (Zoom)',
      host_user_id: ids[2],
      max_members: 6,
    },
  ];

  const resolved = await Promise.all(
    definitions.map(async (definition) => ({
      ...definition,
      course_id: await resolveCourseId(definition.course_code),
    })),
  );

  const groups = await insert('study_groups', resolved);

  const groupIds = groups.map((g) => g.id as number);

  // Add members (owners are included so the member count reflects them).
  const members: { study_group_id: number; user_id: string }[] = [];
  const [g0, g1, g2] = groupIds;
  if (g0 && u0 && u1 && u2) {
    members.push({ study_group_id: g0, user_id: u0 });
    members.push({ study_group_id: g0, user_id: u1 });
    members.push({ study_group_id: g0, user_id: u2 });
  }
  if (g1 && u0 && u1 && u2 && u3) {
    members.push({ study_group_id: g1, user_id: u1 });
    members.push({ study_group_id: g1, user_id: u0 });
    members.push({ study_group_id: g1, user_id: u2 });
    members.push({ study_group_id: g1, user_id: u3 });
  }
  if (g2 && u2 && u0) {
    members.push({ study_group_id: g2, user_id: u2 });
    members.push({ study_group_id: g2, user_id: u0 });
  }

  await insert('study_group_members', members);
  console.log(`  ✓ ${groups.length} study groups with ${members.length} memberships`);
}

// ---------------------------------------------------------------------------
// Grade distributions
// ---------------------------------------------------------------------------

async function createGradeDistributions() {
  console.log('Creating grade distributions…');
  if ((await count('course_grade_distributions')) > 0) {
    console.log('  (already exist, skipping)');
    return;
  }

  const courseIds = (await getExistingIds('courses')).slice(0, 15);
  const termIds = await getExistingIds('terms');
  const termId = termIds[0] ?? null;
  const grades = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'F'];

  const rows: Record<string, unknown>[] = [];
  for (const courseId of courseIds) {
    let remaining = 100;
    for (let g = 0; g < grades.length; g++) {
      const isLast = g === grades.length - 1;
      const pct = isLast
        ? remaining
        : Math.max(2, Math.round(remaining * (0.05 + Math.random() * 0.2)));
      remaining -= pct;
      rows.push({
        course_id: courseId,
        term_id: termId,
        grade: grades[g],
        percentage: Math.max(0, pct),
      });
    }
  }

  await insert('course_grade_distributions', rows);
  console.log(`  ✓ distributions for ${courseIds.length} courses`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('\n🌱 Seeding database…\n');

  await createAuthUsers();

  if (createdUsers.length === 0) {
    console.error('No auth users available — aborting seed.');
    process.exit(1);
  }

  await createProfiles();
  await createReviews();
  await createSchedules();
  await createFriendships();
  await createPosts();
  await createEvents();
  await createEventRsvps();
  await createActivities();
  await createGradeDistributions();
  await createNotifications();
  await createNotificationPreferences();
  await createStudyGroups();

  console.log('\n✅ Seed complete!\n');
  console.log('Test accounts (all passwords: TestPass123!):');
  for (const u of createdUsers) {
    console.log(`  ${u.email}`);
  }
  console.log('');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
