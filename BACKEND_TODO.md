# Backend Implementation Todo

> Based on frontend analysis of the Smart Schedule Builder client.

---

## Prerequisites — Supabase Database

A shared Supabase project has already been created with the database schema, tables, and relationships in place. No initial schema design, migration creation, or table setup is required.

**To get started:**

1. Obtain the Supabase project URL and `anon` / `service_role` keys from the project admin.
2. Copy `.env.example` to `.env` and fill in the values:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# App
PORT=3000
NODE_ENV=development

# Auth
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# AI (when implemented)
OPENAI_API_KEY=sk-...
# or
ANTHROPIC_API_KEY=sk-...
```

> Migration files, if any, are located in `src/database/migrations/`. If that directory is empty, the project relies on the existing shared Supabase schema — no local migration step is needed.

---

## Phase 1 — Foundation

- [ ] **1.1 Initialize backend project**
  - [ ] Choose framework (Express / NestJS / Fastify)
  - [ ] Set up TypeScript, linting, formatting
  - [ ] Set up logger (pino / winston)
  - [ ] Set up error handling middleware

- [ ] **1.2 Configure Supabase connection**
  - [ ] Install Supabase client library (`@supabase/supabase-js`)
  - [ ] Create Supabase client wrapper/service that reads from environment variables
  - [ ] Verify connectivity with a health-check query
  - [ ] Document all required `.env` variables in `.env.example`

- [ ] **1.3 Define local TypeScript types mirroring the database schema**
  - [ ] User, UserProfile, NotificationPreference, PrivacySetting
  - [ ] Course, Section
  - [ ] Professor
  - [ ] Schedule, ScheduleCourse, GeneratedSchedule, UserPreference
  - [ ] Review, ReviewLike, Report
  - [ ] Post, Comment, PostLike, PostSave
  - [ ] Friend, FriendRequest
  - [ ] Event, StudyGroup, StudyGroupMember
  - [ ] Notification
  - [ ] AIChatMessage, ChatSession
  - [ ] Achievement, CompletedCourse, WishlistCourse, FavoriteProfessor
  - [ ] TrendingCourse, TrendingProfessor
  - [ ] Activity

- [ ] **1.4 Seed data** (optional — insert sample records for development)
  - [ ] Seed courses, sections, professors
  - [ ] Seed sample users
  - [ ] Seed sample reviews
  - [ ] Seed sample schedules
  - [ ] Seed sample feed posts, comments
  - [ ] Seed sample events, study groups

---

## Phase 2 — Core Infrastructure

- [ ] **2.1 Auth module**
  - [ ] POST /api/auth/register
  - [ ] POST /api/auth/login
  - [ ] POST /api/auth/logout
  - [ ] POST /api/auth/refresh
  - [ ] POST /api/auth/forgot-password
  - [ ] POST /api/auth/reset-password
  - [ ] GET /api/auth/me
  - [ ] JWT middleware (protect routes)
  - [ ] Password hashing (bcrypt)
  - [ ] Rate limiting on login/register

- [ ] **2.2 Validation middleware**
  - [ ] Request body validation (zod / joi / class-validator)
  - [ ] Query parameter validation
  - [ ] Path parameter validation

- [ ] **2.3 Pagination utility**
  - [ ] Offset-based pagination helper
  - [ ] Cursor-based pagination helper

---

## Phase 3 — User & Profile

- [ ] **3.1 User module**
  - [ ] GET /api/users/:id/profile
  - [ ] GET /api/users/:id/achievements
  - [ ] GET /api/users/:id/favorite-professors
  - [ ] GET /api/users/:id/wishlist
  - [ ] GET /api/users/:id/stats
  - [ ] GET /api/users/:id/completed-courses
  - [ ] GET /api/users/:id/reviews

- [ ] **3.2 Settings module**
  - [ ] PUT /api/users/me/profile
  - [ ] PUT /api/users/me/notifications
  - [ ] PUT /api/users/me/privacy
  - [ ] PUT /api/users/me/password
  - [ ] PUT /api/users/me/theme
  - [ ] POST /api/users/me/avatar
  - [ ] DELETE /api/users/me/account

---

## Phase 4 — Courses & Professors

- [ ] **4.1 Course module**
  - [ ] GET /api/courses (search, filter by attribute, sort)
  - [ ] GET /api/courses/:code (detail with stats)
  - [ ] GET /api/courses/:code/sections
  - [ ] GET /api/courses/:code/grade-distribution
  - [ ] POST /api/courses/compare

- [ ] **4.2 Professor module**
  - [ ] GET /api/professors (search, sort)
  - [ ] GET /api/professors/:id (detail with rating breakdown)

---

## Phase 5 — Reviews

- [ ] **5.1 Review module**
  - [ ] POST /api/courses/:code/reviews
  - [ ] GET /api/courses/:code/reviews (paginated)
  - [ ] POST /api/professors/:id/reviews
  - [ ] GET /api/professors/:id/reviews (paginated)
  - [ ] POST /api/courses/:code/save
  - [ ] DELETE /api/courses/:code/save
  - [ ] POST /api/professors/:id/reviews/:reviewId/like
  - [ ] POST /api/professors/:id/reviews/:reviewId/report
  - [ ] Aggregation service (average ratings, grade distribution)

---

## Phase 6 — Dashboard

- [ ] **6.1 Dashboard module**
  - [ ] GET /api/dashboard/stats
  - [ ] GET /api/dashboard/upcoming
  - [ ] GET /api/dashboard/activity
  - [ ] Activity tracking service

---

## Phase 7 — Schedules (CRUD)

- [ ] **7.1 Schedule module**
  - [ ] GET /api/schedules (list user's schedules)
  - [ ] POST /api/schedules (create)
  - [ ] GET /api/schedules/:id (detail)
  - [ ] PUT /api/schedules/:id (update name/notes)
  - [ ] DELETE /api/schedules/:id
  - [ ] POST /api/schedules/:id/courses (add course)
  - [ ] DELETE /api/schedules/:id/courses/:courseId (remove course)
  - [ ] PUT /api/schedules/:id/courses/:courseId/section (swap section)
  - [ ] POST /api/schedules/compare (compare two schedules)
  - [ ] GET /api/schedules/:id/conflicts

---

## Phase 8 — Social Feed

- [ ] **8.1 Feed module**
  - [ ] GET /api/feed (paginated)
  - [ ] POST /api/feed (create post)
  - [ ] GET /api/feed/:id
  - [ ] DELETE /api/feed/:id
  - [ ] POST /api/feed/:id/like
  - [ ] DELETE /api/feed/:id/like
  - [ ] POST /api/feed/:id/save
  - [ ] DELETE /api/feed/:id/save
  - [ ] GET /api/feed/:id/comments
  - [ ] POST /api/feed/:id/comments

---

## Phase 9 — Friends & Social Graph

- [ ] **9.1 Friend module**
  - [ ] GET /api/friends
  - [ ] GET /api/friends/suggested
  - [ ] GET /api/friends/requests
  - [ ] POST /api/friends/requests/:userId
  - [ ] POST /api/friends/requests/:userId/accept
  - [ ] POST /api/friends/requests/:userId/reject
  - [ ] DELETE /api/friends/:userId
  - [ ] GET /api/friends/common-free-time

---

## Phase 10 — Notifications

- [ ] **10.1 Notification module**
  - [ ] GET /api/notifications (paginated)
  - [ ] GET /api/notifications/unread-count
  - [ ] PUT /api/notifications/:id/read
  - [ ] PUT /api/notifications/read-all
  - [ ] Notification service (create + dispatch)
  - [ ] Trigger notifications for:
    - [ ] Friend request received
    - [ ] Friend request accepted
    - [ ] Post liked
    - [ ] Post commented
    - [ ] Review liked
    - [ ] Schedule shared
    - [ ] Registration reminder

---

## Phase 11 — Events & Study Groups

- [ ] **11.1 Event module**
  - [ ] GET /api/events
  - [ ] POST /api/events/:id/rsvp

- [ ] **11.2 Study Group module**
  - [ ] GET /api/study-groups
  - [ ] POST /api/study-groups
  - [ ] POST /api/study-groups/:id/join
  - [ ] DELETE /api/study-groups/:id/join

---

## Phase 12 — Search & Trending

- [ ] **12.1 Search module**
  - [ ] GET /api/search (unified across courses, professors, users, posts)
  - [ ] Full-text search index setup (if not already in Supabase)

- [ ] **12.2 Trending module**
  - [ ] GET /api/trending/courses
  - [ ] GET /api/trending/professors
  - [ ] Trending computation service (cron job or on-the-fly)

---

## Phase 13 — Export

- [ ] **13.1 Export module**
  - [ ] GET /api/schedules/:id/export/pdf
  - [ ] PDF template + generation service

---

## Phase 14 — AI Schedule Generator

- [ ] **14.1 Generator module**
  - [ ] GET /api/user/preferences
  - [ ] PUT /api/user/preferences
  - [ ] POST /api/schedules/generate
  - [ ] GET /api/schedules/generate/:jobId/status
  - [ ] Schedule generation algorithm (constraint-based)
    - [ ] Time conflict detection
    - [ ] Professor rating weighting
    - [ ] Free day enforcement
    - [ ] Max classes per day constraint
    - [ ] Min break enforcement
    - [ ] Priority modes (shortest days, balanced, etc.)
  - [ ] Background job queue for generation

- [ ] **14.2 Conflict detection service**
  - [ ] Time overlap detection
  - [ ] Room double-booking detection
  - [ ] Professor availability check
  - [ ] PUT /api/schedules/:id/conflicts/ai-fix

---

## Phase 15 — AI Assistant

- [ ] **15.1 AI chat module**
  - [ ] POST /api/ai/chat
  - [ ] POST /api/ai/quick-prompt
  - [ ] LLM integration service
    - [ ] Prompt construction with schedule context
    - [ ] Response parsing into schedule adjustments
    - [ ] Trade-off/reasoning extraction
  - [ ] Chat session management
  - [ ] Quick prompt → preference mapping

---

## Cross-Cutting Tasks

- [ ] **C1. Middleware**
  - [ ] Auth middleware on all protected routes
  - [ ] Rate limiting on review submission
  - [ ] Error handler with consistent error shape

- [ ] **C2. API Documentation**
  - [ ] OpenAPI/Swagger spec

- [ ] **C3. Tests**
  - [ ] Unit tests for all services
  - [ ] Integration tests for all endpoints (using test Supabase instance)
  - [ ] E2E tests for critical flows (auth, schedule generation)

- [ ] **C4. Deployment**
  - [ ] Dockerfile
  - [ ] CI/CD pipeline
  - [ ] Environment variable management for staging/production

---

## Quick Stats

| Category | Count |
|---|---|
| Phases | 15 |
| Total tasks | ~120+ |
| API endpoints | ~80 |
| Database tables | 25+ |
| Services | 23 |
| Controllers | 19 |
