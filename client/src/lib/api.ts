import type { AttributeOption, CourseOption, OptimizeScheduleRequest, OptimizeScheduleResult, SelectedSection, TermOption } from './scheduleOptimizer'

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api'

const ACCESS_TOKEN_KEY = 'logicflow.access_token'
const REFRESH_TOKEN_KEY = 'logicflow.refresh_token'

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

const memoryTokens: Record<string, string> = {}

function storageGet(key: string): string | null {
  try {
    const value = localStorage.getItem(key)
    return value ?? memoryTokens[key] ?? null
  } catch {
    return memoryTokens[key] ?? null
  }
}

function storageSet(key: string, value: string): void {
  memoryTokens[key] = value
  try {
    localStorage.setItem(key, value)
  } catch {
    // storage unavailable (e.g. sandboxed preview iframe); memory fallback is active
  }
}

function storageRemove(key: string): void {
  delete memoryTokens[key]
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

export function getAccessToken(): string | null {
  return storageGet(ACCESS_TOKEN_KEY)
}

export function getRefreshToken(): string | null {
  return storageGet(REFRESH_TOKEN_KEY)
}

export function setAuthTokens(accessToken?: string, refreshToken?: string): void {
  if (accessToken) {
    storageSet(ACCESS_TOKEN_KEY, accessToken)
  }
  if (refreshToken) {
    storageSet(REFRESH_TOKEN_KEY, refreshToken)
  }
}

export function clearAuthTokens(): void {
  storageRemove(ACCESS_TOKEN_KEY)
  storageRemove(REFRESH_TOKEN_KEY)
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  auth?: boolean
  body?: unknown
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = true, body, headers, ...rest } = options
  const token = getAccessToken()

  const response = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers as Record<string, string> | undefined),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (!response.ok) {
    let code = 'UNKNOWN_ERROR'
    let message = `Request failed with status ${response.status}.`
    try {
      const payload = (await response.json()) as { error?: { code?: string; message?: string } }
      code = payload.error?.code ?? code
      message = payload.error?.message ?? message
    } catch {
      // response body was not JSON
    }
    throw new ApiError(response.status, code, message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export type Pagination = {
  page: number
  limit: number
  offset: number
  total: number
  totalPages: number
}

export type Page<T> = {
  data: T[]
  pagination: Pagination
}

export type AuthUser = { id: string; email: string }
export type AuthTokens = { accessToken: string; refreshToken: string }
export type AuthResponse = { user: AuthUser; tokens?: AuthTokens }

export type DashboardStats = {
  creditsEnrolled: number
  savedSchedules: number
  coursesReviewed: number
  friendCount: number
  friendsOnline: number
}

export type CampusEvent = {
  id: number
  title: string
  type: string | null
  starts_at: string
  ends_at: string | null
  description: string | null
  location: string | null
  term_id: number | null
}

export type Activity = {
  id: number
  actor_id: string
  type: string
  message: string
  data: unknown
  created_at: string
}

export type CourseSummary = {
  id: number
  code: string
  title: string
  department: string | null
  college: string | null
  level: string | null
  credits: string
  attributes: string[]
  enrolledCount: number
  reviewCount: number
  averageRating: number | null
  averageDifficulty: number | null
  averageWorkload: number | null
  wouldRetakePercentage: number | null
  /** Professors teaching this course in the requested term (present when termId is supplied). */
  professors?: { id: number; first_name: string; last_name: string }[]
}

export type SectionMeeting = {
  id: number
  monday: boolean
  tuesday: boolean
  wednesday: boolean
  thursday: boolean
  friday: boolean
  saturday: boolean
  sunday: boolean
  start_time: string | null
  end_time: string | null
  building: string | null
  room: string | null
  meeting_type: string | null
}

export type CourseSection = {
  id: number
  course_id: number
  section_number: string
  room: string | null
  days: string
  start_time: string | null
  end_time: string | null
  seats_total: number | null
  seats_remaining: number | null
  link_identifier: string | null
  schedule_type: string | null
  meeting_schedule_type: string | null
  professors?: { id: number; first_name: string; last_name: string } | null
  section_meetings?: SectionMeeting[]
}

export type GradeDistributionRow = {
  grade: string
  percentage: number | null
  term_id: number | null
}

export type CourseReview = {
  id: number
  rating: number
  difficulty: number | null
  workload: number | null
  wouldRetake: boolean | null
  comment: string | null
  createdAt: string
  author: { id: string; firstName: string; lastName: string } | null
}

export type CourseReviewStats = {
  reviewCount: number
  averageRating: number | null
  averageDifficulty: number | null
  averageWorkload: number | null
  gradeDistribution: GradeDistributionRow[]
}

export type ProfessorSummary = {
  id: number
  firstName: string
  lastName: string
  department: string | null
  title: string | null
  reviewCount: number
  averageRating: number | null
  averageDifficulty: number | null
  wouldRetakePercentage: number | null
}

export type ProfessorReview = {
  id: number
  rating: number
  difficulty: number | null
  wouldRetake: boolean | null
  comment: string | null
  createdAt: string
  author: { id: string; firstName: string; lastName: string } | null
}

export type ScheduleCourseMeeting = {
  id: number
  days: number[]
  startTime: string | null
  endTime: string | null
  startMinutes: number | null
  endMinutes: number | null
  durationMinutes: number | null
  building: string | null
  room: string | null
  meetingType: string | null
}

export type ScheduleCourse = {
  courseId: number | null
  code: string | null
  title: string | null
  credits: number
  section: {
    id: number
    sectionNumber: string
    room: string | null
    days: number[]
    startTime: string | null
    endTime: string | null
    startMinutes: number | null
    endMinutes: number | null
    durationMinutes: number | null
    seatsTotal: number | null
    seatsRemaining: number | null
    linkIdentifier: string | null
    scheduleType: string | null
    meetings: ScheduleCourseMeeting[]
  }
  professor: { id: number; firstName: string; lastName: string } | null
}

export type ScheduleSummary = {
  id: number
  name: string | null
  notes: string | null
  termId: number | null
  saved: boolean
  isFavorite: boolean
  createdAt: string
  updatedAt: string
  courseCount: number
  totalCredits: number
  days: number[]
}

export type ScheduleDetail = ScheduleSummary & {
  courses: ScheduleCourse[]
}

export type ScheduleConflict = {
  type: 'time'
  days: number[]
  message: string
  sections: {
    sectionId: number
    courseId: number | null
    code: string | null
    sectionNumber: string
    startTime: string | null
    endTime: string | null
  }[]
}

export type ScheduleConflicts = {
  scheduleId: number
  conflictCount: number
  conflicts: ScheduleConflict[]
}

export type ScheduleComparison = {
  schedules: ScheduleSummary[]
  sharedCourses: { code: string | null; title: string | null }[]
  onlyInFirst: { code: string | null; title: string | null }[]
  onlyInSecond: { code: string | null; title: string | null }[]
}

export type PostType = 'schedule' | 'review' | 'question' | 'tip'

export type PostAuthor = {
  id: string
  firstName: string | null
  lastName: string | null
  major: string | null
  level: string | null
}

export type Post = {
  id: number
  type: PostType
  content: string
  tags: string[] | null
  scheduleId: number | null
  createdAt: string
  author: PostAuthor | null
  likeCount: number
  commentCount: number
  isLikedByCurrentUser: boolean
  isSavedByCurrentUser: boolean
}

export type PostComment = {
  id: number
  postId: number
  content: string
  parentCommentId: number | null
  createdAt: string
  author: PostAuthor | null
}

export type MyComment = {
  id: number
  content: string
  parentCommentId: number | null
  isReply: boolean
  createdAt: string
  post: { id: number; type: string; content: string } | null
}

export type FriendProfile = {
  id: string
  firstName: string | null
  lastName: string | null
  major: string | null
  level: string | null
  presenceStatus: string
  lastSeenAt: string | null
}

export type FriendRequest = {
  id: number
  createdAt: string
  user: FriendProfile
}

export type FriendRequests = {
  incoming: FriendRequest[]
  outgoing: FriendRequest[]
}

export type StudentSearchResult = FriendProfile & {
  relationship: 'self' | 'friends' | 'request_sent' | 'request_received' | 'none'
}

export type FreeTimeDay = {
  day: number
  label: string
  freePercentage: number
}

export type CommonFreeSlots = {
  day: number
  label: string
  startHour: number
  endHour: number
}

export type CommonFreeTime = {
  friendCount: number
  days: FreeTimeDay[]
  commonFreeSlots: CommonFreeSlots[]
}

export type UserProfile = {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
  major: string | null
  level: string | null
  profileVisibility?: 'public' | 'friends' | 'private'
}

export type UserStats = {
  courseReviewCount: number
  professorReviewCount: number
  friendCount: number
  scheduleCount: number
}

export type UserReview = {
  id: number
  type: 'course' | 'professor'
  rating: number
  difficulty: number | null
  workload: number | null
  comment: string | null
  createdAt: string
  course: { id: number; title: string } | null
  professor: { id: number; firstName: string; lastName: string } | null
}

export type Notification = {
  id: number
  type: string
  message: string
  data: Record<string, unknown>
  actor: { id: string; firstName: string | null; lastName: string | null } | null
  read: boolean
  createdAt: string
}

export type NotificationPreferences = {
  friendRequests: boolean
  friendAcceptances: boolean
  postLikes: boolean
  postComments: boolean
  reviewLikes: boolean
  scheduleShares: boolean
  registrationReminders: boolean
}

export type StudyGroupMeeting = {
  days: number[]
  startTime: string | null
  endTime: string | null
}

export type StudyGroupRole = 'owner' | 'member' | 'pending' | 'none'

export type StudyGroupSummary = {
  id: number
  name: string
  course: { id: number; code: string; title: string } | null
  bio: string | null
  owner: { id: string; firstName: string | null; lastName: string | null } | null
  memberCount: number
  createdAt: string
  meeting: StudyGroupMeeting | null
  role: StudyGroupRole
  joined: boolean
  requested: boolean
  /** Number of pending join requests. Only present for the group owner. */
  pendingRequestCount?: number
}

export type StudyGroupDetail = StudyGroupSummary & {
  members: {
    id: string
    firstName: string | null
    lastName: string | null
    joinedAt: string | null
  }[]
}

export type StudyGroupJoinRequest = {
  userId: string
  user: { id: string; firstName: string | null; lastName: string | null } | null
  createdAt: string
}

export type StudyGroupMessage = {
  id: number
  studyGroupId: number
  sender: { id: string; firstName: string | null; lastName: string | null } | null
  content: string
  createdAt: string
}

export type ChatHistoryPage = {
  data: StudyGroupMessage[]
  hasMore: boolean
  nextCursor: string | null
}

export type CreateStudyGroupInput = {
  name: string
  courseId: number
  bio?: string
  meetingDays?: number[]
  startTime?: string | null
  endTime?: string | null
}

export type ListCoursesQuery = {
  search?: string
  termId?: number
  attribute?: string
  sort?: 'name' | 'rating' | 'difficulty' | 'workload' | 'popularity'
  order?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export type ListProfessorsQuery = {
  search?: string
  sort?: 'name' | 'rating' | 'difficulty' | 'popularity'
  order?: 'asc' | 'desc'
  page?: number
  limit?: number
}

/**
 * Payload carried by the assistant chat response when the router picks the
 * optimizer route. `selected_sections` has the same shape as the standalone
 * `/schedules/optimize` result so it can be rendered identically.
 */
export type AssistantOptimizerPayload = {
  status: string
  request_id?: string | null
  total_credits: number
  campus_days: number
  selected_section_ids: string[]
  selected_sections: SelectedSection[]
  input: {
    term_id: number
    required_course_ids: number[]
    acceptable_elective_course_ids: number[]
    min_credits: number
    max_credits: number
  }
}

export type AssistantChatResult = {
  response: string
  route: 'assistant' | 'optimizer' | string
  optimizer?: AssistantOptimizerPayload
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<AuthResponse>('/auth/login', {
        method: 'POST',
        auth: false,
        body: { email, password },
      }),
    register: (email: string, password: string, confirmPassword: string, profile?: { firstName?: string; lastName?: string; major?: string; level?: string }) =>
      request<AuthResponse>('/auth/register', {
        method: 'POST',
        auth: false,
        body: { email, password, confirmPassword, ...profile },
      }),
    me: () => request<{ user: AuthUser }>('/auth/me'),
    logout: () => request<void>('/auth/logout', { method: 'POST' }),
  },

  dashboard: {
    stats: () => request<{ data: DashboardStats }>('/dashboard/stats'),
    upcoming: () => request<{ data: CampusEvent[] }>('/dashboard/upcoming'),
    activity: (page = 1, limit = 20) =>
      request<Page<Activity>>(`/dashboard/activity?page=${page}&limit=${limit}`),
  },

  courses: {
    list: (query: ListCoursesQuery = {}) => {
      const params = new URLSearchParams()
      if (query.search) params.set('search', query.search)
      if (query.termId != null) params.set('term_id', String(query.termId))
      if (query.attribute) params.set('attribute', query.attribute)
      params.set('sort', query.sort ?? 'name')
      params.set('order', query.order ?? 'asc')
      if (query.page) params.set('page', String(query.page))
      if (query.limit) params.set('limit', String(query.limit))
      return request<Page<CourseSummary>>(`/courses?${params.toString()}`)
    },
    get: (code: string) =>
      request<{ data: CourseSummary }>(`/courses/${encodeURIComponent(code)}`),
    sections: (code: string, termId?: number) => {
      const params = new URLSearchParams()
      if (termId != null) params.set('term_id', String(termId))
      return request<{ data: CourseSection[] }>(
        `/courses/${encodeURIComponent(code)}/sections?${params.toString()}`,
      )
    },
    gradeDistribution: (code: string) =>
      request<{ data: GradeDistributionRow[] }>(
        `/courses/${encodeURIComponent(code)}/grade-distribution`,
      ),
    compare: (codes: string[]) =>
      request<{ data: { courses: CourseSummary[] } }>('/courses/compare', {
        method: 'POST',
        auth: false,
        body: { codes },
      }),
    reviews: (code: string, page = 1, limit = 20) =>
      request<Page<CourseReview>>(
        `/courses/${encodeURIComponent(code)}/reviews?page=${page}&limit=${limit}`,
      ),
    createReview: (
      code: string,
      input: { rating: number; difficulty?: number; workload?: number; wouldRetake?: boolean; comment?: string },
    ) =>
      request<{ data: { review: CourseReview; stats: CourseReviewStats } }>(
        `/courses/${encodeURIComponent(code)}/reviews`,
        { method: 'POST', body: input },
      ),
    save: (code: string) =>
      request<void>(`/courses/${encodeURIComponent(code)}/save`, { method: 'POST' }),
    unsave: (code: string) =>
      request<void>(`/courses/${encodeURIComponent(code)}/save`, { method: 'DELETE' }),
    saved: (page = 1, limit = 50) =>
      request<Page<CourseSummary>>(`/courses/saved?page=${page}&limit=${limit}`),
  },

  professors: {
    list: (query: ListProfessorsQuery = {}) => {
      const params = new URLSearchParams()
      if (query.search) params.set('search', query.search)
      params.set('sort', query.sort ?? 'name')
      params.set('order', query.order ?? 'asc')
      if (query.page) params.set('page', String(query.page))
      if (query.limit) params.set('limit', String(query.limit))
      return request<Page<ProfessorSummary>>(`/professors?${params.toString()}`)
    },
    get: (id: number) => request<{ data: ProfessorSummary & { courses?: unknown[]; ratingBreakdown?: unknown } }>(`/professors/${id}`),
    reviews: (id: number, page = 1, limit = 20) =>
      request<Page<ProfessorReview>>(`/professors/${id}/reviews?page=${page}&limit=${limit}`),
    createReview: (
      id: number,
      input: { rating: number; difficulty?: number; wouldRetake?: boolean; comment?: string },
    ) =>
      request<{ data: ProfessorReview }>(`/professors/${id}/reviews`, {
        method: 'POST',
        body: input,
      }),
    likeReview: (id: number, reviewId: number) =>
      request<void>(`/professors/${id}/reviews/${reviewId}/like`, { method: 'POST' }),
    reportReview: (id: number, reviewId: number, reason: string) =>
      request<void>(`/professors/${id}/reviews/${reviewId}/report`, {
        method: 'POST',
        body: { reason },
      }),
  },

  schedules: {
    optimizerOptions: () => request<{ terms: TermOption[]; attributes: AttributeOption[] }>('/schedule/optimizer-options'),
    optimizerTerms: async () => {
      const body = await request<{ data: TermOption[] }>('/schedule/terms')
      if (!body || !Array.isArray(body.data)) throw new ApiError(502, 'MALFORMED_RESPONSE', 'Term list returned a malformed response.')
      return body.data
    },
    optimize: async (input: OptimizeScheduleRequest) => {
      const body = await request<{ data?: OptimizeScheduleResult }>('/schedule/optimize', { method: 'POST', body: input })
      if (!body?.data || typeof body.data.status !== 'string') throw new ApiError(502, 'MALFORMED_RESPONSE', 'Optimizer returned a malformed response.')
      return body.data
    },
    list: (page = 1, limit = 50) =>
      request<Page<ScheduleSummary>>(`/schedules?page=${page}&limit=${limit}`),
    get: (id: number) => request<{ data: ScheduleDetail }>(`/schedules/${id}`),
    create: (input: { name: string; notes?: string; termId?: number; sectionIds?: number[] }) =>
      request<{ data: ScheduleDetail }>('/schedules', { method: 'POST', body: input }),
    update: (id: number, input: { name?: string; notes?: string | null }) =>
      request<{ data: ScheduleDetail }>(`/schedules/${id}`, { method: 'PUT', body: input }),
    remove: (id: number) => request<void>(`/schedules/${id}`, { method: 'DELETE' }),
    addCourse: (id: number, sectionId: number) =>
      request<{ data: ScheduleDetail }>(`/schedules/${id}/courses`, {
        method: 'POST',
        body: { sectionId },
      }),
    removeCourse: (id: number, courseId: number) =>
      request<void>(`/schedules/${id}/courses/${courseId}`, { method: 'DELETE' }),
    swapSection: (id: number, courseId: number, sectionId: number) =>
      request<{ data: ScheduleDetail }>(`/schedules/${id}/courses/${courseId}`, {
        method: 'PUT',
        body: { sectionId },
      }),
    compare: (scheduleIds: number[]) =>
      request<{ data: ScheduleComparison }>('/schedules/compare', {
        method: 'POST',
        body: { scheduleIds },
      }),
    conflicts: (id: number) =>
      request<{ data: ScheduleConflicts }>(`/schedules/${id}/conflicts`),
    getDraft: (termId?: number | null) => {
      const params = new URLSearchParams()
      if (termId != null) params.set('term_id', String(termId))
      return request<{ data: ScheduleDetail | null }>(`/schedules/draft?${params.toString()}`)
    },
    saveDraft: (
      termId: number | null,
      input: { name?: string; notes?: string | null; sectionIds?: number[] },
    ) => {
      const params = new URLSearchParams()
      if (termId != null) params.set('term_id', String(termId))
      return request<{ data: ScheduleDetail }>(`/schedules/draft?${params.toString()}`, {
        method: 'PUT',
        body: input,
      })
    },
    save: (id: number) => request<{ data: ScheduleDetail }>(`/schedules/${id}/save`, { method: 'POST' }),
    favorite: (id: number) =>
      request<{ data: ScheduleDetail }>(`/schedules/${id}/favorite`, { method: 'POST' }),
    loadAsDraft: (id: number) =>
      request<{ data: ScheduleDetail }>(`/schedules/${id}/load`, { method: 'POST' }),
    pdf: async (id: number): Promise<Blob> => {
      const token = getAccessToken()
      const response = await fetch(`${API_BASE}/schedules/${id}/pdf`, {
        method: 'GET',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      })
      if (!response.ok) {
        let message = `Request failed with status ${response.status}.`
        try {
          const payload = (await response.json()) as { error?: { message?: string } }
          message = payload.error?.message ?? message
        } catch {
          // response body was not JSON
        }
        throw new ApiError(response.status, 'UNKNOWN_ERROR', message)
      }
      return response.blob()
    },
  },

  feed: {
    list: (page = 1, limit = 20) => request<Page<Post>>(`/feed?page=${page}&limit=${limit}`),
    get: (id: number) => request<{ data: Post }>(`/feed/${id}`),
    create: (input: { type: PostType; content: string; tags?: string[]; scheduleId?: number }) =>
      request<{ data: Post }>('/feed', { method: 'POST', body: input }),
    remove: (id: number) => request<void>(`/feed/${id}`, { method: 'DELETE' }),
    like: (id: number) => request<void>(`/feed/${id}/like`, { method: 'POST' }),
    unlike: (id: number) => request<void>(`/feed/${id}/like`, { method: 'DELETE' }),
    save: (id: number) => request<void>(`/feed/${id}/save`, { method: 'POST' }),
    unsave: (id: number) => request<void>(`/feed/${id}/save`, { method: 'DELETE' }),
    comments: (id: number, page = 1, limit = 50) =>
      request<Page<PostComment>>(`/feed/${id}/comments?page=${page}&limit=${limit}`),
    createComment: (id: number, content: string, parentCommentId?: number) =>
      request<{ data: PostComment }>(`/feed/${id}/comments`, {
        method: 'POST',
        body: parentCommentId != null ? { content, parentCommentId } : { content },
      }),
    deleteComment: (commentId: number) =>
      request<void>(`/feed/comments/${commentId}`, { method: 'DELETE' }),
    myComments: (page = 1, limit = 50) =>
      request<Page<MyComment>>(`/feed/my/comments?page=${page}&limit=${limit}`),
    myPosts: (page = 1, limit = 50) =>
      request<Page<Post>>(`/feed/my/posts?page=${page}&limit=${limit}`),
  },

  friends: {
    list: () => request<{ data: FriendProfile[] }>('/friends'),
    suggested: (limit = 10) => request<{ data: FriendProfile[] }>(`/friends/suggested?limit=${limit}`),
    search: (query: string, limit = 10) =>
      request<{ data: StudentSearchResult[] }>(`/friends/search?query=${encodeURIComponent(query)}&limit=${limit}`),
    requests: () => request<{ data: FriendRequests }>('/friends/requests'),
    sendRequest: (userId: string) =>
      request<{ data: FriendRequest }>(`/friends/requests/${userId}`, { method: 'POST' }),
    acceptRequest: (userId: string) =>
      request<{ data: FriendProfile }>(`/friends/requests/${userId}/accept`, { method: 'POST' }),
    rejectRequest: (userId: string) =>
      request<void>(`/friends/requests/${userId}/reject`, { method: 'POST' }),
    remove: (userId: string) => request<void>(`/friends/${userId}`, { method: 'DELETE' }),
    commonFreeTime: () => request<{ data: CommonFreeTime }>('/friends/common-free-time'),
    schedule: (userId: string) =>
      request<{ data: ScheduleDetail | null }>(`/friends/${userId}/schedule`),
  },

  notifications: {
    list: (page = 1, limit = 20) =>
      request<Page<Notification>>(`/notifications?page=${page}&limit=${limit}`),
    unreadCount: () => request<{ data: { count: number } }>('/notifications/unread-count'),
    markRead: (id: number) => request<void>(`/notifications/${id}/read`, { method: 'PUT' }),
    markAllRead: () => request<void>('/notifications/read-all', { method: 'PUT' }),
    preferences: () => request<{ data: NotificationPreferences }>('/notifications/preferences'),
  },

  studyGroups: {
    list: (page = 1, limit = 100) =>
      request<Page<StudyGroupSummary>>(`/study-groups?page=${page}&limit=${limit}`),
    mine: (page = 1, limit = 100) =>
      request<Page<StudyGroupSummary>>(`/study-groups/mine?page=${page}&limit=${limit}`),
    get: (id: number) => request<StudyGroupDetail>(`/study-groups/${id}`),
    create: (input: CreateStudyGroupInput) =>
      request<StudyGroupDetail>('/study-groups', { method: 'POST', body: input }),
    requestToJoin: (id: number) =>
      request<{ joined: boolean; requested: boolean }>(`/study-groups/${id}/requests`, {
        method: 'POST',
      }),
    cancelJoinRequest: (id: number) =>
      request<void>(`/study-groups/${id}/requests`, { method: 'DELETE' }),
    joinRequests: (id: number) =>
      request<{ data: StudyGroupJoinRequest[] }>(`/study-groups/${id}/requests`),
    acceptRequest: (id: number, userId: string) =>
      request<void>(`/study-groups/${id}/requests/${userId}/accept`, { method: 'POST' }),
    rejectRequest: (id: number, userId: string) =>
      request<void>(`/study-groups/${id}/requests/${userId}/reject`, { method: 'POST' }),
    messages: (id: number, query?: { before?: string; limit?: number }) => {
      const q = new URLSearchParams()
      if (query?.before) q.set('before', query.before)
      if (query?.limit != null) q.set('limit', String(query.limit))
      return request<ChatHistoryPage>(`/study-groups/${id}/messages${q.toString() ? `?${q.toString()}` : ''}`)
    },
    sendMessage: (id: number, content: string) =>
      request<{ data: StudyGroupMessage }>(`/study-groups/${id}/messages`, {
        method: 'POST',
        body: { content },
      }),
    update: (id: number, input: CreateStudyGroupInput) =>
      request<StudyGroupDetail>(`/study-groups/${id}`, { method: 'PATCH', body: input }),
    removeMember: (id: number, userId: string) =>
      request<void>(`/study-groups/${id}/members/${userId}`, { method: 'DELETE' }),
  },

  assistant: {
    chat: (message: string, sessionId?: string, termId?: number | null) =>
      request<{ data: AssistantChatResult }>('/assistant/chat', {
        method: 'POST',
        body: {
          message,
          ...(sessionId ? { sessionId } : {}),
          ...(termId != null ? { termId } : {}),
        },
      }),
  },

  users: {
    profile: (id: string) => request<{ data: UserProfile }>(`/users/${id}/profile`),
    stats: (id: string) => request<{ data: UserStats }>(`/users/${id}/stats`),
    reviews: (id: string, page = 1, limit = 50) =>
      request<Page<UserReview>>(`/users/${id}/reviews?page=${page}&limit=${limit}`),
    achievements: (id: string) => request<{ data: unknown[] }>(`/users/${id}/achievements`),
    favoriteProfessors: (id: string) =>
      request<{ data: unknown[] }>(`/users/${id}/favorite-professors`),
    wishlist: (id: string) => request<{ data: unknown[] }>(`/users/${id}/wishlist`),
    completedCourses: (id: string) =>
      request<{ data: unknown[] }>(`/users/${id}/completed-courses`),
    updateProfile: (input: { firstName?: string; lastName?: string; major?: string; level?: string }) =>
      request<{ data: UserProfile }>('/users/me/profile', { method: 'PUT', body: input }),
    updateNotifications: (
      input: Partial<{
        friendRequests: boolean
        friendAcceptances: boolean
        postLikes: boolean
        postComments: boolean
        reviewLikes: boolean
        scheduleShares: boolean
        registrationReminders: boolean
      }>,
    ) => request<{ data: unknown }>('/users/me/notifications', { method: 'PUT', body: input }),
    updatePrivacy: (
      input: Partial<{
        profileVisibility: 'public' | 'friends' | 'private'
        showCompletedCourses: boolean
        showSchedule: boolean
        showOnlineStatus: boolean
      }>,
    ) => request<{ data: unknown }>('/users/me/privacy', { method: 'PUT', body: input }),
    changePassword: (currentPassword: string, password: string, confirmPassword: string) =>
      request<void>('/users/me/password', {
        method: 'PUT',
        body: { currentPassword, password, confirmPassword },
      }),
    updateTheme: (theme: 'light' | 'dark' | 'system') =>
      request<{ data: { theme: string } }>('/users/me/theme', { method: 'PUT', body: { theme } }),
    updateAvatar: (avatarUrl: string) =>
      request<{ data: { avatarUrl: string | null } }>('/users/me/avatar', {
        method: 'POST',
        body: { avatarUrl },
      }),
    deleteAccount: () => request<void>('/users/me/account', { method: 'DELETE' }),
  },
}
