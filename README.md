# Skedule

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

---

## Overview

**Skedule** is a course planning and scheduling platform for university students. It combines an AI-powered schedule generator, a manual drag-and-drop builder, and a rich course/professor review community — everything needed to plan a semester, compare options, and coordinate with friends.

### Highlights

- **AI-powered & manual scheduling** — Generate optimized schedules from your preferences, or build your own by hand on a weekly calendar.
- **Informed decisions** — Browse detailed course and professor reviews with ratings, difficulty, workload, and grade distributions.
- **Community-driven** — Share schedules, leave reviews, follow friends, and join study groups.
- **Save & export** — Store schedules and export them as a clean PDF with a weekly calendar view.

---

## Features

### Scheduling
- **AI Schedule Generator** — Configure time windows, free days, daily class limits, and break durations, then generate optimized schedules.
- **Manual Builder** — Browse available courses, add them to a weekly calendar, and swap sections at any time.
- **Schedule Comparison** — Compare two schedules side-by-side with shared courses highlighted.
- **Weekly Calendar View** — A Mon–Fri, 7 AM – 9 PM timetable with color-coded course blocks.
- **Save & Export** — Save schedules and export them as PDF.

### Reviews
- **Course Reviews** — Ratings, difficulty, workload, GPA, and recommendation percentages, filterable by academic attribute and searchable by name/code/professor.
- **Professor Reviews** — Rating breakdowns, grade distributions, and student feedback.
- **Write Reviews** — Submit course and professor reviews with star ratings and tags.
- **Comparisons** — Compare courses or professors side-by-side with winner indicators.

### Community & Profile
- **Feed** — Browse schedule shares, reviews, questions, and tips from the community.
- **Social** — Like, comment, save, and share posts; view friends, study groups, events, and trending content.
- **Profile** — GPA, credits, achievements, saved schedules, completed courses, and submitted reviews.
- **Settings** — Notifications, privacy, account details, and theme color.

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
