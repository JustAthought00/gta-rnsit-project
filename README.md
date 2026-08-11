# ⚡ GTA (Go To App) — RNSIT Student Skill Exchange

A full-stack web platform where students of **RNS Institute of Technology, Bengaluru** offer their skills, organize campus activities, and connect with each other — the campus's go-to app for student talent.

Think **Fiverr × Discord × BookMyShow × LinkedIn — for one campus**: a skill marketplace, community chat, event listings, and student profiles in a single platform.

## What it does

Every student is good at something — poster design, DSA doubt-solving, video editing, event photography. GTA puts that on a shared board:

- **Offer a skill** — post what you're good at, with category, experience level, rate, and availability
- **Find talent** — browse and search skills by category, view student profiles, read reviews
- **Organize activities** — create campus events with date, time, venue, and capacity
- **Connect** — direct messages between students, plus community group chats
- **Reviews & bookmarks** — rate skills you've used, save the ones you'll need later
- **Campus Pulse** — live campus stats and a Top Contributors leaderboard computed in real time from actual platform data

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| UI | Tailwind CSS, shadcn/ui (Radix primitives), Framer Motion |
| Backend | Supabase (PostgreSQL, Auth, Row Level Security) |
| Data fetching | Supabase JS client, TanStack Query |
| Routing | React Router v6 |

## Architecture

```
React SPA (Vite + TypeScript)
        │
        │  @supabase/supabase-js
        ▼
Supabase (managed PostgreSQL)
├── Auth        — email/password sessions, JWT
├── Database    — 8 tables (below)
└── RLS         — per-row security policies on every table
```

### Database schema

| Table | Purpose |
|---|---|
| `profiles` | Student profile: name, bio, avatar, department, academic year |
| `skills` | Skills offered: title, description, category, experience, rate |
| `activities` | Campus events: date, time, venue, capacity, requirements |
| `messages` | 1-to-1 direct messages with read status |
| `communities` | Interest-based groups |
| `community_members` | Group membership |
| `community_messages` | Group chat messages |
| `reviews` | Ratings + comments on skills |
| `bookmarks` | Saved skills per user |

**Security:** every table is protected by PostgreSQL Row Level Security — users can read public content but can only insert/update/delete rows they own (`auth.uid() = user_id`). The frontend ships only the public anon key; all authorization is enforced in the database, not the client.

## Running locally

Requires Node.js 18+.

```sh
git clone https://github.com/JustAthought00/gta-rnsit-project.git
cd gta-rnsit-project
npm install
npm run dev        # → http://localhost:8080
```

Environment variables (already in `.env`):

```
VITE_SUPABASE_URL             — Supabase project URL
VITE_SUPABASE_PUBLISHABLE_KEY — public anon key (safe to expose; RLS enforces access)
VITE_SUPABASE_PROJECT_ID      — Supabase project id
```

Other scripts: `npm run build` (production build), `npm run lint` (ESLint).

## Project structure

```
src/
├── pages/            # Route-level pages (Auth, NotFound)
├── components/       # App screens & features
│   ├── Home.tsx          # Landing: categories, Campus Pulse, activities
│   ├── AllSkills.tsx     # Skill browser with search + category filters
│   ├── AllActivities.tsx # Event browser
│   ├── SkillDetail.tsx   # Skill page: reviews, bookmarks, contact
│   ├── ActivityDetail.tsx# Event page: details, message organizer
│   ├── CampusPulse.tsx   # Live stats + contributor leaderboard
│   ├── MessagesModal.tsx # DMs + community group chat
│   └── ui/               # shadcn/ui primitives
├── integrations/supabase/  # Client + generated DB types
└── hooks/            # Shared hooks (notifications, toasts)
supabase/
└── migrations/       # SQL schema migrations (tables + RLS policies)
```

## Team

Built by ****Tarun S,Varun B R,Vedanth P,Vivek SD**** — RNS Institute of Technology, Bengaluru.
<!-- Add teammates, USNs, and guide name here before submission -->
