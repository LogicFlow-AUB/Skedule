# Backend Implementation Todo

> Based on frontend analysis of the Smart Schedule Builder client.

---

## Prerequisites — Supabase Database

A shared Supabase project already exists with the application schema. The backend reads that schema directly — no local migrations are applied.

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
CLIENT_ORIGIN=http://localhost:8443
```

> Authentication uses Supabase Auth (GoTrue). The `users` table is a profile table referencing `auth.users`, so no passwords are stored in the application schema.

---

## Phase 1 — Foundation

- [x] **1.1 Initialize backend project**
  - [x] Choose framework (Express / NestJS / Fastify)
  - [x] Set up TypeScript, linting, formatting
  - [x] Set up logger (pino / winston)
  - [x] Set up error handling middleware

- [x] **1.2 Configure Supabase connection**
  - [x] Install Supabase client library (`@supabase/supabase-js`)
  - [x] Create Supabase client wrapper/service that reads from environment variables
  - [x] Verify connectivity with a health-check query
  - [x] Document all required `.env` variables in `.env.example`

- [x] **1.3 Define local TypeScript types mirroring the database schema**
  - [x] User, UserProfile, NotificationPreference, PrivacySetting
  - [x] Course, Section
  - [x] Professor
  - [x] Schedule, ScheduleCourse, GeneratedSchedule, UserPreference
  - [x] Review, ReviewLike, Report
  - [x] Post, Comment, PostLike, PostSave
  - [x] Friend, FriendRequest
  - [x] Event, StudyGroup, StudyGroupMember
  - [x] Notification
  - [x] AIChatMessage, ChatSession
  - [x] Achievement, CompletedCourse, WishlistCourse, FavoriteProfessor
  - [x] TrendingCourse, TrendingProfessor
  - [x] Activity

- [x] **1.4 Seed data** (optional — insert sample records for development)
  - [x] Seed courses, sections, professors
  - [x] Seed sample users
  - [x] Seed sample reviews
  - [x] Seed sample schedules
  - [x] Seed sample feed posts, comments
  - [x] Seed sample events, study groups

---

## Phase 2 — Core Infrastructure

- [x] **2.1 Auth module**
  - [x] POST /api/auth/register
  - [x] POST /api/auth/login
  - [x] POST /api/auth/logout
  - [x] POST /api/auth/refresh
  - [x] POST /api/auth/forgot-password
  - [x] POST /api/auth/reset-password
  - [x] GET /api/auth/me
  - [x] Auth middleware (verifies Supabase access tokens)
  - [x] Passwords handled by Supabase Auth
  - [x] Rate limiting on login/register

- [x] **2.2 Validation middleware**
  - [x] Request body validation (zod / joi / class-validator)
  - [x] Query parameter validation
  - [x] Path parameter validation

- [x] **2.3 Pagination utility**
  - [x] Offset-based pagination helper
  - [x] Cursor-based pagination helper

---

## Phase 3 — User & Profile

- [x] **3.1 User module**
  - [x] GET /api/users/:id/profile
  - [x] GET /api/users/:id/achievements
  - [x] GET /api/users/:id/favorite-professors
  - [x] GET /api/users/:id/wishlist
  - [x] GET /api/users/:id/stats
  - [x] GET /api/users/:id/completed-courses
  - [x] GET /api/users/:id/reviews

- [x] **3.2 Settings module**
  - [x] PUT /api/users/me/profile
  - [x] PUT /api/users/me/notifications
  - [x] PUT /api/users/me/privacy
  - [x] PUT /api/users/me/password
  - [x] PUT /api/users/me/theme
  - [x] POST /api/users/me/avatar
  - [x] DELETE /api/users/me/account

---

## Phase 4 — Courses & Professors

- [x] **4.1 Course module**
  - [x] GET /api/courses (search, filter by attribute, sort)
  - [x] GET /api/courses/:code (detail with stats)
  - [x] GET /api/courses/:code/sections
  - [x] GET /api/courses/:code/grade-distribution
  - [x] POST /api/courses/compare

- [x] **4.2 Professor module**
  - [x] GET /api/professors (search, sort)
  - [x] GET /api/professors/:id (detail with rating breakdown)

---

## Phase 5 — Reviews

- [x] **5.1 Review module**
  - [x] POST /api/courses/:code/reviews
  - [x] GET /api/courses/:code/reviews (paginated)
  - [x] POST /api/professors/:id/reviews
  - [x] GET /api/professors/:id/reviews (paginated)
  - [x] POST /api/courses/:code/save
  - [x] DELETE /api/courses/:code/save
  - [x] POST /api/professors/:id/reviews/:reviewId/like
  - [x] POST /api/professors/:id/reviews/:reviewId/report
  - [x] Aggregation service (average ratings, grade distribution)

---

## Phase 6 — Dashboard

- [x] **6.1 Dashboard module**
  - [x] GET /api/dashboard/stats
  - [x] GET /api/dashboard/upcoming
  - [x] GET /api/dashboard/activity
  - [x] Activity tracking service

---

## Phase 7 — Schedules (CRUD)

- [x] **7.1 Schedule module**
  - [x] GET /api/schedules (list user's schedules)
  - [x] POST /api/schedules (create)
  - [x] GET /api/schedules/:id (detail)
  - [x] PUT /api/schedules/:id (update name/notes)
  - [x] DELETE /api/schedules/:id
  - [x] POST /api/schedules/:id/courses (add course)
  - [x] DELETE /api/schedules/:id/courses/:courseId (remove course)
  - [x] PUT /api/schedules/:id/courses/:courseId/section (swap section)
  - [x] POST /api/schedules/compare (compare two schedules)
  - [x] GET /api/schedules/:id/conflicts

---

## Phase 8 — Social Feed

- [x] **8.1 Feed module**
  - [x] GET /api/feed (paginated)
  - [x] POST /api/feed (create post)
  - [x] GET /api/feed/:id
  - [x] DELETE /api/feed/:id
  - [x] POST /api/feed/:id/like
  - [x] DELETE /api/feed/:id/like
  - [x] POST /api/feed/:id/save
  - [x] DELETE /api/feed/:id/save
  - [x] GET /api/feed/:id/comments
  - [x] POST /api/feed/:id/comments

---

## Phase 9 — Friends & Social Graph

- [x] **9.1 Friend module**
  - [x] GET /api/friends
  - [x] GET /api/friends/suggested
  - [x] GET /api/friends/requests
  - [x] POST /api/friends/requests/:userId
  - [x] POST /api/friends/requests/:userId/accept
  - [x] POST /api/friends/requests/:userId/reject
  - [x] DELETE /api/friends/:userId
  - [x] GET /api/friends/common-free-time

---

## Phase 10 — Notifications

- [x] **10.1 Notification module**
  - [x] GET /api/notifications (paginated)
  - [x] GET /api/notifications/unread-count
  - [x] PUT /api/notifications/:id/read
  - [x] PUT /api/notifications/read-all
  - [x] Notification service (create + dispatch)
  - [x] Trigger notifications for:
    - [x] Friend request received
    - [x] Friend request accepted
    - [x] Post liked
    - [x] Post commented
    - [x] Review liked
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
