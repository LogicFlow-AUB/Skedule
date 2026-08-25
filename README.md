# Smart Schedule Builder

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
---

## Overview

Smart Schedule Builder is a web application that helps university students plan their semester course schedules. The application provides an AI-powered schedule generator, a manual drag-and-drop builder, course and professor reviews, a social community feed, and schedule comparison tools — all designed to simplify the registration process.

The frontend is fully designed and implemented. Backend development is in progress, with a detailed implementation plan defined from the frontend surface.

## Project Status

- ✅ UI/UX Design completed
- ✅ Frontend implementation completed
- 🚧 Backend development in progress

---

## Features

### Scheduling
- **Schedule Generator** — Configure preferences (time windows, free days, max classes per day, break duration) and generate optimal schedules.
- **Manual Builder** — Browse available courses, add them to a weekly calendar, swap sections, and remove courses.
- **Schedule Comparison** — Side-by-side comparison of two schedules with shared courses highlighted.
- **Weekly Calendar View** — Visual timetable (Mon–Fri, 7 AM – 9 PM) with colored course blocks and hover actions.
- **Section Swapping** — Change a course to an alternate section directly from the calendar.
- **Save & Export** — Save schedules and export as PDF.

### Course & Professor Reviews
- **Course Reviews** — Browse courses with ratings, difficulty, workload, GPA, and recommendation percentages. Filter by academic attribute and search by name/code/professor.
- **Professor Reviews** — View professor profiles with rating breakdowns, grade distributions, and student reviews.
- **Write Reviews** — Submit course and professor reviews with star ratings and tags.
- **Course/Professor Comparison** — Compare two courses or professors side-by-side with winner indicators.
- **Review Interaction** — Like and report reviews.

### Community & Social
- **Feed** — Browse posts from the community categorized as schedule sharing, reviews, questions, or tips.
- **Post Interaction** — Like, comment, save, and share posts.
- **Friends** — View friends with online status, shared courses, and suggested connections.
- **Study Groups** — Browse and join study groups.
- **Upcoming Events** — View registration deadlines and academic events.
- **Trending** — See trending courses, top professors, and common free time with friends.

### User Profile
- **Profile Overview** — View GPA, credits, achievements, favorite professors, course wishlist, and community activity stats.
- **Saved Schedules** — Access and manage saved schedules.
- **Completed Courses** — View completed courses with grades.
- **My Reviews** — Track submitted reviews.
- **Settings** — Configure notifications, privacy, account details, theme color, and account deletion.

---

## Screenshots

> *Screenshots to be added once the application is deployed or preview builds are available.*

| Page | Preview |
|---|---|
| Dashboard | `![Dashboard](screenshots/dashboard.png)` |
| AI Scheduler | `![AI Scheduler](screenshots/ai-scheduler.png)` |
| Manual Builder | `![Manual Builder](screenshots/manual-builder.png)` |
| Saved Schedules | `![Saved Schedules](screenshots/saved-schedules.png)` |
| Course Reviews | `![Course Reviews](screenshots/course-reviews.png)` |
| Professor Reviews | `![Professor Reviews](screenshots/professor-reviews.png)` |
| Community | `![Community](screenshots/community.png)` |
| Profile | `![Profile](screenshots/profile.png)` |

---

## Tech Stack

### Frontend

| Technology | Purpose |
|---|---|
| **React 19** | UI framework |
| **TypeScript 5.7** | Type-safe JavaScript |
| **Vite 8** | Build tool and dev server |
| **Tailwind CSS 4** | Utility-first styling (via `@tailwindcss/vite` plugin) |
| **lucide-react** | Icon library |
| **recharts** | Charting library *(installed)* |
| **Plus Jakarta Sans** | UI font (Google Fonts) |

### Backend

See `BACKEND_TODO.md` for the full backend implementation plan.

### Development Tools

| Tool | Purpose |
|---|---|
| pnpm | Package manager |
| oxfmt | Code formatter |
| Figma Make | Design-to-code export pipeline |

---

## Project Structure

```
./
├── client/                        # Frontend application
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar.tsx        # Left navigation panel
│   │   │   └── TopBar.tsx         # Global header with search
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx      # Home / overview page
│   │   │   ├── AIScheduler.tsx    # AI + Manual schedule builder
│   │   │   ├── SavedSchedules.tsx # Saved schedule management
│   │   │   ├── Reviews.tsx        # Course & professor reviews
│   │   │   ├── Community.tsx      # Social feed & friends
│   │   │   └── Profile.tsx        # User profile & settings
│   │   ├── App.tsx                # Root component + page router
│   │   ├── main.tsx               # React entry point
│   │   └── index.css              # Global styles + Tailwind import
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── BACKEND_TODO.md                # Backend implementation plan
└── README.md                      # This file
```

---

## Getting Started

### Prerequisites

- **Node.js** (see `.mise.toml` for the required version, or use v20+)
- **pnpm** — Install with `npm install -g pnpm` or activate via [Corepack](https://nodejs.org/api/corepack.html)

### Installation

```bash
cd client
pnpm install
```

### Running the Development Server

```bash
pnpm dev
```

The application starts at `http://localhost:8443` by default. Hot module replacement is enabled — changes to source files are reflected immediately.

### Building for Production

```bash
pnpm build
```

Output is written to `client/dist/`.

### Preview the Production Build

```bash
pnpm preview
```

---

## Backend

> Documentation will be added as backend development progresses.

A comprehensive backend implementation plan is available at [`BACKEND_TODO.md`](./BACKEND_TODO.md), covering every endpoint, entity, and service identified from the frontend surface.

## Database

The existing Supabase project is provisioned from the version-controlled SQL migrations in `supabase/migrations/`. Do not create application tables manually in the Supabase dashboard. Apply the migrations to create or update the schema, and add every future schema change as a new SQL migration.

---

## Contributing

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'Add amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.

Please ensure your code follows the existing style conventions and passes the TypeScript type checker before submitting.

---

## Team

- Assil Kachmar
- Aya Halawi
- Elio Ishak
- Hassan Jaffal
- Tony Kassis

---

## License

This project is proprietary and is licensed under an **All Rights Reserved** license. Unauthorized copying, modification, distribution, or use of this software is prohibited.
