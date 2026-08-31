import { beforeEach, describe, expect, it, vi } from 'vitest';

const fakeClient = { value: null as ReturnType<typeof createFakeSupabase> | null };

const { trackActivity, notifyPostCommented, notifyPostLiked } = vi.hoisted(() => ({
  trackActivity: vi.fn(async () => undefined),
  notifyPostCommented: vi.fn(async () => undefined),
  notifyPostLiked: vi.fn(async () => undefined),
}));

vi.mock('../../src/db/supabase.js', () => ({
  requireSupabaseClient: () => fakeClient.value,
}));
vi.mock('../../src/services/activity.service.js', () => ({ trackActivity }));
vi.mock('../../src/services/notifications.service.js', () => ({
  notifyPostCommented,
  notifyPostLiked,
}));

import { createFakeSupabase, type Row } from '../fixtures/fake-supabase.js';
import { AppError } from '../../src/utils/app-error.js';
import {
  createComment,
  deleteComment,
  getComments,
  listMyComments,
  listMyPosts,
} from '../../src/services/feed.service.js';

const PAGINATION = { page: 1, limit: 50, offset: 0 };

const POSTS: Row[] = [
  { id: 1, user_id: 'poster-1', type: 'question', content: 'Original post', tags: [], schedule_id: null, created_at: '2026-01-01T10:00:00Z' },
  { id: 2, user_id: 'poster-1', type: 'tip', content: 'Different post', tags: [], schedule_id: null, created_at: '2026-01-01T11:00:00Z' },
];

const USERS: Row[] = [
  { id: 'poster-1', first_name: 'Lamia', last_name: 'Haddad', email: 'lamia@aub.edu.lb', major: 'CS', level: 'Senior' },
  { id: 'me', first_name: 'Karim', last_name: 'Nasser', email: 'karim@aub.edu.lb', major: 'CE', level: 'Junior' },
  { id: 'other', first_name: 'Sara', last_name: 'Zouein', email: 'sara@aub.edu.lb', major: 'ME', level: 'Sophomore' },
];

// Top-level comment written by "me" on post 1.
const TOP_COMMENT: Row = {
  id: 10,
  post_id: 1,
  user_id: 'me',
  content: 'A great question.',
  parent_comment_id: null,
  created_at: '2026-01-02T10:00:00Z',
  users: { id: 'me', first_name: 'Karim', last_name: 'Nasser', email: 'karim@aub.edu.lb', major: 'CE', level: 'Junior' },
  posts: { id: 1, user_id: 'poster-1', type: 'question', content: 'Original post', tags: [], schedule_id: null, created_at: '2026-01-01T10:00:00Z' },
};

// Another top-level comment written by "other".
const OTHER_TOP_COMMENT: Row = {
  id: 11,
  post_id: 1,
  user_id: 'other',
  content: 'Glad you asked.',
  parent_comment_id: null,
  created_at: '2026-01-03T10:00:00Z',
  users: { id: 'other', first_name: 'Sara', last_name: 'Zouein', email: 'sara@aub.edu.lb', major: 'ME', level: 'Sophomore' },
  posts: { id: 1, user_id: 'poster-1', type: 'question', content: 'Original post', tags: [], schedule_id: null, created_at: '2026-01-01T10:00:00Z' },
};

// A reply to TOP_COMMENT (id 10). This is a reply, so it can never be replied to.
const REPLY: Row = {
  id: 12,
  post_id: 1,
  user_id: 'other',
  content: 'Completely agree.',
  parent_comment_id: 10,
  created_at: '2026-01-04T10:00:00Z',
  users: { id: 'other', first_name: 'Sara', last_name: 'Zouein', email: 'sara@aub.edu.lb', major: 'ME', level: 'Sophomore' },
  posts: { id: 1, user_id: 'poster-1', type: 'question', content: 'Original post', tags: [], schedule_id: null, created_at: '2026-01-01T10:00:00Z' },
};

function resetTables() {
  fakeClient.value = createFakeSupabase({
    posts: POSTS.map((p) => ({ ...p })),
    users: USERS.map((u) => ({ ...u })),
    post_likes: [],
    post_saves: [],
    post_comments: [TOP_COMMENT, OTHER_TOP_COMMENT, REPLY].map((c) => ({ ...c })),
  });
  trackActivity.mockClear();
  notifyPostCommented.mockClear();
}

beforeEach(() => {
  resetTables();
});

describe('feed.service comments', () => {
  describe('createComment reply enforcement', () => {
    it('creates a top-level comment when no parent is given', async () => {
      const comment = await createComment('me', 1, { content: 'First!' });
      expect(comment.content).toBe('First!');
      expect(comment.parentCommentId).toBeNull();
      expect(trackActivity).toHaveBeenCalled();
    });

    it('creates a reply to a normal comment', async () => {
      const comment = await createComment('me', 1, {
        content: 'My reply',
        parentCommentId: 10,
      });
      expect(comment.content).toBe('My reply');
      expect(comment.parentCommentId).toBe(10);
      expect(trackActivity).toHaveBeenCalledWith(
        'me',
        'post_commented',
        expect.any(String),
        expect.objectContaining({ postId: 1, commentId: comment.id, parentCommentId: 10 }),
      );
    });

    it('rejects replying to a reply (one level only)', async () => {
      const promise = createComment('me', 1, {
        content: 'This should fail',
        parentCommentId: 12, // REPLY is itself a reply
      });
      await expect(promise).rejects.toMatchObject({
        statusCode: 400,
        code: 'REPLY_ON_REPLY_NOT_ALLOWED',
      });
      await expect(promise).rejects.toBeInstanceOf(AppError);
    });

    it('rejects a reply whose parent belongs to a different post', async () => {
      const promise = createComment('me', 2, {
        content: 'bad',
        parentCommentId: 10, // belongs to post 1, not post 2
      });
      await expect(promise).rejects.toMatchObject({
        statusCode: 400,
        code: 'PARENT_COMMENT_MISMATCH',
      });
    });

    it('rejects a reply to a missing comment', async () => {
      const promise = createComment('me', 1, {
        content: 'bad',
        parentCommentId: 12345,
      });
      await expect(promise).rejects.toMatchObject({
        statusCode: 404,
        code: 'COMMENT_NOT_FOUND',
      });
    });
  });

  describe('deleteComment ownership', () => {
    it('lets the owner delete their own comment', async () => {
      await expect(deleteComment('me', 10)).resolves.toBeUndefined();
      // The comment (and only that comment) is gone.
      const page = await getComments(1, PAGINATION);
      expect(page.data.map((c) => c.id)).not.toContain(10);
    });

    it('rejects deleting a comment owned by someone else', async () => {
      const promise = deleteComment('other', 10); // TOP_COMMENT owned by 'me'
      await expect(promise).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });
      await expect(promise).rejects.toBeInstanceOf(AppError);
    });
  });

  describe('getComments', () => {
    it('returns top-level comments and replies with their parent ids', async () => {
      const page = await getComments(1, PAGINATION);
      const byId = new Map(page.data.map((c) => [c.id, c]));
      expect(page.data).toHaveLength(3);
      expect(byId.get(10)!.parentCommentId).toBeNull();
      expect(byId.get(11)!.parentCommentId).toBeNull();
      expect(byId.get(12)!.parentCommentId).toBe(10);
      expect(byId.get(12)!.author?.firstName).toBe('Sara');
    });
  });

  describe('listMyComments', () => {
    it('lists only the current user\'s comments with a post summary', async () => {
      const page = await listMyComments('me', PAGINATION);
      expect(page.data).toHaveLength(1);
      const mine = page.data[0]!;
      expect(mine.id).toBe(10);
      expect(mine.isReply).toBe(false);
      expect(mine.post?.type).toBe('question');
      expect(mine.content).toBe('A great question.');
    });

    it('marks replies as replies', async () => {
      const page = await listMyComments('other', PAGINATION);
      const isReply = page.data.find((c) => c.id === 12);
      expect(isReply?.isReply).toBe(true);
    });
  });

  describe('listMyPosts', () => {
    it('lists only the current user\'s posts with the feed post shape', async () => {
      const page = await listMyPosts('poster-1', PAGINATION);
      expect(page.data).toHaveLength(2);
      const question = page.data.find((p) => p.type === 'question');
      expect(question?.content).toBe('Original post');
      expect(question?.author?.firstName).toBe('Lamia');
    });

    it('returns nothing for a user with no posts', async () => {
      const page = await listMyPosts('me', PAGINATION);
      expect(page.data).toHaveLength(0);
    });
  });
});
