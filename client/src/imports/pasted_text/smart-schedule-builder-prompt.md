Absolutely. Since you're using **Figma AI**, the prompt needs to describe **the product, design language, layout, interactions, and every component** rather than just saying "make a scheduling app." Figma AI performs much better when given detailed UI/UX specifications.

I would aim for something that looks like a **real SaaS startup** (Linear, Notion, Google Calendar, Discord, GitHub, and Apple Human Interface Guidelines), not a student project.

---

# Figma AI Prompt

## Product Overview

Design a **desktop-first SaaS web application** called **Smart Schedule Builder**.

This application is an AI-powered academic scheduling platform designed for university students. The goal is to replace traditional manual course scheduling websites by combining AI schedule generation, manual schedule editing, professor/course reviews, and a student social network into one modern platform.

The application should feel like a real commercial SaaS product rather than a university project.

The visual style should combine elements from:

* Notion
* Linear
* Google Calendar
* Discord
* Figma
* Apple Human Interface
* GitHub

The interface should be clean, minimal, premium, modern, highly polished, with generous whitespace, rounded corners (12–16 px), soft shadows, subtle gradients, glassmorphism where appropriate, smooth hover states, and polished micro-interactions.

Use a desktop layout optimized for **1920×1080**. Mobile is NOT required. Design should remain usable in split-screen mode later.

---

# Brand

Application Name:

**Smart Schedule Builder**

Tagline:

"Build your perfect semester."

Primary color

Deep Indigo

Accent

Emerald Green

Secondary

Sky Blue

Background

Very light gray (#F8FAFC)

Cards

Pure white

Text

Dark slate

Ratings

Gold

Success

Green

Warnings

Orange

Error

Red

---

# Overall Navigation

Create a left sidebar similar to Linear.

Sidebar contains:

Dashboard

AI Scheduler

Manual Builder

Saved Schedules

Course Reviews

Professor Reviews

Community

Friends

Profile

Settings

Bottom left:

User avatar

Major

Current semester

Notification bell

---

# Main Navigation

Top navigation bar includes:

Search

Current Semester dropdown

Notification icon

Messages

AI Assistant shortcut

Profile menu

---

# PAGE 1

# AI Scheduler

This is the main page.

The layout should be divided into three columns.

---

LEFT PANEL

Student Preferences

Display inside a beautiful settings card.

Include:

Required Courses

Add/remove courses

Preferred Professors

Avoid Professors

Preferred class start time

Preferred class end time

Maximum classes per day

Preferred free days

Minimum break between classes

Required course attributes

Preferred electives

Schedule priority

Dropdown options:

Shortest days

Longest weekends

Balanced workload

Highest rated professors

Lowest workload

No morning classes

Buttons

Generate Schedule

Reset Preferences

---

CENTER PANEL

Weekly Calendar

This should look similar to Google Calendar mixed with RESIS.

Days:

Monday

Tuesday

Wednesday

Thursday

Friday

Time slots

7 AM

through

9 PM

Course blocks are colorful cards.

Each course card contains:

Course Code

Course Name

Section

Professor

Room

Time

When hovering over a course:

Show quick actions

View Ratings

Change Section

Replace Course

Remove

Clicking a course opens a beautiful floating modal.

The modal displays:

Course information

Professor information

Overall Rating

Difficulty

Workload

Student Reviews

Grade distribution

Buttons

View Full Reviews

Replace with another section

---

RIGHT PANEL

AI Assistant

Looks like ChatGPT.

Conversation area.

Student prompt examples:

"I want no classes before 10."

"I only want professors rated above 4.5."

"Give me Fridays off."

"I need one humanities elective."

"I prefer EECE classes in the morning."

Display fake responses only.

Below responses display

Reasoning card

Example:

"I selected this schedule because it minimizes walking distance between buildings while avoiding morning classes."

Below that

Trade-offs card

Example:

You requested:

✔ Fridays free

✔ Highest rated professors

✔ No classes before 10

Could not satisfy:

Morning EECE 351 is mandatory.

Alternative:

Schedule 2 satisfies all except Friday free.

Buttons:

Generate Again

Optimize

Compare

---

TOP OF CALENDAR

Schedule Tabs

Schedule 1

Schedule 2

Schedule 3

Compare

Each tab displays another generated schedule.

Students can save favorite schedules.

---

# Manual Schedule Builder

Within the same page include a toggle:

AI Builder

Manual Builder

Manual mode allows drag-and-drop scheduling.

Search courses.

Drag sections onto timetable.

Conflict warnings appear immediately.

When conflicts happen:

Red outline

Error popup

Suggestion:

"Replace with Section 3?"

AI Fix button

Automatically repairs conflicts.

---

# PAGE 2

# Course & Professor Reviews

This page combines RateMyProfessor with modern analytics.

Top search bar

Search:

Course

Professor

Department

Attribute

Filters:

Highest Rated

Lowest Workload

Most Popular

Easy A

Newest Reviews

Course Attribute

Writing

Humanities

Natural Science

Social Science

Labs

Engineering Electives

Results appear as modern cards.

Each card contains:

Course

Professor

Overall Rating

Difficulty

Workload

Recommendation %

Average GPA

Students enrolled

Buttons

View Reviews

Compare

Save

---

Professor page

Large profile

Picture placeholder

Department

Courses taught

Overall rating

Charts

Rating breakdown

Difficulty

Would Take Again %

Grade distribution

Student comments

Tags

Helpful

Funny

Heavy Workload

Exam Heavy

Project Based

Attendance Required

Students can:

Rate professor

Rate course

Leave comments

Like reviews

Report reviews

---

# PAGE 3

# Community

Looks similar to Discord + Instagram.

Left column

Friends list

Online friends

Pending requests

Suggested friends

Center feed

Students share

Schedules

Course recommendations

Registration tips

Professor advice

Questions

Images

Study groups

Cards contain:

Profile

Major

Semester

Post

Images

Schedule preview

Likes

Comments

Share

Save

Reply

Ask Question

Pinned badges

Top Contributor

CS Student

Senior

Honor Student

Helpful Reviewer

Right column

Upcoming campus events

Study groups

Common free time

Recommended friends

Trending courses

Trending professors

---

Friend Profile

Contains

Schedule preview

Current semester

Shared courses

Professor ratings

Course reviews

Availability heatmap

Common free time visualization

Buttons

Compare Schedule

Find Free Time

Send Message

Add Friend

---

Schedule Comparison

Beautiful side-by-side calendars.

Highlight

Shared classes

Conflicts

Common breaks

Mutual free periods

Buttons

Invite to Study

Export

Share

---

# Profile Page

Student picture

Major

Minor

Graduation year

Current GPA placeholder

Completed courses

Wishlist

Saved schedules

Favorite professors

Favorite courses

Review statistics

Community reputation

Achievements

---

# User Stories Integration

The interface must clearly support the following workflows:

## P0 Features

* Student account/profile creation.
* Enter required courses before schedule generation.
* Select preferred course sections.
* Prevent all scheduling conflicts automatically.
* Detect conflicts in manual scheduling instantly.
* Manual drag-and-drop schedule creation.
* Calendar-based weekly schedule visualization.
* Choose preferred professors.
* Specify preferred class start/end times.
* Generate multiple AI schedule options.
* Save and compare multiple schedules before registration.

## P1 Features

* Set maximum classes per day.
* Request preferred free days.
* Specify desired breaks between classes.
* Connect with friends.
* Share schedules with friends.
* Compare schedules.
* Automatically find overlapping free time.

## P2 Features

* Recommend courses satisfying major requirements.
* Recommend multiple options for each required course attribute.
* Explain scheduling trade-offs when preferences conflict.
* Automatically repair manually created schedules using AI.
* Allow students to rate professors.
* Allow students to rate courses.

## P3 Features

* Add workload estimates.
* Write detailed course reviews.
* View professor ratings before registration.
* View course difficulty ratings.
* Read student recommendations.
* Ask questions about courses or professors.
* Create community posts.

---

# Design Requirements

Use Auto Layout throughout.

Follow an 8-point spacing system.

Use an 8-column desktop grid.

Create reusable components.

Include:

Buttons

Cards

Dialogs

Dropdowns

Inputs

Tags

Badges

Charts

Calendar cells

Schedule cards

Review cards

Social posts

Chat bubbles

Tooltips

Use consistent spacing and typography.

Typography hierarchy:

Large page titles

Section headings

Card titles

Body text

Captions

Design every interaction with hover states, active states, loading states, disabled states, empty states, success states, and error states.

The final result should look indistinguishable from a modern commercial SaaS product that could realistically be launched by a startup, with a polished, premium interface rather than a university prototype.
