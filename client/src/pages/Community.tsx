import { useEffect, useState } from "react";
import {
  Heart,
  MessageCircle,
  UserPlus,
  Calendar,
  TrendingUp,
  Star,
  CheckCircle,
  X,
  Search,
  Reply,
  MoreVertical,
  Trash2,
} from "lucide-react";
import {
  api,
  type Post as ApiPost,
  type FriendProfile,
  type FriendRequest,
  type PostComment,
  type StudentSearchResult,
} from "../lib/api";
import { displayName, timeAgo } from "../lib/format";
import { useAuth } from "../lib/auth";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  schedule: <Calendar size={13} />,
  review: <Star size={13} />,
  question: <MessageCircle size={13} />,
  tip: <TrendingUp size={13} />,
};

const TYPE_COLORS: Record<string, string> = {
  schedule: "#4338CA",
  review: "#F59E0B",
  question: "#059669",
  tip: "#D97706",
};

const AVATAR_COLORS = [
  "#4338CA",
  "#059669",
  "#7C3AED",
  "#D97706",
  "#0EA5E9",
  "#EC4899",
  "#6366F1",
  "#DC2626",
];

function initialsOf(
  firstName?: string | null,
  lastName?: string | null,
): string {
  return ((firstName?.[0] ?? "") + (lastName?.[0] ?? "")).toUpperCase() || "?";
}

function currentInitialsFromEmail(email?: string): string {
  const localPart = email?.split("@")[0] ?? "ST";
  return (localPart.slice(0, 2) || "ST").toUpperCase();
}

type CommentWithReplies = PostComment & { replies: PostComment[] };

function CommentAuthor({
  author,
  email,
  size,
}: {
  author: PostComment["author"];
  email?: string;
  size?: number;
}) {
  const initials = author
    ? initialsOf(author.firstName, author.lastName)
    : currentInitialsFromEmail(email);
  const px = size ?? 26;
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 font-bold"
      style={{
        width: px,
        height: px,
        background: "linear-gradient(135deg, var(--color-primary-grad, #6366F1) 0%, #8B5CF6 100%)",
        color: "white",
        fontSize: px * 0.36,
      }}
    >
      {initials || "?"}
    </div>
  );
}

function CommentsSection({
  post,
  onCommentCountChange,
}: {
  post: ApiPost;
  onCommentCountChange: (delta: number) => void;
}) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentWithReplies[]>([]);
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [postingReply, setPostingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [deleteMenuFor, setDeleteMenuFor] = useState<number | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isMine = (item: PostComment) =>
    !!item.author && !!user?.id && item.author.id === user.id;

  const renderDeleteDot = (item: PostComment, kind: "comment" | "reply") => {
    if (!isMine(item)) {
      return null;
    }
    const menuOpen = deleteMenuFor === item.id;
    return (
      <div className="relative" style={{ position: "relative" }}>
        <button
          onClick={() => {
            setDeleteMenuFor(menuOpen ? null : item.id);
            if (!menuOpen && confirmingDelete !== item.id) {
              setConfirmingDelete(null);
            }
          }}
          className="p-1 rounded-lg hover:bg-slate-100 transition-all"
          style={{ color: "#94A3B8" }}
          aria-label={`More options for this ${kind}`}
        >
          <MoreVertical size={13} />
        </button>
        {menuOpen && (
          <div
            className="absolute right-0 top-full mt-1 z-30 rounded-xl overflow-hidden"
            style={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
              minWidth: 160,
            }}
          >
            {confirmingDelete === item.id ? (
              <div className="p-3">
                <div style={{ fontSize: 12, fontWeight: 700, color: "#1E293B", marginBottom: 8 }}>
                  Delete this {kind}?
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setDeleteMenuFor(null);
                      void removeComment(item.id);
                    }}
                    disabled={deleting}
                    className="flex-1 rounded-lg px-2 py-1.5 font-semibold"
                    style={{ fontSize: 11, background: "#DC2626", color: "white" }}
                  >
                    {deleting ? "Deleting..." : "Delete"}
                  </button>
                  <button
                    onClick={() => setConfirmingDelete(null)}
                    className="flex-1 rounded-lg px-2 py-1.5 font-semibold"
                    style={{ fontSize: 11, background: "#F1F5F9", color: "#64748B" }}
                  >
                    Cancel
                  </button>
                </div>
                {deleteError && (
                  <div style={{ fontSize: 10, color: "#B91C1C", marginTop: 6 }}>
                    {deleteError}
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setConfirmingDelete(item.id)}
                className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 transition-all"
                style={{ fontSize: 12, fontWeight: 600, color: "#DC2626" }}
              >
                <Trash2 size={13} />
                Delete {kind}
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.feed.comments(post.id, 1, 100);
      const nodes = new Map<number, CommentWithReplies>();
      for (const c of res.data) {
        nodes.set(c.id, { ...c, replies: [] });
      }
      const top: CommentWithReplies[] = [];
      for (const c of res.data) {
        const node = nodes.get(c.id)!;
        if (c.parentCommentId != null && nodes.has(c.parentCommentId)) {
          nodes.get(c.parentCommentId)!.replies.push(node);
        } else {
          top.push(node);
        }
      }
      setComments(top);
      setLoaded(true);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Could not load comments.",
      );
    } finally {
      setLoading(false);
    }
  }

  function toggleExpanded() {
    setExpanded((prev) => {
      const next = !prev;
      if (next && !loaded) {
        void load();
      }
      return next;
    });
  }

  async function submitComment() {
    const content = commentText.trim();
    if (!content || postingComment) {
      return;
    }
    setPostingComment(true);
    setCommentError(null);
    try {
      const { data: created } = await api.feed.createComment(post.id, content);
      setComments((prev) => [...prev, { ...created, replies: [] }]);
      setCommentText("");
      onCommentCountChange(1);
    } catch (err) {
      setCommentError(
        err instanceof Error ? err.message : "Could not add comment.",
      );
    } finally {
      setPostingComment(false);
    }
  }

  async function submitReply(parentId: number) {
    const content = replyText.trim();
    if (!content || postingReply) {
      return;
    }
    setPostingReply(true);
    setReplyError(null);
    try {
      const { data: created } = await api.feed.createComment(
        post.id,
        content,
        parentId,
      );
      setComments((prev) =>
        prev.map((c) =>
          c.id === parentId ? { ...c, replies: [...c.replies, created] } : c,
        ),
      );
      setReplyText("");
      setReplyingTo(null);
      onCommentCountChange(1);
    } catch (err) {
      setReplyError(
        err instanceof Error ? err.message : "Could not add reply.",
      );
    } finally {
      setPostingReply(false);
    }
  }

  async function removeComment(id: number) {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.feed.deleteComment(id);
      setComments((prev) => {
        let removed = 0;
        const next = prev
          .map((c) => {
            if (c.id === id) {
              removed += 1 + c.replies.length;
              return null;
            }
            const before = c.replies.length;
            c.replies = c.replies.filter((r) => r.id !== id);
            removed += before - c.replies.length;
            return c;
          })
          .filter((c): c is CommentWithReplies => c !== null);
        onCommentCountChange(-removed);
        return next;
      });
      setDeleteMenuFor(null);
      setConfirmingDelete(null);
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Could not delete.",
      );
    } finally {
      setDeleting(false);
    }
  }

  const renderReplyForm = (parentId: number) =>
    replyingTo === parentId ? (
      <div className="mt-2 flex gap-2 items-start">
        <div className="flex-1">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Write a reply..."
            rows={2}
            className="w-full rounded-xl p-2.5 outline-none resize-none"
            style={{
              fontSize: 12,
              border: "1px solid #E2E8F0",
              background: "#FFFFFF",
              color: "#374151",
            }}
            autoFocus
          />
          {replyError && (
            <div style={{ fontSize: 11, color: "#B91C1C", marginTop: 4 }}>
              {replyError}
            </div>
          )}
          <div className="flex gap-2 mt-1.5">
            <button
              onClick={() => void submitReply(parentId)}
              disabled={!replyText.trim() || postingReply}
              className="px-3 py-1 rounded-lg font-semibold"
              style={{
                fontSize: 11,
                background: replyText.trim() ? "var(--color-primary, #4338CA)" : "#E2E8F0",
                color: replyText.trim() ? "white" : "#94A3B8",
              }}
            >
              {postingReply ? "Posting..." : "Reply"}
            </button>
            <button
              onClick={() => {
                setReplyingTo(null);
                setReplyError(null);
              }}
              className="px-2 py-1 rounded-lg"
              style={{ fontSize: 11, color: "#64748B" }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <div
      style={{
        borderTop: "1px solid #F8FAFC",
        padding: "12px 16px",
      }}
    >
      <button
        onClick={toggleExpanded}
        className="flex items-center gap-1.5 text-xs font-semibold transition-all"
        style={{ color: "#64748B" }}
      >
        <MessageCircle size={14} />
        <span>
          {expanded ? "Hide comments" : `Comments (${post.commentCount})`}
        </span>
      </button>

      {expanded && (
        <div className="mt-3 flex flex-col gap-1">
          {loading && (
            <div style={{ fontSize: 12, color: "#94A3B8", padding: "8px 0" }}>
              Loading comments...
            </div>
          )}
          {loadError && (
            <div
              className="rounded-xl px-3 py-2"
              style={{
                background: "#FEF2F2",
                border: "1px solid #FECACA",
                fontSize: 12,
                color: "#B91C1C",
              }}
            >
              {loadError}
            </div>
          )}
          {!loading && !loadError && (
            <>
              {/* Add comment */}
              <div className="flex gap-2 items-start">
                <CommentAuthor author={null} email={user?.email} size={28} />
                <div className="flex-1">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment..."
                    rows={2}
                    className="w-full rounded-xl p-2.5 outline-none resize-none"
                    style={{
                      fontSize: 12,
                      border: "1px solid #E2E8F0",
                      background: "#F8FAFC",
                      color: "#374151",
                    }}
                  />
                  {commentError && (
                    <div style={{ fontSize: 11, color: "#B91C1C", marginTop: 4 }}>
                      {commentError}
                    </div>
                  )}
                  <div className="flex justify-end mt-1.5">
                    <button
                      onClick={() => void submitComment()}
                      disabled={!commentText.trim() || postingComment}
                      className="px-3 py-1 rounded-lg font-semibold"
                      style={{
                        fontSize: 11,
                        background: commentText.trim() ? "var(--color-primary, #4338CA)" : "#E2E8F0",
                        color: commentText.trim() ? "white" : "#94A3B8",
                      }}
                    >
                      {postingComment ? "Posting..." : "Post"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Comments + replies */}
              {comments.length === 0 ? (
                <div style={{ fontSize: 12, color: "#94A3B8", padding: "8px 0" }}>
                  No comments yet. Be the first to comment.
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="mt-2">
                    {/* Comment (replies allowed) */}
                    <div className="flex gap-2 items-start">
                      <CommentAuthor author={comment.author} size={28} />
                      <div className="flex-1 min-w-0">
                        <div
                          className="rounded-xl px-3 py-2"
                          style={{
                            background: "#F8FAFC",
                            border: "1px solid #F1F5F9",
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div style={{ fontSize: 12, fontWeight: 700, color: "#1E293B" }}>
                                {comment.author
                                  ? displayName(comment.author.firstName, comment.author.lastName)
                                  : "You"}
                              </div>
                              <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.6 }}>
                                {comment.content}
                              </div>
                            </div>
                            {renderDeleteDot(comment, "comment")}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span style={{ fontSize: 10, color: "#94A3B8" }}>
                            {timeAgo(comment.createdAt)}
                          </span>
                          <button
                            onClick={() => {
                              setReplyingTo(replyingTo === comment.id ? null : comment.id);
                              setReplyError(null);
                            }}
                            className="flex items-center gap-1 text-xs font-semibold transition-all"
                            style={{ color: "#4338CA" }}
                          >
                            <Reply size={11} />
                            Reply
                          </button>
                        </div>
                        {renderReplyForm(comment.id)}
                      </div>
                    </div>

                    {/* Replies (no Reply action allowed) */}
                    {comment.replies.length > 0 && (
                      <div
                        className="ml-8 mt-2 flex flex-col gap-2"
                        style={{ borderLeft: "2px solid #EEF2FF", paddingLeft: 12 }}
                      >
                        {comment.replies.map((reply) => (
                          <div key={reply.id} className="flex gap-2 items-start">
                            <CommentAuthor author={reply.author} size={24} />
                            <div className="flex-1 min-w-0">
                              <div
                                className="rounded-xl px-3 py-2"
                                style={{
                                  background: "#F8FAFC",
                                  border: "1px solid #F1F5F9",
                                }}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div style={{ fontSize: 12, fontWeight: 700, color: "#1E293B" }}>
                                      {reply.author
                                        ? displayName(reply.author.firstName, reply.author.lastName)
                                        : "You"}
                                    </div>
                                    <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.6 }}>
                                      {reply.content}
                                    </div>
                                  </div>
                                  {renderDeleteDot(reply, "reply")}
                                </div>
                              </div>
                              <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>
                                {timeAgo(reply.createdAt)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PostCard({
  post,
}: {
  post: ApiPost;
}) {
  const [liked, setLiked] = useState(post.isLikedByCurrentUser);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [commentCount, setCommentCount] = useState(post.commentCount);

  const toggleLike = async () => {
    const next = !liked;
    setLiked(next);
    setLikeCount((p) => p + (next ? 1 : -1));
    try {
      if (next) {
        await api.feed.like(post.id);
      } else {
        await api.feed.unlike(post.id);
      }
    } catch {
      setLiked(!next);
      setLikeCount((p) => p + (next ? -1 : 1));
    }
  };

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all"
      style={{
        background: "#FFFFFF",
        border: "1px solid #F1F5F9",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-4 pb-3">
        <div
          className="rounded-full flex items-center justify-center shrink-0 font-bold"
          style={{
            width: 40,
            height: 40,
            background: "linear-gradient(135deg, var(--color-primary-grad, #6366F1) 0%, #8B5CF6 100%)",
            color: "white",
            fontSize: 14,
          }}
        >
          {initialsOf(post.author?.firstName, post.author?.lastName) || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{ fontSize: 14, fontWeight: 700, color: "#1E293B" }}>
              {displayName(post.author?.firstName, post.author?.lastName)}
            </span>
          </div>
          <div style={{ fontSize: 11, color: "#94A3B8" }}>
            {[post.author?.major, post.author?.level]
              .filter(Boolean)
              .join(" · ") || "AUB Student"}{" "}
            · {timeAgo(post.createdAt)}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="flex items-center gap-1 rounded-full px-2 py-1"
            style={{
              background: TYPE_COLORS[post.type] + "15",
              color: TYPE_COLORS[post.type],
            }}
          >
            {TYPE_ICONS[post.type]}
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: "capitalize",
              }}
            >
              {post.type}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-3">
        <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.7 }}>
          {post.content}
        </p>
      </div>

      {/* Actions */}
      <div
        className="flex items-center gap-1 px-4 py-3"
        style={{ borderTop: "1px solid #F8FAFC" }}
      >
        <button
          onClick={() => void toggleLike()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all"
          style={{
            color: liked ? "#EF4444" : "#64748B",
            background: liked ? "#FEF2F2" : "transparent",
            fontSize: 12,
            fontWeight: liked ? 700 : 500,
          }}
        >
          <Heart size={14} fill={liked ? "#EF4444" : "none"} /> {likeCount}
        </button>
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
          style={{ color: "#64748B", fontSize: 12, fontWeight: 500 }}
        >
          <MessageCircle size={14} /> {commentCount}
        </div>
        <div className="flex-1" />
      </div>

      <CommentsSection
        post={post}
        onCommentCountChange={(delta) =>
          setCommentCount((p) => Math.max(0, p + delta))
        }
      />
    </div>
  );
}

export default function Community() {
  const { user } = useAuth();
  const [activeCompose, setActiveCompose] = useState(false);
  const [composeText, setComposeText] = useState("");
  const [composeType, setComposeType] = useState<
    "schedule" | "tip" | "review" | "question"
  >("schedule");
  const [posting, setPosting] = useState(false);
  const [posts, setPosts] = useState<ApiPost[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [suggested, setSuggested] = useState<FriendProfile[]>([]);
  const [studentQuery, setStudentQuery] = useState("");
  const [studentResults, setStudentResults] = useState<StudentSearchResult[]>([]);
  const [studentSearchLoading, setStudentSearchLoading] = useState(false);
  const [studentSearchError, setStudentSearchError] = useState<string | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [error, setError] = useState<string | null>(null);

  const localPart = user?.email ? (user.email.split("@")[0] ?? "ST") : "ST";
  const currentUserInitials = (localPart.slice(0, 2) || "ST").toUpperCase();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [
          feedRes,
          friendsRes,
          suggestedRes,
          requestsRes,
        ] = await Promise.all([
          api.feed.list(1, 20),
          api.friends.list(),
          api.friends.suggested(10),
          api.friends.requests(),
        ]);

        if (cancelled) {
          return;
        }

        setPosts(feedRes.data);
        setFriends(friendsRes.data);
        setSuggested(suggestedRes.data);
        setIncomingRequests(requestsRes.data.incoming);
        setOutgoingRequests(requestsRes.data.outgoing);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load community data.",
          );
        }
      } finally {
        if (!cancelled) {
          setFeedLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const query = studentQuery.trim();
    if (query.length < 2) {
      setStudentResults([]);
      setStudentSearchLoading(false);
      setStudentSearchError(null);
      return;
    }

    let cancelled = false;
    setStudentSearchLoading(true);
    setStudentSearchError(null);
    const timer = window.setTimeout(() => {
      api.friends
        .search(query)
        .then((response) => {
          if (!cancelled) setStudentResults(response.data);
        })
        .catch((err) => {
          if (!cancelled) {
            setStudentResults([]);
            setStudentSearchError(err instanceof Error ? err.message : "Could not search students.");
          }
        })
        .finally(() => {
          if (!cancelled) setStudentSearchLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [studentQuery]);

  async function sendRequest(userId: string) {
    try {
      await api.friends.sendRequest(userId);
      setSuggested((prev) => prev.filter((s) => s.id !== userId));
      setStudentResults((prev) =>
        prev.map((student) =>
          student.id === userId ? { ...student, relationship: "request_sent" } : student,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not send friend request.",
      );
    }
  }

  async function acceptRequest(userId: string) {
    try {
      await api.friends.acceptRequest(userId);
      setIncomingRequests((prev) => prev.filter((r) => r.user.id !== userId));
      const friendsRes = await api.friends.list();
      setFriends(friendsRes.data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not accept friend request.",
      );
    }
  }

  async function rejectRequest(userId: string) {
    try {
      await api.friends.rejectRequest(userId);
      setIncomingRequests((prev) => prev.filter((r) => r.user.id !== userId));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not reject friend request.",
      );
    }
  }

  async function cancelRequest(userId: string) {
    try {
      await api.friends.remove(userId);
      setOutgoingRequests((prev) => prev.filter((r) => r.user.id !== userId));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not cancel friend request.",
      );
    }
  }

  async function submitPost() {
    const content = composeText.trim();
    if (!content || posting) {
      return;
    }
    setPosting(true);
    try {
      const { data: created } = await api.feed.create({
        type: composeType,
        content,
      });
      setPosts((prev) => [created, ...prev]);
      setComposeText("");
      setActiveCompose(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not share post.");
    } finally {
      setPosting(false);
    }
  }

  const friendColor = (id: string, index: number) => {
    const hash = id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return AVATAR_COLORS[(index + hash) % AVATAR_COLORS.length];
  };

  return (
    <div
      className="flex h-full overflow-hidden"
      style={{ background: "#F8FAFC" }}
    >
      {/* Left: Friends list */}
      <aside
        className="flex flex-col shrink-0 h-full overflow-y-auto"
        style={{
          width: 232,
          background: "#FFFFFF",
          borderRight: "1px solid #F1F5F9",
        }}
      >
        <div
          className="px-4 py-3"
          style={{ borderBottom: "1px solid #F1F5F9" }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#0F172A",
              marginBottom: 2,
            }}
          >
            Friends
          </div>
          <div style={{ fontSize: 11, color: "#94A3B8" }}>
            {friends.length} friend{friends.length === 1 ? "" : "s"}
          </div>
          <div className="flex items-center gap-2 rounded-lg px-2.5 py-2 mt-3" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
            <Search size={13} color="#94A3B8" />
            <input value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} placeholder="Search by name or AUB email..." className="min-w-0 flex-1 bg-transparent outline-none" style={{ fontSize: 10, color: "#1E293B" }} />
          </div>
          {studentSearchLoading && <div style={{ fontSize: 10, color: "#94A3B8", padding: "6px 2px" }}>Searching...</div>}
          {studentSearchError && <div style={{ fontSize: 10, color: "#B91C1C", padding: "6px 2px" }}>{studentSearchError}</div>}
          {studentResults.map((student, index) => (
            <div key={student.id} className="flex items-center gap-2 px-2 py-2 rounded-xl" style={{ background: "#F8FAFC", marginTop: 4 }}>
              <div className="rounded-full flex items-center justify-center shrink-0" style={{ width: 30, height: 30, background: friendColor(student.id, index) + "20", color: friendColor(student.id, index), fontSize: 10, fontWeight: 700 }}>{initialsOf(student.firstName, student.lastName)}</div>
              <div className="flex-1 min-w-0"><div className="truncate" style={{ fontSize: 11, fontWeight: 600, color: "#1E293B" }}>{displayName(student.firstName, student.lastName)}</div><div className="truncate" style={{ fontSize: 9, color: "#94A3B8" }}>{[student.major, student.level].filter(Boolean).join(" · ") || "AUB Student"}</div></div>
              {student.relationship === "none" && <button onClick={() => void sendRequest(student.id)} className="rounded-md px-2 py-1" style={{ fontSize: 9, fontWeight: 700, color: "var(--color-primary, #4338CA)", background: "var(--color-primary-light, #EEF2FF)" }}>Add</button>}
              {student.relationship === "self" && <span style={{ fontSize: 9, color: "#94A3B8" }}>You</span>}
              {student.relationship === "friends" && <span style={{ fontSize: 9, color: "#059669" }}>Friends</span>}
              {student.relationship === "request_sent" && <span style={{ fontSize: 9, color: "#D97706" }}>Sent</span>}
              {student.relationship === "request_received" && <div className="flex gap-1"><button title="Accept" onClick={() => void acceptRequest(student.id)} style={{ color: "#059669" }}><CheckCircle size={12} /></button><button title="Decline" onClick={() => void rejectRequest(student.id)} style={{ color: "#DC2626" }}><X size={12} /></button></div>}
            </div>
          ))}
        </div>

        <div className="px-3 py-3 flex-1">
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#94A3B8",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 6,
              paddingLeft: 4,
            }}
          >
            Friends
          </div>
          {friends.map((f, i) => (
            <button
              key={f.id}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors"
              style={{ textAlign: "left" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#F8FAFC";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <div className="shrink-0">
                <div
                  className="rounded-full flex items-center justify-center"
                  style={{
                    width: 32,
                    height: 32,
                    background: friendColor(f.id, i) + "20",
                    color: friendColor(f.id, i),
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {initialsOf(f.firstName, f.lastName) || "?"}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#1E293B",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {displayName(f.firstName, f.lastName)}
                </div>
                <div style={{ fontSize: 10, color: "#94A3B8" }}>
                  {[f.major, f.level].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
            </button>
          ))}
          {friends.length === 0 && !feedLoading && (
            <div style={{ fontSize: 11, color: "#94A3B8", paddingLeft: 4 }}>
              No friends yet. Search for AUB students above.
            </div>
          )}

          <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6, paddingLeft: 4, marginTop: 14 }}>Pending Requests ({incomingRequests.length})</div>
          {incomingRequests.map((request, index) => <div key={request.id} className="flex items-center gap-2 px-2 py-2 rounded-xl mb-1" style={{ background: "#F8FAFC" }}>
            <div className="rounded-full flex items-center justify-center shrink-0" style={{ width: 30, height: 30, background: friendColor(request.user.id, index) + "20", color: friendColor(request.user.id, index), fontSize: 10, fontWeight: 700 }}>{initialsOf(request.user.firstName, request.user.lastName)}</div>
            <div className="flex-1 min-w-0"><div className="truncate" style={{ fontSize: 11, fontWeight: 600, color: "#1E293B" }}>{displayName(request.user.firstName, request.user.lastName)}</div><div className="truncate" style={{ fontSize: 9, color: "#94A3B8" }}>{[request.user.major, request.user.level].filter(Boolean).join(" · ") || "AUB Student"}</div></div>
            <button title="Accept" onClick={() => void acceptRequest(request.user.id)} className="rounded-full p-1" style={{ background: "var(--color-primary-light, #EEF2FF)", color: "var(--color-primary, #4338CA)" }}><CheckCircle size={12} /></button>
            <button title="Decline" onClick={() => void rejectRequest(request.user.id)} className="rounded-full p-1" style={{ background: "#FEF2F2", color: "#DC2626" }}><X size={12} /></button>
          </div>)}
          {incomingRequests.length === 0 && <div style={{ fontSize: 10, color: "#94A3B8", paddingLeft: 4 }}>No pending requests.</div>}

          <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6, paddingLeft: 4, marginTop: 14 }}>Sent Requests ({outgoingRequests.length})</div>
          {outgoingRequests.map((request, index) => <div key={request.id} className="flex items-center gap-2 px-2 py-2 rounded-xl mb-1" style={{ background: "#F8FAFC" }}>
            <div className="rounded-full flex items-center justify-center shrink-0" style={{ width: 30, height: 30, background: friendColor(request.user.id, index) + "20", color: friendColor(request.user.id, index), fontSize: 10, fontWeight: 700 }}>{initialsOf(request.user.firstName, request.user.lastName)}</div>
            <div className="flex-1 min-w-0"><div className="truncate" style={{ fontSize: 11, fontWeight: 600, color: "#1E293B" }}>{displayName(request.user.firstName, request.user.lastName)}</div><div className="truncate" style={{ fontSize: 9, color: "#94A3B8" }}>{[request.user.major, request.user.level].filter(Boolean).join(" · ") || "AUB Student"}</div></div>
            <button title="Cancel request" onClick={() => void cancelRequest(request.user.id)} className="rounded-full p-1" style={{ background: "#FEF2F2", color: "#DC2626" }}><X size={12} /></button>
          </div>)}
          {outgoingRequests.length === 0 && <div style={{ fontSize: 10, color: "#94A3B8", paddingLeft: 4 }}>No sent requests.</div>}

          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#94A3B8",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 6,
              paddingLeft: 4,
              marginTop: 12,
            }}
          >
            Suggested
          </div>
          {suggested.map((s, i) => (
            <div
              key={s.id}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
              style={{ background: "#F8FAFC", marginBottom: 4 }}
            >
              <div
                className="rounded-full flex items-center justify-center shrink-0"
                style={{
                  width: 32,
                  height: 32,
                  background: friendColor(s.id, i) + "20",
                  color: friendColor(s.id, i),
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {initialsOf(s.firstName, s.lastName) || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  style={{ fontSize: 12, fontWeight: 600, color: "#1E293B" }}
                >
                  {displayName(s.firstName, s.lastName)}
                </div>
                <div style={{ fontSize: 10, color: "#94A3B8" }}>
                  {[s.major, s.level].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
              <button
                onClick={() => void sendRequest(s.id)}
                style={{ color: "var(--color-primary, #4338CA)" }}
              >
                <UserPlus size={14} />
              </button>
            </div>
          ))}
          {suggested.length === 0 && !feedLoading && (
            <div style={{ fontSize: 11, color: "#94A3B8", paddingLeft: 4 }}>
              No suggestions right now.
            </div>
          )}
        </div>
      </aside>

      {/* Center: Feed */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-5 flex flex-col gap-4">
          {error && (
            <div
              className="rounded-xl px-4 py-3"
              style={{
                background: "#FEF2F2",
                border: "1px solid #FECACA",
                fontSize: 12,
                fontWeight: 600,
                color: "#B91C1C",
              }}
            >
              {error}
            </div>
          )}

          {/* Compose */}
          <div
            className="rounded-2xl p-4"
            style={{
              background: "#FFFFFF",
              border: "1px solid #F1F5F9",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="rounded-full flex items-center justify-center shrink-0"
                style={{
                  width: 36,
                  height: 36,
                  background:
                    "linear-gradient(135deg, var(--color-primary-grad, #6366F1) 0%, #8B5CF6 100%)",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "white",
                }}
              >
                {currentUserInitials}
              </div>
              <button
                onClick={() => setActiveCompose(true)}
                className="flex-1 rounded-xl px-4 py-2.5 text-left transition-colors"
                style={{
                  fontSize: 13,
                  color: "#94A3B8",
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.border = "1px solid var(--color-primary-border, #C7D2FE)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.border = "1px solid #E2E8F0";
                }}
              >
                Share a schedule, tip, or question...
              </button>
            </div>
            {activeCompose && (
              <div>
                <textarea
                  value={composeText}
                  onChange={(e) => setComposeText(e.target.value)}
                  placeholder="What's on your mind? Share a schedule tip, course review, or question..."
                  className="w-full rounded-xl p-3 outline-none resize-none"
                  rows={3}
                  style={{
                    fontSize: 13,
                    border: "1px solid #E2E8F0",
                    background: "#F8FAFC",
                    color: "#374151",
                  }}
                  autoFocus
                />
                <div className="flex items-center justify-between mt-2">
                  <div className="flex gap-1.5">
                    {(["schedule", "tip", "review", "question"] as const).map(
                      (type) => (
                        <button
                          key={type}
                          onClick={() => setComposeType(type)}
                          className="rounded-full px-2.5 py-1"
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            background:
                              composeType === type ? "var(--color-primary-light, #EEF2FF)" : "#F1F5F9",
                            color: composeType === type ? "var(--color-primary, #4338CA)" : "#64748B",
                            textTransform: "capitalize",
                          }}
                        >
                          {type}
                        </button>
                      ),
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setActiveCompose(false)}
                      className="px-3 py-1.5 rounded-lg"
                      style={{ fontSize: 12, color: "#64748B" }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => void submitPost()}
                      disabled={!composeText.trim() || posting}
                      className="px-4 py-1.5 rounded-lg font-semibold"
                      style={{
                        fontSize: 12,
                        background: composeText.trim() ? "var(--color-primary, #4338CA)" : "#E2E8F0",
                        color: composeText.trim() ? "white" : "#94A3B8",
                      }}
                    >
                      {posting ? "Posting..." : "Post"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Posts */}
          {feedLoading && (
            <div
              style={{
                fontSize: 13,
                color: "#94A3B8",
                textAlign: "center",
                padding: "24px 0",
              }}
            >
              Loading feed...
            </div>
          )}
          {!feedLoading && posts.length === 0 && (
            <div
              style={{
                fontSize: 13,
                color: "#94A3B8",
                textAlign: "center",
                padding: "24px 0",
              }}
            >
              No posts yet. Share something!
            </div>
          )}
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
