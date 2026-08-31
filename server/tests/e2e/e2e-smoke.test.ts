/**
 * End-to-end smoke test for all 11 backend phases.
 *
 * Starts the server, hits every endpoint category, and reports results.
 * Run from server/:  npx tsx tests/e2e/e2e-smoke.test.ts
 */

import { spawn, type ChildProcess } from 'node:child_process';

const BASE = 'http://localhost:3456';
let server: ChildProcess | undefined;

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

async function req(
  method: HttpMethod,
  path: string,
  body?: unknown,
  token?: string,
): Promise<{ status: number; body: unknown }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  return { status: res.status, body: json };
}

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

const results: { phase: string; test: string; ok: boolean; detail?: string }[] = [];

function ok(phase: string, test: string) {
  results.push({ phase, test, ok: true });
  console.log(`  ✓ ${test}`);
}

function fail(phase: string, test: string, detail: string) {
  results.push({ phase, test, ok: false, detail });
  console.log(`  ✗ ${test}  —  ${detail}`);
}

// ---------------------------------------------------------------------------
// Auth helpers (Phase 2)
// ---------------------------------------------------------------------------

let aliceToken = '';
let aliceRefresh = '';

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

async function testHealth() {
  console.log('\n── Health ──');
  const r = await req('GET', '/api/health');
  const b = r.body as Record<string, unknown>;
  if (r.status === 200 || r.status === 503) {
    ok('Health', `GET /api/health → ${r.status} (${b.status})`);
  } else {
    fail('Health', 'GET /api/health', `status ${r.status}`);
  }
}

async function testAuth() {
  console.log('\n── Phase 2: Auth ──');

  // Login
  const login = await req('POST', '/api/auth/login', {
    email: 'alice@mail.aub.edu',
    password: 'TestPass123!',
  });
  if (login.status === 200) {
    ok('Phase 2', 'POST /api/auth/login');
    const b = login.body as Record<string, unknown>;
    const tokens = b.tokens as Record<string, unknown> | undefined;
    aliceToken = (tokens?.accessToken as string) ?? '';
    aliceRefresh = (tokens?.refreshToken as string) ?? '';
  } else {
    fail(
      'Phase 2',
      'POST /api/auth/login',
      `status ${login.status} — ${(login.body as Record<string, unknown>)?.error}`,
    );
  }

  if (!aliceToken) return;

  // Me
  const me = await req('GET', '/api/auth/me', undefined, aliceToken);
  if (me.status === 200) {
    ok('Phase 2', 'GET /api/auth/me');
  } else {
    fail('Phase 2', 'GET /api/auth/me', `status ${me.status}`);
  }

  // Refresh
  if (aliceRefresh) {
    const refresh = await req('POST', '/api/auth/refresh', { refreshToken: aliceRefresh });
    if (refresh.status === 200) {
      ok('Phase 2', 'POST /api/auth/refresh');
      const b = refresh.body as Record<string, unknown>;
      const tokens = b.tokens as Record<string, unknown> | undefined;
      if (tokens?.accessToken) aliceToken = tokens.accessToken as string;
    } else {
      fail('Phase 2', 'POST /api/auth/refresh', `status ${refresh.status}`);
    }
  }
}

async function testCourses() {
  console.log('\n── Phase 4: Courses ──');

  const list = await req('GET', '/api/courses?page=1&limit=5&sort=name&order=asc');
  if (list.status === 200) {
    const b = list.body as Record<string, unknown>;
    const data = b.data as unknown[];
    ok('Phase 4', `GET /api/courses → ${data.length} courses`);
  } else {
    fail(
      'Phase 4',
      'GET /api/courses',
      `status ${list.status} — ${(list.body as Record<string, unknown>)?.error}`,
    );
  }

  // Search
  const search = await req('GET', '/api/courses?search=CMPS&page=1&limit=3');
  if (search.status === 200) {
    const b = search.body as Record<string, unknown>;
    const data = b.data as unknown[];
    ok('Phase 4', `GET /api/courses?search=CMPS → ${data.length} results`);
  } else {
    fail('Phase 4', 'GET /api/courses?search=CMPS', `status ${search.status}`);
  }

  // Single course
  const one = await req('GET', '/api/courses/CMPS 214');
  if (one.status === 200) {
    ok('Phase 4', 'GET /api/courses/CMPS 214');
  } else {
    fail('Phase 4', 'GET /api/courses/CMPS 214', `status ${one.status}`);
  }

  // Sections
  const sections = await req('GET', '/api/courses/CMPS 214/sections');
  if (sections.status === 200) {
    const b = sections.body as Record<string, unknown>;
    const data = b.data as unknown[];
    ok('Phase 4', `GET /api/courses/CMPS 214/sections → ${data.length} sections`);
  } else {
    fail('Phase 4', 'GET /api/courses/CMPS 214/sections', `status ${sections.status}`);
  }

  // Grade distribution
  const grades = await req('GET', '/api/courses/CMPS 214/grade-distribution');
  if (grades.status === 200) {
    const b = grades.body as Record<string, unknown>;
    const data = b.data as unknown[];
    ok('Phase 4', `GET /api/courses/CMPS 214/grade-distribution → ${data.length} entries`);
  } else {
    fail('Phase 4', 'GET /api/courses/CMPS 214/grade-distribution', `status ${grades.status}`);
  }

  // Compare
  const compare = await req('POST', '/api/courses/compare', { codes: ['CMPS 214', 'CMPS 301'] });
  if (compare.status === 200) {
    ok('Phase 4', 'POST /api/courses/compare');
  } else {
    fail('Phase 4', 'POST /api/courses/compare', `status ${compare.status}`);
  }
}

async function testProfessors() {
  console.log('\n── Phase 4: Professors ──');

  const list = await req('GET', '/api/professors?page=1&limit=5');
  if (list.status === 200) {
    const b = list.body as Record<string, unknown>;
    const data = b.data as unknown[];
    ok('Phase 4', `GET /api/professors → ${data.length} professors`);
  } else {
    fail('Phase 4', 'GET /api/professors', `status ${list.status}`);
  }

  const one = await req('GET', '/api/professors/1');
  if (one.status === 200) {
    ok('Phase 4', 'GET /api/professors/1');
  } else {
    fail('Phase 4', 'GET /api/professors/1', `status ${one.status}`);
  }
}

async function testReviews() {
  console.log('\n── Phase 5: Reviews ──');

  if (!aliceToken) {
    fail('Phase 5', 'Reviews (skipped — no auth token)', 'login failed');
    return;
  }

  // Course reviews
  const courseReviews = await req('GET', '/api/courses/CMPS 214/reviews?page=1&limit=5');
  if (courseReviews.status === 200) {
    const b = courseReviews.body as Record<string, unknown>;
    const data = b.data as unknown[];
    ok('Phase 5', `GET /api/courses/CMPS 214/reviews → ${data.length} reviews`);
  } else {
    fail('Phase 5', 'GET /api/courses/CMPS 214/reviews', `status ${courseReviews.status}`);
  }

  // Create course review
  const createReview = await req(
    'POST',
    '/api/courses/CMPS 214/reviews',
    { rating: 4, difficulty: 3, wouldRetake: true, comment: 'E2E test review' },
    aliceToken,
  );
  if (createReview.status === 201 || createReview.status === 200) {
    ok('Phase 5', 'POST /api/courses/CS 214/reviews');
  } else {
    fail('Phase 5', 'POST /api/courses/CS 214/reviews', `status ${createReview.status}`);
  }

  // Professor reviews
  const profReviews = await req('GET', '/api/professors/1/reviews?page=1&limit=5');
  if (profReviews.status === 200) {
    ok('Phase 5', 'GET /api/professors/1/reviews');
  } else {
    fail('Phase 5', 'GET /api/professors/1/reviews', `status ${profReviews.status}`);
  }

  // Create prof review
  const createProfReview = await req(
    'POST',
    '/api/professors/1/reviews',
    { rating: 5, difficulty: 2, wouldRetake: true, comment: 'E2E test professor review' },
    aliceToken,
  );
  if (createProfReview.status === 201 || createProfReview.status === 200) {
    ok('Phase 5', 'POST /api/professors/1/reviews');
  } else {
    fail('Phase 5', 'POST /api/professors/1/reviews', `status ${createProfReview.status}`);
  }

  // Like prof review
  const likeReview = await req('POST', '/api/professors/1/reviews/1/like', {}, aliceToken);
  if (
    likeReview.status === 200 ||
    likeReview.status === 201 ||
    likeReview.status === 204 ||
    likeReview.status === 409
  ) {
    ok('Phase 5', 'POST /api/professors/1/reviews/1/like');
  } else {
    fail('Phase 5', 'POST /api/professors/1/reviews/1/like', `status ${likeReview.status}`);
  }

  // Report prof review
  const reportReview = await req(
    'POST',
    '/api/professors/1/reviews/1/report',
    { reason: 'Test report' },
    aliceToken,
  );
  if (
    reportReview.status === 200 ||
    reportReview.status === 201 ||
    reportReview.status === 204 ||
    reportReview.status === 409
  ) {
    ok('Phase 5', 'POST /api/professors/1/reviews/1/report');
  } else {
    fail('Phase 5', 'POST /api/professors/1/reviews/1/report', `status ${reportReview.status}`);
  }
}

async function testDashboard() {
  console.log('\n── Phase 6: Dashboard ──');

  if (!aliceToken) {
    fail('Phase 6', 'Dashboard (skipped — no auth token)', 'login failed');
    return;
  }

  const stats = await req('GET', '/api/dashboard/stats', undefined, aliceToken);
  if (stats.status === 200) {
    ok('Phase 6', 'GET /api/dashboard/stats');
  } else {
    fail('Phase 6', 'GET /api/dashboard/stats', `status ${stats.status}`);
  }

  const upcoming = await req('GET', '/api/dashboard/upcoming', undefined, aliceToken);
  if (upcoming.status === 200) {
    ok('Phase 6', 'GET /api/dashboard/upcoming');
  } else {
    fail('Phase 6', 'GET /api/dashboard/upcoming', `status ${upcoming.status}`);
  }

  const activity = await req('GET', '/api/dashboard/activity', undefined, aliceToken);
  if (activity.status === 200) {
    ok('Phase 6', 'GET /api/dashboard/activity');
  } else {
    fail('Phase 6', 'GET /api/dashboard/activity', `status ${activity.status}`);
  }
}

async function testSchedules() {
  console.log('\n── Phase 7: Schedules ──');

  if (!aliceToken) {
    fail('Phase 7', 'Schedules (skipped — no auth token)', 'login failed');
    return;
  }

  const list = await req('GET', '/api/schedules', undefined, aliceToken);
  if (list.status === 200) {
    const b = list.body as Record<string, unknown>;
    const data = b.data as unknown[];
    ok('Phase 7', `GET /api/schedules → ${data.length} schedules`);
  } else {
    fail('Phase 7', 'GET /api/schedules', `status ${list.status}`);
  }

  // Create
  const create = await req(
    'POST',
    '/api/schedules',
    { name: 'E2E Test Schedule', termId: 1 },
    aliceToken,
  );
  if (create.status === 201 || create.status === 200) {
    ok('Phase 7', 'POST /api/schedules');
    const b = create.body as Record<string, unknown>;
    const sched = (b.data ?? b) as Record<string, unknown>;
    const schedId = sched.id as number;

    // Detail
    const detail = await req('GET', `/api/schedules/${schedId}`, undefined, aliceToken);
    if (detail.status === 200) {
      ok('Phase 7', `GET /api/schedules/${schedId}`);
    } else {
      fail('Phase 7', `GET /api/schedules/${schedId}`, `status ${detail.status}`);
    }

    // Update
    const upd = await req(
      'PUT',
      `/api/schedules/${schedId}`,
      { name: 'E2E Updated Schedule' },
      aliceToken,
    );
    if (upd.status === 200) {
      ok('Phase 7', `PUT /api/schedules/${schedId}`);
    } else {
      fail('Phase 7', `PUT /api/schedules/${schedId}`, `status ${upd.status}`);
    }

    // Add course
    const addCourse = await req(
      'POST',
      `/api/schedules/${schedId}/courses`,
      { sectionId: 1 },
      aliceToken,
    );
    if (addCourse.status === 200 || addCourse.status === 201 || addCourse.status === 409) {
      ok('Phase 7', `POST /api/schedules/${schedId}/courses`);
    } else {
      fail('Phase 7', `POST /api/schedules/${schedId}/courses`, `status ${addCourse.status}`);
    }

    // Conflicts
    const conflicts = await req(
      'GET',
      `/api/schedules/${schedId}/conflicts`,
      undefined,
      aliceToken,
    );
    if (conflicts.status === 200) {
      ok('Phase 7', `GET /api/schedules/${schedId}/conflicts`);
    } else {
      fail('Phase 7', `GET /api/schedules/${schedId}/conflicts`, `status ${conflicts.status}`);
    }

    // Delete
    const del = await req('DELETE', `/api/schedules/${schedId}`, undefined, aliceToken);
    if (del.status === 200 || del.status === 204) {
      ok('Phase 7', `DELETE /api/schedules/${schedId}`);
    } else {
      fail('Phase 7', `DELETE /api/schedules/${schedId}`, `status ${del.status}`);
    }
  } else {
    fail('Phase 7', 'POST /api/schedules', `status ${create.status}`);
  }
}

async function testFeed() {
  console.log('\n── Phase 8: Social Feed ──');

  if (!aliceToken) {
    fail('Phase 8', 'Feed (skipped — no auth token)', 'login failed');
    return;
  }

  const list = await req('GET', '/api/feed?page=1&limit=5');
  if (list.status === 200) {
    const b = list.body as Record<string, unknown>;
    const data = b.data as unknown[];
    ok('Phase 8', `GET /api/feed → ${data.length} posts`);
  } else {
    fail('Phase 8', 'GET /api/feed', `status ${list.status}`);
  }

  // Create
  const create = await req(
    'POST',
    '/api/feed',
    { type: 'tip', content: 'E2E smoke test post', tags: ['test'] },
    aliceToken,
  );
  if (create.status === 201 || create.status === 200) {
    ok('Phase 8', 'POST /api/feed');
    const b = create.body as Record<string, unknown>;
    const post = (b.data ?? b) as Record<string, unknown>;
    const postId = post.id as number;

    // Detail
    const detail = await req('GET', `/api/feed/${postId}`);
    if (detail.status === 200) {
      ok('Phase 8', `GET /api/feed/${postId}`);
    } else {
      fail('Phase 8', `GET /api/feed/${postId}`, `status ${detail.status}`);
    }

    // Like
    const like = await req('POST', `/api/feed/${postId}/like`, {}, aliceToken);
    if (like.status === 200 || like.status === 201 || like.status === 204) {
      ok('Phase 8', `POST /api/feed/${postId}/like`);
    } else {
      fail('Phase 8', `POST /api/feed/${postId}/like`, `status ${like.status}`);
    }

    // Comment
    const comment = await req(
      'POST',
      `/api/feed/${postId}/comments`,
      { content: 'E2E test comment' },
      aliceToken,
    );
    if (comment.status === 200 || comment.status === 201) {
      ok('Phase 8', `POST /api/feed/${postId}/comments`);
    } else {
      fail('Phase 8', `POST /api/feed/${postId}/comments`, `status ${comment.status}`);
    }

    // List comments
    const comments = await req('GET', `/api/feed/${postId}/comments?page=1&limit=5`);
    if (comments.status === 200) {
      ok('Phase 8', `GET /api/feed/${postId}/comments`);
    } else {
      fail('Phase 8', `GET /api/feed/${postId}/comments`, `status ${comments.status}`);
    }

    // Save
    const save = await req('POST', `/api/feed/${postId}/save`, {}, aliceToken);
    if (save.status === 200 || save.status === 201 || save.status === 204) {
      ok('Phase 8', `POST /api/feed/${postId}/save`);
    } else {
      fail('Phase 8', `POST /api/feed/${postId}/save`, `status ${save.status}`);
    }

    // Delete
    const del = await req('DELETE', `/api/feed/${postId}`, undefined, aliceToken);
    if (del.status === 200 || del.status === 204) {
      ok('Phase 8', `DELETE /api/feed/${postId}`);
    } else {
      fail('Phase 8', `DELETE /api/feed/${postId}`, `status ${del.status}`);
    }
  } else {
    fail('Phase 8', 'POST /api/feed', `status ${create.status}`);
  }
}

async function testFriends() {
  console.log('\n── Phase 9: Friends ──');

  if (!aliceToken) {
    fail('Phase 9', 'Friends (skipped — no auth token)', 'login failed');
    return;
  }

  const list = await req('GET', '/api/friends', undefined, aliceToken);
  if (list.status === 200) {
    const b = list.body as Record<string, unknown>;
    const data = b.data as unknown[];
    ok('Phase 9', `GET /api/friends → ${data.length} friends`);
  } else {
    fail('Phase 9', 'GET /api/friends', `status ${list.status}`);
  }

  const suggested = await req('GET', '/api/friends/suggested', undefined, aliceToken);
  if (suggested.status === 200) {
    ok('Phase 9', 'GET /api/friends/suggested');
  } else {
    fail('Phase 9', 'GET /api/friends/suggested', `status ${suggested.status}`);
  }

  const requests = await req('GET', '/api/friends/requests', undefined, aliceToken);
  if (requests.status === 200) {
    ok('Phase 9', 'GET /api/friends/requests');
  } else {
    fail('Phase 9', 'GET /api/friends/requests', `status ${requests.status}`);
  }
}

async function testNotifications() {
  console.log('\n── Phase 10: Notifications ──');

  if (!aliceToken) {
    fail('Phase 10', 'Notifications (skipped — no auth token)', 'login failed');
    return;
  }

  const list = await req('GET', '/api/notifications?page=1&limit=5', undefined, aliceToken);
  if (list.status === 200) {
    const b = list.body as Record<string, unknown>;
    const data = b.data as unknown[];
    ok('Phase 10', `GET /api/notifications → ${data.length} notifications`);
  } else {
    fail('Phase 10', 'GET /api/notifications', `status ${list.status}`);
  }

  const unread = await req('GET', '/api/notifications/unread-count', undefined, aliceToken);
  if (unread.status === 200) {
    ok('Phase 10', 'GET /api/notifications/unread-count');
  } else {
    fail('Phase 10', 'GET /api/notifications/unread-count', `status ${unread.status}`);
  }

  const readAll = await req('PUT', '/api/notifications/read-all', undefined, aliceToken);
  if (readAll.status === 200 || readAll.status === 204) {
    ok('Phase 10', 'PUT /api/notifications/read-all');
  } else {
    fail('Phase 10', 'PUT /api/notifications/read-all', `status ${readAll.status}`);
  }
}

async function testUsers() {
  console.log('\n── Phase 3: Users ──');

  if (!aliceToken) {
    fail('Phase 3', 'Users (skipped — no auth token)', 'login failed');
    return;
  }

  // Get own user ID from /api/auth/me
  const me = await req('GET', '/api/auth/me', undefined, aliceToken);
  if (me.status !== 200) {
    fail('Phase 3', 'Users (skipped — /api/auth/me failed)', `status ${me.status}`);
    return;
  }
  const meBody = me.body as Record<string, unknown>;
  const userId = (meBody.user as Record<string, unknown>)?.id as string;
  if (!userId) {
    fail('Phase 3', 'Users (skipped — no user ID)', 'could not extract user ID');
    return;
  }

  const profile = await req('GET', `/api/users/${userId}/profile`, undefined, aliceToken);
  if (profile.status === 200) {
    ok('Phase 3', 'GET /api/users/:id/profile');
  } else {
    fail('Phase 3', 'GET /api/users/:id/profile', `status ${profile.status}`);
  }

  const stats = await req('GET', `/api/users/${userId}/stats`);
  if (stats.status === 200) {
    ok('Phase 3', 'GET /api/users/:id/stats');
  } else {
    fail('Phase 3', 'GET /api/users/:id/stats', `status ${stats.status}`);
  }

  const reviews = await req('GET', `/api/users/${userId}/reviews`);
  if (reviews.status === 200) {
    ok('Phase 3', 'GET /api/users/:id/reviews');
  } else {
    fail('Phase 3', 'GET /api/users/:id/reviews', `status ${reviews.status}`);
  }

  const achievements = await req('GET', `/api/users/${userId}/achievements`);
  if (achievements.status === 200) {
    ok('Phase 3', 'GET /api/users/:id/achievements');
  } else {
    fail('Phase 3', 'GET /api/users/:id/achievements', `status ${achievements.status}`);
  }
}

async function testEventsAndStudyGroups() {
  console.log('\n── Phase 11: Events & Study Groups ──');

  if (!aliceToken) {
    fail('Phase 11', 'Events & Study Groups (skipped — no auth token)', 'login failed');
    return;
  }

  const eventList = await req('GET', '/api/events?page=1&limit=5');
  if (eventList.status === 200) {
    const b = eventList.body as Record<string, unknown>;
    const data = b.data as unknown[];
    ok('Phase 11', `GET /api/events → ${data.length} events`);
  } else {
    fail('Phase 11', 'GET /api/events', `status ${eventList.status}`);
  }

  const groupList = await req('GET', '/api/study-groups?page=1&limit=5');
  if (groupList.status === 200) {
    const b = groupList.body as Record<string, unknown>;
    const data = b.data as unknown[];
    ok('Phase 11', `GET /api/study-groups → ${data.length} groups`);
  } else {
    fail('Phase 11', 'GET /api/study-groups', `status ${groupList.status}`);
  }

  const createGroup = await req(
    'POST',
    '/api/study-groups',
    {
      name: 'E2E Test Group',
      courseCode: 'CMPS 214',
      description: 'Created by e2e smoke test.',
      maxMembers: 5,
    },
    aliceToken,
  );
  if (createGroup.status === 201) {
    const body = createGroup.body as Record<string, unknown>;
    const groupId = body.id as number;
    ok('Phase 11', `POST /api/study-groups → id ${groupId}`);

    // Host is auto-joined on create, so join returns 409 (already a member)
    const joinGroup = await req('POST', `/api/study-groups/${groupId}/join`, undefined, aliceToken);
    if (joinGroup.status === 204 || joinGroup.status === 409) {
      ok(
        'Phase 11',
        `POST /api/study-groups/${groupId}/join → ${joinGroup.status === 204 ? 'joined' : 'already member'}`,
      );
    } else {
      fail('Phase 11', `POST /api/study-groups/${groupId}/join`, `status ${joinGroup.status}`);
    }

    // Host cannot leave their own group (400)
    const leaveGroup = await req(
      'DELETE',
      `/api/study-groups/${groupId}/join`,
      undefined,
      aliceToken,
    );
    if (leaveGroup.status === 204 || leaveGroup.status === 400) {
      ok(
        'Phase 11',
        `DELETE /api/study-groups/${groupId}/join → ${leaveGroup.status === 204 ? 'left' : 'host cannot leave'}`,
      );
    } else {
      fail('Phase 11', `DELETE /api/study-groups/${groupId}/join`, `status ${leaveGroup.status}`);
    }

    const getGroup = await req('GET', `/api/study-groups/${groupId}`);
    if (getGroup.status === 200) {
      ok('Phase 11', `GET /api/study-groups/${groupId}`);
    } else {
      fail('Phase 11', `GET /api/study-groups/${groupId}`, `status ${getGroup.status}`);
    }
  } else {
    fail('Phase 11', 'POST /api/study-groups', `status ${createGroup.status}`);
  }

  // Event RSVP test (events must exist from seed)
  const eventsRes = await req('GET', '/api/events?page=1&limit=1');
  if (eventsRes.status === 200) {
    const body = eventsRes.body as Record<string, unknown>;
    const data = body.data as Record<string, unknown>[];
    if (data.length > 0) {
      const eventId = data[0]!.id as number;

      // May already be RSVPed from seed — accept both 204 and 409
      const rsvp = await req('POST', `/api/events/${eventId}/rsvp`, undefined, aliceToken);
      if (rsvp.status === 204 || rsvp.status === 409) {
        ok(
          'Phase 11',
          `POST /api/events/${eventId}/rsvp → ${rsvp.status === 204 ? 'RSVPed' : 'already RSVPed'}`,
        );
      } else {
        fail('Phase 11', `POST /api/events/${eventId}/rsvp`, `status ${rsvp.status}`);
      }

      // Cancel RSVP — should succeed or return 404 if not RSVPed
      const cancelRsvp = await req('DELETE', `/api/events/${eventId}/rsvp`, undefined, aliceToken);
      if (cancelRsvp.status === 204 || cancelRsvp.status === 404) {
        ok(
          'Phase 11',
          `DELETE /api/events/${eventId}/rsvp → ${cancelRsvp.status === 204 ? 'cancelled' : 'no RSVP to cancel'}`,
        );
      } else {
        fail('Phase 11', `DELETE /api/events/${eventId}/rsvp`, `status ${cancelRsvp.status}`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function startServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    server = spawn('node', ['node_modules/tsx/dist/cli.mjs', 'src/server.ts'], {
      cwd: process.cwd(),
      env: { ...process.env, PORT: '3456' },
      stdio: 'pipe',
    });

    let started = false;
    server.stdout?.on('data', (chunk: Buffer) => {
      const line = chunk.toString();
      if (!started && line.includes('listening')) {
        started = true;
        resolve();
      }
    });

    server.stderr?.on('data', (chunk: Buffer) => {
      if (!started) {
        process.stderr.write(chunk);
      }
    });

    server.on('error', reject);
    setTimeout(() => {
      if (!started) reject(new Error('Server did not start within 10s'));
    }, 10_000);
  });
}

function stopServer() {
  if (server) {
    server.kill('SIGTERM');
    server = undefined;
  }
}

async function main() {
  console.log('Starting server on port 3456…');
  try {
    await startServer();
  } catch (err) {
    console.error('Failed to start server:', (err as Error).message);
    process.exit(1);
  }
  console.log('Server started.\n');

  try {
    await testHealth();
    await testAuth();
    await testCourses();
    await testProfessors();
    await testReviews();
    await testUsers();
    await testDashboard();
    await testSchedules();
    await testFeed();
    await testFriends();
    await testNotifications();
    await testEventsAndStudyGroups();
  } finally {
    stopServer();
  }

  // Summary
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  console.log('\n═══════════════════════════════════════');
  console.log(`  Total: ${results.length}  Passed: ${passed}  Failed: ${failed}`);
  console.log('═══════════════════════════════════════');

  if (failed > 0) {
    console.log('\nFailed tests:');
    for (const r of results.filter((r) => !r.ok)) {
      console.log(`  [${r.phase}] ${r.test}  →  ${r.detail}`);
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  stopServer();
  process.exit(1);
});
