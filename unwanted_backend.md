# Unused / Unwired Backend Endpoints

This document maps every backend endpoint in `server/src/routes` to its usage in the React client.
Status:

- **WIRED** — called by the client.
- **NOT WIRED** — endpoint exists in the API but the client does not call it.
- **NOT NEEDED** — endpoint exists but has no corresponding UI feature.

## Auth (`/auth`)

| Endpoint | Status | Notes |
| --- | --- | --- |
| `POST /auth/register` | WIRED | Login page |
| `POST /auth/login` | WIRED | Login page |
| `POST /auth/logout` | WIRED | TopBar logout button |
| `POST /auth/refresh` | NOT WIRED | Token refresh not implemented client-side yet |
| `POST /auth/forgot-password` | NOT WIRED | No forgot-password UI |
| `POST /auth/reset-password` | NOT WIRED | No reset-password UI |
| `GET /auth/me` | WIRED | Auth bootstrap |

## Courses (`/courses`)

| Endpoint | Status | Notes |
| --- | --- | --- |
| `GET /courses` | WIRED | Reviews, AIScheduler manual builder, Community trending |
| `POST /courses/compare` | NOT WIRED | Reviews "Compare" modal computes differences from already-loaded course objects instead |
| `POST /courses/:code/reviews` | WIRED | Reviews course modal, AIScheduler course modal |
| `GET /courses/:code/reviews` | WIRED | Reviews course modal, AIScheduler course modal |
| `POST /courses/:code/save` | WIRED | Reviews save toggle |
| `DELETE /courses/:code/save` | WIRED | Reviews save toggle |
| `GET /courses/:code/sections` | WIRED | AIScheduler section picker / swap |
| `GET /courses/:code/grade-distribution` | WIRED | AIScheduler course modal |
| `GET /courses/:code` | WIRED | AIScheduler course modal |

## Professors (`/professors`)

| Endpoint | Status | Notes |
| --- | --- | --- |
| `GET /professors` | WIRED | Reviews, Community top professors |
| `GET /professors/:id` | WIRED | Reviews professor detail view |
| `GET /professors/:id/reviews` | WIRED | Reviews professor detail view |
| `POST /professors/:id/reviews` | WIRED | Reviews professor rate form |
| `POST /professors/:id/reviews/:reviewId/like` | WIRED | Reviews like button |
| `POST /professors/:id/reviews/:reviewId/report` | WIRED | Reviews report button |

## Schedules (`/schedules`)

| Endpoint | Status | Notes |
| --- | --- | --- |
| `GET /schedules` | WIRED | SavedSchedules, Profile |
| `POST /schedules` | WIRED | AIScheduler "Save" (manual builder) |
| `POST /schedules/compare` | NOT WIRED | SavedSchedules compare modal computes shared/unique courses from fetched schedule details instead |
| `POST /schedules/:id/courses` | NOT WIRED | No add-to-existing-schedule UI |
| `PUT /schedules/:id/courses/:courseId` | NOT WIRED | Section swaps happen pre-save in the AIScheduler builder |
| `DELETE /schedules/:id/courses/:courseId` | NOT WIRED | No remove-from-saved-schedule UI |
| `GET /schedules/:id` | WIRED | SavedSchedules details/previews |
| `PUT /schedules/:id` | NOT WIRED | No rename/notes editing UI |
| `DELETE /schedules/:id` | WIRED | SavedSchedules delete |
| `GET /schedules/:id/conflicts` | NOT WIRED | Conflict detection not surfaced in the UI |

## Feed (`/feed`)

| Endpoint | Status | Notes |
| --- | --- | --- |
| `GET /feed` | WIRED | Community feed |
| `POST /feed` | WIRED | Community compose |
| `POST /feed/:id/like` | WIRED | Community like |
| `DELETE /feed/:id/like` | WIRED | Community unlike |
| `POST /feed/:id/save` | WIRED | Community save |
| `DELETE /feed/:id/save` | WIRED | Community unsave |
| `GET /feed/:id/comments` | WIRED | Community comment refresh |
| `POST /feed/:id/comments` | WIRED | Community comment input |
| `GET /feed/:id` | NOT WIRED | Post detail page not needed |
| `DELETE /feed/:id` | NOT WIRED | No delete-own-post UI |

## Friends (`/friends`)

| Endpoint | Status | Notes |
| --- | --- | --- |
| `GET /friends` | WIRED | Community friends rail |
| `GET /friends/suggested` | WIRED | Community suggested list |
| `GET /friends/requests` | NOT WIRED | No friend-request inbox UI |
| `GET /friends/common-free-time` | WIRED | Community free-time panel |
| `POST /friends/requests/:userId` | WIRED | Community "add friend" |
| `POST /friends/requests/:userId/accept` | NOT WIRED | No request-accept UI (requests inbox not built) |
| `POST /friends/requests/:userId/reject` | NOT WIRED | No request-reject UI |
| `DELETE /friends/:userId` | NOT WIRED | No remove-friend UI |

## Dashboard (`/dashboard`)

| Endpoint | Status | Notes |
| --- | --- | --- |
| `GET /dashboard/stats` | WIRED | Dashboard stat cards |
| `GET /dashboard/upcoming` | WIRED | Dashboard events, Community events |
| `GET /dashboard/activity` | WIRED | Dashboard activity feed |

## Users (`/users`)

| Endpoint | Status | Notes |
| --- | --- | --- |
| `GET /users/:id/profile` | WIRED | Profile header |
| `GET /users/:id/stats` | WIRED | Profile stats |
| `GET /users/:id/reviews` | WIRED | Profile "My Reviews" tab |
| `GET /users/:id/achievements` | WIRED (stub) | Endpoint returns `[]`; Profile shows placeholder |
| `GET /users/:id/favorite-professors` | WIRED (stub) | Endpoint returns `[]`; Profile shows placeholder |
| `GET /users/:id/wishlist` | WIRED (stub) | Endpoint returns `[]`; Profile shows placeholder |
| `GET /users/:id/completed-courses` | WIRED (stub) | Endpoint returns `[]`; Profile shows placeholder |
| `PUT /users/me/profile` | WIRED | Profile "Edit Profile" |
| `PUT /users/me/notifications` | WIRED | Settings notification toggles |
| `PUT /users/me/privacy` | WIRED | Settings privacy controls |
| `PUT /users/me/password` | WIRED | Settings password change |
| `PUT /users/me/theme` | WIRED | Settings appearance |
| `POST /users/me/avatar` | NOT WIRED | No avatar-upload UI |
| `DELETE /users/me/account` | WIRED | Settings danger zone |

## Summary

- **NOT WIRED (feature gaps):** token refresh, forgot/reset password, course & schedule comparison endpoints, schedule course mutation endpoints, schedule rename/notes, schedule conflict display, friend-request inbox (accept/reject), feed post delete, avatar upload.
- **NOT NEEDED (no UI concept):** `GET /feed/:id`.
- **Backend stubs (`unknown[]`):** `GET /users/:id/achievements`, `favorite-professors`, `wishlist`, `completed-courses` — the Profile page calls them but falls back to placeholders since the server always returns `[]`.
