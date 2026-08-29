import { requireSupabaseClient } from '../db/supabase.js';
import type { Post, PostComment, User } from '../db/types.js';
import { AppError } from '../utils/app-error.js';
import { trackActivity } from './activity.service.js';
import { notifyPostLiked, notifyPostCommented } from './notifications.service.js';
import { createOffsetPage, type OffsetPage, type OffsetPagination } from '../utils/pagination.js';

export type PostType = 'schedule' | 'review' | 'question' | 'tip';

export type CreatePostInput = {
  type: PostType;
  content: string;
  tags?: string[];
  scheduleId?: number;
};

export type CreateCommentInput = {
  content: string;
  parentCommentId?: number;
};

const USER_COLUMNS = 'id, first_name, last_name, email, major, level';
const POST_COLUMNS = 'id, user_id, type, content, tags, schedule_id, created_at';
const COMMENT_COLUMNS = 'id, post_id, user_id, content, parent_comment_id, created_at';

function postAuthor(user: User | null) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    major: user.major,
    level: user.level,
  };
}

function postResponse(
  post: Post,
  author: User | null,
  likeCount: number,
  commentCount: number,
  isLikedByCurrentUser: boolean,
  isSavedByCurrentUser: boolean,
) {
  return {
    id: post.id,
    type: post.type,
    content: post.content,
    tags: post.tags,
    scheduleId: post.schedule_id,
    createdAt: post.created_at,
    author: postAuthor(author),
    likeCount,
    commentCount,
    isLikedByCurrentUser,
    isSavedByCurrentUser,
  };
}

type PostCommentRow = PostComment & { users: User | User[] | null };

type MyCommentRow = PostComment & { posts: Post | Post[] | null };

/**
 * PostgREST returns a to-one embed as an object, but a to-many embed as an
 * array. Normalises both shapes to a single row.
 */
function toOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function commentResponse(comment: PostCommentRow) {
  return {
    id: comment.id,
    postId: comment.post_id,
    content: comment.content,
    parentCommentId: comment.parent_comment_id,
    createdAt: comment.created_at,
    author: postAuthor(toOne(comment.users)),
  };
}

async function getAuthorsByUserId(userIds: string[]): Promise<Map<string, User>> {
  const ids = [...new Set(userIds)];

  if (ids.length === 0) {
    return new Map();
  }

  const db = requireSupabaseClient();
  const { data, error } = await db.from('users').select(USER_COLUMNS).in('id', ids);

  if (error) {
    throw error;
  }

  return new Map((data ?? []).map((user) => [(user as User).id, user as User]));
}

async function countRowsByPost(
  table: 'post_likes' | 'post_comments',
  postIds: number[],
): Promise<Map<number, number>> {
  const counts = new Map<number, number>();

  if (postIds.length === 0) {
    return counts;
  }

  const db = requireSupabaseClient();
  const { data, error } = await db.from(table).select('post_id').in('post_id', postIds);

  if (error) {
    throw error;
  }

  for (const row of (data ?? []) as { post_id: number }[]) {
    counts.set(row.post_id, (counts.get(row.post_id) ?? 0) + 1);
  }

  return counts;
}

async function getPostResponses(posts: Post[], userId?: string) {
  if (posts.length === 0) {
    return [];
  }

  const postIds = posts.map((post) => post.id);
  const promises: Promise<unknown>[] = [
    getAuthorsByUserId(posts.map((post) => post.user_id)),
    countRowsByPost('post_likes', postIds),
    countRowsByPost('post_comments', postIds),
  ];

  let userLikedPostIds: Set<number> = new Set();
  let userSavedPostIds: Set<number> = new Set();

  if (userId) {
    promises.push(
      (async () => {
        const db = requireSupabaseClient();
        const { data } = await db
          .from('post_likes')
          .select('post_id')
          .eq('user_id', userId)
          .in('post_id', postIds);
        return (data ?? []) as { post_id: number }[];
      })(),
      (async () => {
        const db = requireSupabaseClient();
        const { data } = await db
          .from('post_saves')
          .select('post_id')
          .eq('user_id', userId)
          .in('post_id', postIds);
        return (data ?? []) as { post_id: number }[];
      })(),
    );

    const [authorsByUserId, likeCounts, commentCounts, likedRows, savedRows] =
      await Promise.all(promises as [
        Promise<Map<string, User>>,
        Promise<Map<number, number>>,
        Promise<Map<number, number>>,
        Promise<{ post_id: number }[]>,
        Promise<{ post_id: number }[]>,
      ]);

    userLikedPostIds = new Set(likedRows.map((r) => r.post_id));
    userSavedPostIds = new Set(savedRows.map((r) => r.post_id));

    return posts.map((post) =>
      postResponse(
        post,
        authorsByUserId.get(post.user_id) ?? null,
        likeCounts.get(post.id) ?? 0,
        commentCounts.get(post.id) ?? 0,
        userLikedPostIds.has(post.id),
        userSavedPostIds.has(post.id),
      ),
    );
  }

  const [authorsByUserId, likeCounts, commentCounts] = await Promise.all(promises as [
    Promise<Map<string, User>>,
    Promise<Map<number, number>>,
    Promise<Map<number, number>>,
  ]);

  return posts.map((post) =>
    postResponse(
      post,
      authorsByUserId.get(post.user_id) ?? null,
      likeCounts.get(post.id) ?? 0,
      commentCounts.get(post.id) ?? 0,
      false,
      false,
    ),
  );
}

async function getPostRowOrThrow(postId: number): Promise<Post> {
  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('posts')
    .select(POST_COLUMNS)
    .eq('id', postId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new AppError(404, 'POST_NOT_FOUND', 'Post not found.');
  }

  return data as Post;
}

async function assertScheduleOwnership(userId: string, scheduleId: number): Promise<void> {
  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('schedules')
    .select('id, user_id')
    .eq('id', scheduleId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data || data.user_id !== userId) {
    throw new AppError(404, 'SCHEDULE_NOT_FOUND', 'Schedule not found.');
  }
}

export async function listFeed(pagination: OffsetPagination, userId?: string): Promise<OffsetPage<unknown>> {
  const db = requireSupabaseClient();
  const { data, error, count } = await db
    .from('posts')
    .select(POST_COLUMNS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(pagination.offset, pagination.offset + pagination.limit - 1);

  if (error) {
    throw error;
  }

  return createOffsetPage(await getPostResponses((data ?? []) as Post[], userId), count ?? 0, pagination);
}

export async function listMyPosts(
  userId: string,
  pagination: OffsetPagination,
): Promise<OffsetPage<unknown>> {
  const db = requireSupabaseClient();
  const { data, error, count } = await db
    .from('posts')
    .select(POST_COLUMNS, { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(pagination.offset, pagination.offset + pagination.limit - 1);

  if (error) {
    throw error;
  }

  return createOffsetPage(await getPostResponses((data ?? []) as Post[], userId), count ?? 0, pagination);
}

export async function createPost(userId: string, input: CreatePostInput) {
  if (input.scheduleId !== undefined) {
    await assertScheduleOwnership(userId, input.scheduleId);
  }

  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('posts')
    .insert({
      user_id: userId,
      type: input.type,
      content: input.content,
      tags: input.tags ?? [],
      schedule_id: input.scheduleId ?? null,
    })
    .select(POST_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  const post = data as Post;
  await trackActivity(userId, 'post_created', 'You shared a new post.', { postId: post.id });

  const [response] = await getPostResponses([post], userId);
  return response;
}

export async function getPost(postId: number, userId?: string) {
  const [response] = await getPostResponses([await getPostRowOrThrow(postId)], userId);
  return response;
}

export async function deletePost(userId: string, postId: number): Promise<void> {
  const post = await getPostRowOrThrow(postId);

  if (post.user_id !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'You cannot delete this post.');
  }

  const db = requireSupabaseClient();
  const { error } = await db.from('posts').delete().eq('id', postId);

  if (error) {
    throw error;
  }
}

export async function likePost(userId: string, postId: number): Promise<void> {
  const post = await getPostRowOrThrow(postId);

  const db = requireSupabaseClient();
  const { error } = await db
    .from('post_likes')
    .upsert({ post_id: postId, user_id: userId }, { onConflict: 'post_id,user_id' });

  if (error) {
    throw error;
  }

  if (post.user_id !== userId) {
    await notifyPostLiked(post.user_id, userId, postId);
  }
}

export async function unlikePost(userId: string, postId: number): Promise<void> {
  await getPostRowOrThrow(postId);

  const db = requireSupabaseClient();
  const { error } = await db
    .from('post_likes')
    .delete()
    .eq('post_id', postId)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }
}

export async function savePost(userId: string, postId: number): Promise<void> {
  await getPostRowOrThrow(postId);

  const db = requireSupabaseClient();
  const { error } = await db
    .from('post_saves')
    .upsert({ post_id: postId, user_id: userId }, { onConflict: 'post_id,user_id' });

  if (error) {
    throw error;
  }
}

export async function unsavePost(userId: string, postId: number): Promise<void> {
  await getPostRowOrThrow(postId);

  const db = requireSupabaseClient();
  const { error } = await db
    .from('post_saves')
    .delete()
    .eq('post_id', postId)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }
}

export async function getComments(
  postId: number,
  pagination: OffsetPagination,
): Promise<OffsetPage<ReturnType<typeof commentResponse>>> {
  await getPostRowOrThrow(postId);

  const db = requireSupabaseClient();
  const { data, error, count } = await db
    .from('post_comments')
    .select(`${COMMENT_COLUMNS}, users(${USER_COLUMNS})`, { count: 'exact' })
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .range(pagination.offset, pagination.offset + pagination.limit - 1);

  if (error) {
    throw error;
  }

  return createOffsetPage(
    (data ?? []).map((comment) => commentResponse(comment as PostCommentRow)),
    count ?? 0,
    pagination,
  );
}

async function getPostCommentRowOrThrow(commentId: number): Promise<PostComment> {
  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('post_comments')
    .select(COMMENT_COLUMNS)
    .eq('id', commentId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new AppError(404, 'COMMENT_NOT_FOUND', 'Comment not found.');
  }

  return data as PostComment;
}

export async function createComment(userId: string, postId: number, input: CreateCommentInput) {
  const post = await getPostRowOrThrow(postId);

  let parentCommentId: number | null = null;
  if (input.parentCommentId != null) {
    const parent = await getPostCommentRowOrThrow(input.parentCommentId);

    // A reply must belong to the same post as its parent comment.
    if (parent.post_id !== postId) {
      throw new AppError(
        400,
        'PARENT_COMMENT_MISMATCH',
        'The parent comment does not belong to this post.',
      );
    }

    // Enforce the single level of replies: a reply can never be replied to.
    if (parent.parent_comment_id != null) {
      throw new AppError(
        400,
        'REPLY_ON_REPLY_NOT_ALLOWED',
        'Replies can only be added to comments, not to other replies.',
      );
    }

    parentCommentId = parent.id;
  }

  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('post_comments')
    .insert({
      post_id: postId,
      user_id: userId,
      content: input.content,
      parent_comment_id: parentCommentId,
    })
    .select(`${COMMENT_COLUMNS}, users(${USER_COLUMNS})`)
    .single();

  if (error) {
    throw error;
  }

  const comment = data as PostCommentRow;
  await trackActivity(userId, 'post_commented', 'You commented on a post.', {
    postId,
    commentId: comment.id,
    parentCommentId,
  });

  if (post.user_id !== userId) {
    await notifyPostCommented(post.user_id, userId, postId);
  }

  return commentResponse(comment);
}

export async function deleteComment(userId: string, commentId: number): Promise<void> {
  const comment = await getPostCommentRowOrThrow(commentId);

  if (comment.user_id !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'You cannot delete this comment.');
  }

  const db = requireSupabaseClient();
  const { error } = await db.from('post_comments').delete().eq('id', commentId);

  if (error) {
    throw error;
  }
}

function myCommentResponse(comment: MyCommentRow) {
  const post = toOne(comment.posts);
  return {
    id: comment.id,
    content: comment.content,
    parentCommentId: comment.parent_comment_id,
    isReply: comment.parent_comment_id != null,
    createdAt: comment.created_at,
    post: post
      ? { id: post.id, type: post.type, content: post.content }
      : null,
  };
}

export async function listMyComments(
  userId: string,
  pagination: OffsetPagination,
): Promise<OffsetPage<ReturnType<typeof myCommentResponse>>> {
  const db = requireSupabaseClient();
  const { data, error, count } = await db
    .from('post_comments')
    .select(`${COMMENT_COLUMNS}, posts(${POST_COLUMNS})`, { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(pagination.offset, pagination.offset + pagination.limit - 1);

  if (error) {
    throw error;
  }

  return createOffsetPage(
    (data ?? []).map((comment) => myCommentResponse(comment as MyCommentRow)),
    count ?? 0,
    pagination,
  );
}
