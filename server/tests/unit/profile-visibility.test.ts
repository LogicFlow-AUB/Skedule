import { beforeEach, describe, expect, it, vi } from 'vitest';

const fakeClient = { value: null as ReturnType<typeof createFakeSupabase> | null };

const { trackActivity, notifyPostCommented, notifyPostLiked, notifyReviewLiked } = vi.hoisted(() => ({
  trackActivity: vi.fn(async () => undefined),
  notifyPostCommented: vi.fn(async () => undefined),
  notifyPostLiked: vi.fn(async () => undefined),
  notifyReviewLiked: vi.fn(async () => undefined),
}));

vi.mock('../../src/db/supabase.js', () => ({
  requireSupabaseClient: () => fakeClient.value,
}));
vi.mock('../../src/services/activity.service.js', () => ({ trackActivity }));
vi.mock('../../src/services/notifications.service.js', () => ({
  notifyPostCommented,
  notifyPostLiked,
  notifyReviewLiked,
}));

import { createFakeSupabase, type Row } from '../fixtures/fake-supabase.js';
import { getPost } from '../../src/services/feed.service.js';
import { getProfessorReviews } from '../../src/services/reviews.service.js';

const PAGINATION = { page: 1, limit: 50, offset: 0 };

function profile(id: string, first: string, visibility: string): Row {
  return {
    id,
    first_name: first,
    last_name: 'Test',
    email: `${first}@aub.edu.lb`,
    major: 'CS',
    level: 'Senior',
    profile_visibility: visibility,
  };
}

const PUBLIC_AUTHOR = 'public-user';
const FRIEND_FRIENDS_ONLY = 'friend-friends-only';
const STRANGER_FRIENDS_ONLY = 'stranger-friends-only';
const FRIEND_PRIVATE = 'friend-private';
const STRANGER_PRIVATE = 'stranger-private';
const VIEWER = 'viewer';

const USERS: Row[] = [
  profile(PUBLIC_AUTHOR, 'Adam', 'public'),
  profile(FRIEND_FRIENDS_ONLY, 'Bella', 'friends_only'),
  profile(STRANGER_FRIENDS_ONLY, 'Finn', 'friends_only'),
  profile(FRIEND_PRIVATE, 'Carla', 'private'),
  profile(STRANGER_PRIVATE, 'Gina', 'private'),
  profile(VIEWER, 'Dana', 'private'),
];

// Friendships: the viewer is friends with FRIEND_FRIENDS_ONLY and FRIEND_PRIVATE
// but NOT with PUBLIC_AUTHOR, STRANGER_FRIENDS_ONLY, or STRANGER_PRIVATE.
const FRIENDSHIPS: Row[] = [
  { id: 1, user_id: VIEWER, friend_id: FRIEND_FRIENDS_ONLY, status: 'accepted', created_at: '2026-01-01T00:00:00Z' },
  { id: 2, user_id: VIEWER, friend_id: FRIEND_PRIVATE, status: 'accepted', created_at: '2026-01-01T00:00:00Z' },
];

function embedUser(userId: string): Row {
  const user = USERS.find((u) => u.id === userId)!;
  return { ...user };
}

// One post per author so each visibility case can be checked independently.
const POSTS: Row[] = [
  { id: 1, user_id: PUBLIC_AUTHOR, type: 'question', content: 'public post', tags: [], schedule_id: null, created_at: '2026-01-01T00:00:00Z' },
  { id: 2, user_id: FRIEND_FRIENDS_ONLY, type: 'question', content: 'friend ff post', tags: [], schedule_id: null, created_at: '2026-01-01T00:00:00Z' },
  { id: 3, user_id: STRANGER_FRIENDS_ONLY, type: 'question', content: 'stranger ff post', tags: [], schedule_id: null, created_at: '2026-01-01T00:00:00Z' },
  { id: 4, user_id: FRIEND_PRIVATE, type: 'question', content: 'friend private post', tags: [], schedule_id: null, created_at: '2026-01-01T00:00:00Z' },
  { id: 5, user_id: STRANGER_PRIVATE, type: 'question', content: 'stranger private post', tags: [], schedule_id: null, created_at: '2026-01-01T00:00:00Z' },
  { id: 6, user_id: VIEWER, type: 'question', content: 'own post', tags: [], schedule_id: null, created_at: '2026-01-01T00:00:00Z' },
];

// A professor review per author, mirroring the post set.
const PROFESSOR_REVIEWS: Row[] = POSTS.map((post, index) => ({
  id: index + 1,
  professor_id: 900,
  user_id: post.user_id,
  rating: 4,
  difficulty: 3,
  would_retake: true,
  comment: post.content + ' rev',
  created_at: post.created_at,
  users: embedUser(post.user_id),
}));

function resetTables() {
  fakeClient.value = createFakeSupabase({
    users: USERS.map((u) => ({ ...u })),
    friendships: FRIENDSHIPS.map((f) => ({ ...f })),
    posts: POSTS.map((p) => ({ ...p })),
    post_likes: [],
    post_saves: [],
    post_comments: [],
    professor_reviews: PROFESSOR_REVIEWS.map((r) => ({ ...r })),
  });
}

beforeEach(() => {
  resetTables();
});

describe('profile visibility - feed posts (viewer = Dana)', () => {
  it('public + non-friend -> reveals the name', async () => {
    const post = await getPost(1, VIEWER);
    expect(post.author?.firstName).toBe('Adam');
    expect(post.author?.lastName).toBe('Test');
  });

  it('friends_only + friend -> reveals the name', async () => {
    const post = await getPost(2, VIEWER);
    expect(post.author?.firstName).toBe('Bella');
  });

  it('friends_only + non-friend -> returns Anonymous', async () => {
    const post = await getPost(3, VIEWER);
    expect(post.author?.firstName).toBeNull();
    expect(post.author?.lastName).toBeNull();
  });

  it('private + friend -> returns Anonymous', async () => {
    const post = await getPost(4, VIEWER);
    expect(post.author?.firstName).toBeNull();
    expect(post.author?.lastName).toBeNull();
  });

  it('private + non-friend -> returns Anonymous', async () => {
    const post = await getPost(5, VIEWER);
    expect(post.author?.firstName).toBeNull();
    expect(post.author?.lastName).toBeNull();
  });

  it('user viewing their own content -> always reveals their name', async () => {
    const post = await getPost(6, VIEWER);
    expect(post.author?.firstName).toBe('Dana');
  });

  it('an unauthenticated viewer sees Anonymous for non-public authors', async () => {
    const publicPost = await getPost(1);
    expect(publicPost.author?.firstName).toBe('Adam');
    const friendFF = await getPost(2);
    expect(friendFF.author?.firstName).toBeNull();
  });
});

describe('profile visibility - professor reviews (viewer = Dana)', () => {
  it('public + non-friend -> reveals the reviewer name', async () => {
    const page = await getProfessorReviews(900, PAGINATION, VIEWER);
    const review = page.data.find((r) => r.id === 1)!;
    expect(review.author?.firstName).toBe('Adam');
    expect(review.author?.lastName).toBe('Test');
  });

  it('friends_only + friend -> reveals the reviewer name', async () => {
    const page = await getProfessorReviews(900, PAGINATION, VIEWER);
    const review = page.data.find((r) => r.id === 2)!;
    expect(review.author?.firstName).toBe('Bella');
  });

  it('friends_only + non-friend -> returns Anonymous', async () => {
    const page = await getProfessorReviews(900, PAGINATION, VIEWER);
    const review = page.data.find((r) => r.id === 3)!;
    expect(review.author?.firstName).toBeNull();
    expect(review.author?.lastName).toBeNull();
  });

  it('private + friend -> returns Anonymous', async () => {
    const page = await getProfessorReviews(900, PAGINATION, VIEWER);
    const review = page.data.find((r) => r.id === 4)!;
    expect(review.author?.firstName).toBeNull();
    expect(review.author?.lastName).toBeNull();
  });

  it('private + non-friend -> returns Anonymous', async () => {
    const page = await getProfessorReviews(900, PAGINATION, VIEWER);
    const review = page.data.find((r) => r.id === 5)!;
    expect(review.author?.firstName).toBeNull();
    expect(review.author?.lastName).toBeNull();
  });

  it('user viewing their own review -> always reveals their name', async () => {
    const page = await getProfessorReviews(900, PAGINATION, VIEWER);
    const review = page.data.find((r) => r.id === 6)!;
    expect(review.author?.firstName).toBe('Dana');
  });
});
