# Skedule

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

---

## Overview

**Skedule** is a course planning and student social platform designed to help university students build their schedules, make informed course decisions, and coordinate with friends and classmates.

### Highlights

- **AI-powered scheduling** — Generate optimized schedules using the Optimized Builder and its AI Assistant.
- **Manual scheduling** — Build and customize your schedule yourself using the weekly calendar.
- **Social planning** — Compare your schedule with one or more friends through Common Free Time.
- **Course & professor insights** — Browse and contribute to course and professor reviews.
- **Student community** — Connect with other students through posts, comments, replies, friend requests, and study groups.
- **Schedule management** — Save multiple schedules, compare them, and download them as PDFs.

---

## Features

### Scheduling

- **Optimized Builder** — Generate optimized schedules based on your scheduling preferences with the help of an AI Assistant.
- **Manual Builder** — Search for courses, select sections, and build your schedule manually on a weekly calendar.
- **Save Schedules** — Save multiple schedules and access them later.
- **Schedule Comparison** — Compare your saved schedules side-by-side and see shared courses.
- **Common Free Time** — Compare the schedules of a student and one or more friends to find common available time.
- **PDF Export** — Download saved schedules as PDFs with a visual weekly calendar and course details.

### Reviews

- **Course Reviews** — Browse and submit reviews for courses.
- **Professor Reviews** — Browse and submit reviews for professors.
- **Ratings & Feedback** — View student ratings and feedback to help make informed course and professor choices.

### Community & Social

- **Community** — Browse posts from other students.
- **Comments & Replies** — Comment on posts and reply to existing comments.
- **Friend Requests** — Send, receive, accept, and manage friend requests to build your network.
- **Study Groups** — Discover and create study groups around courses.
- **Study Group Chat** — Communicate with members through persistent group chat rooms.
- **Profile Visibility** — Control whether your name is shown on your posts and reviews to everyone, friends only, or nobody.

### Profile & Account

- **My Activity** — View and manage your own posts, comments, and replies.
- **My Reviews** — View and manage the course and professor reviews you have submitted.
- **Saved Schedules** — Manage your saved schedules and open them in the builders.
- **Account & Privacy** — Manage account information and profile visibility.
- **Danger Zone** — Delete your account.

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 19 | UI framework |
| TypeScript 5.7 | Type-safe JavaScript |
| Vite 8 | Build tool and dev server |
| Tailwind CSS 4 | Utility-first styling |
| lucide-react | Icon library |
| recharts | Charts |
| Plus Jakarta Sans | UI font |

### Backend
| Technology | Purpose |
|---|---|
| Node.js + Express | REST API |
| Supabase (PostgreSQL) | Database and storage |
| TypeScript | Type-safe server code |
| Vitest | Unit and integration tests |

---

## Project Structure

```
./
├── client/     # Frontend single-page application
├── server/     # Backend REST API
├── package.json
└── README.md
```

---

## Getting Started

### Prerequisites

- **Node.js** 20+ (see `.mise.toml` / version manifests for the exact versions)
- **npm**

### Installation

```bash
# Frontend
cd client
npm install

# Backend
cd ../server
npm install
```

### Running the Frontend

```bash
cd client
npm run dev
```

The app is served at `http://localhost:8443` by default with hot module replacement enabled.

### Running the Backend

```bash
cd server
npm run dev
```

### Building for Production

```bash
cd client && npm run build
cd server && npm run build
```

Frontend output is written to `client/dist/`.

### Running Tests

```bash
cd client && npm run test
cd server && npm run test && npm run lint && npm run typecheck
```

---

## License

This project is proprietary and is licensed under an **All Rights Reserved** license. Unauthorized copying, modification, distribution, or use of this software is prohibited.
