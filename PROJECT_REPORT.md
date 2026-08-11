# ⚡ GTA (Go To App) — Project Report & Future Roadmap

**Target Institution:** RNS Institute of Technology, Bengaluru  
**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, Supabase (Auth, Postgres, Realtime, Storage, RLS), Framer Motion  
**Document Purpose:** Comprehensive summary of implemented features, areas for improvement, and version progression roadmap for college project evaluation and research scope.

---

## 📋 Executive Summary

**GTA (Go To App)** is a full-stack hyper-local peer-to-peer (P2P) student skill exchange and campus activity platform built specifically for RNSIT. It combines elements of a skill marketplace (Fiverr), real-time messaging (Discord/Slack), event management (BookMyShow), and student networking (LinkedIn) into a secure, domain-restricted single-page application.

---

## 🛠️ Section 1: Implemented Features (Version 1.0 — Current State)

### 1. 🔒 Authentication & Security Layer
* **Institutional Domain Restriction:** Restricts signups strictly to official `@rnsit.ac.in` student emails.
* **Supabase Authentication:** Secure session management with JWTs and automatic token refresh.
* **Email Verification & Password Reset:** Dedicated workflows with email verification banners, resend capabilities, and secure password recovery screens.
* **Google OAuth Integration:** Pre-configured support for Google/RNSIT Gmail Sign-In.
* **Row-Level Security (RLS):** Database policies enforced at the PostgreSQL level guaranteeing students can only insert, update, or delete data they own.

### 2. 💡 Peer-to-Peer Skill Marketplace
* **Skill Publishing:** Post skills complete with title, description, category, experience level, hourly rate (₹), and availability status.
* **Dynamic Search & Filtering:** Instant filtering by search terms and 8 core categories (Programming & Tech, Graphics & Design, Writing & Translation, Video & Animation, Music & Audio, Digital Marketing, Business, Other).
* **Star Ratings & Reviews:** Review system with star ratings (1–5) and feedback comments, featuring database constraints to prevent duplicate reviews per user.
* **Bookmarks System:** Ability to save skills for future reference, persisted per student in Supabase.

### 3. 📅 Campus Activity & Event Organizer
* **Event Creation:** Organize events specifying title, date, time, venue, max capacity, category, and requirements.
* **Activity Discovery:** Category-based filters (Academic, Sports, Tech, Arts & Culture, Social, Career).
* **Organizer Contact:** Direct messaging trigger connected to event hosts.

### 4. 💬 Real-Time Messaging & Community Hub
* **Direct Messaging (1-on-1):** Instant messaging powered by Supabase WebSockets (`supabase_realtime`), featuring read status indicators and auto-marking unread messages.
* **Real-time Unread Badge:** Live count updates on the home navigation bar when new messages arrive.
* **Community Group Chats:** Group channels for public discussion organized around skills or campus interest groups.
* **Toast Notification Center:** Real-time dropdown and toast notifications when receiving messages or reviews.

### 5. 📊 Campus Pulse & Automated Leaderboard
* **Live Campus Aggregates:** Real-time counts of total registered students, active skills, hosted activities, and total reviews.
* **Top Contributors Algorithm:** Dynamically computes top 5 student rankings based on total platform activity (skills posted + events organized), awarding Gold, Silver, and Bronze badges.

### 6. 👤 Student Profile & Portfolio System
* **Profile Customization:** Avatar image uploads to Supabase Storage (`avatars` bucket), academic year, department, and bio.
* **Public Student Pages:** Unique public profiles showing all skills offered and activities hosted by a student.

### 7. 🎨 Design & Aesthetic Infrastructure
* **Dual Theme Engine:** Dark and Light mode toggling persisted in local storage.
* **Cosmic Nebula Background:** Interactive particle canvas with mouse parallax movement tracking.
* **Framer Motion Animations:** Custom 3D perspective splash screen and smooth modal transitions.

---

## 🎯 Section 2: Areas for Improvement & Identified Gaps

While V1.0 is feature-complete and robust, the following areas can be upgraded for production or higher-grade project evaluation:

| Area | Current Gap | Recommended Improvement |
|---|---|---|
| **Audio/Video Calls** | UI buttons show "Coming Soon" toast | Integrate WebRTC (e.g., Daily.co or Agora API) for 1-on-1 video doubt-solving sessions |
| **Monetization / Payments** | Skill hourly rates are text labels | Integrate Razorpay / UPI test mode for in-app escrow payments for paid skills |
| **Notification Reach** | Notifications only show when app is open | Add Web Push Notifications (Service Workers + Firebase Cloud Messaging) |
| **Content Moderation** | Basic domain check | Admin dashboard for reporting inappropriate posts, spam, or abusive reviews |
| **Skill Search Intelligence** | Exact string & category matching | AI vector search (e.g., Pgvector / Gemini embeddings) for semantic skill matching |
| **Faculty / Skill Endorsement** | Self-reported student skills | Faculty verification badge or peer endorsement system for skill credibility |

---

## 🚀 Section 3: Project Version Evolution Roadmap

```
  ┌───────────────────────────────────────────────────────────┐
  │  V1.0 (Current Version)                                   │
  │  - RNSIT Domain Auth & RLS Security                       │
  │  - Skill Marketplace & Event Organizer                    │
  │  - Real-time DMs & Community Chat                         │
  │  - Live Leaderboards, Reviews & Bookmarks                 │
  └─────────────────────────────┬─────────────────────────────┘
                                │
                                ▼
  ┌───────────────────────────────────────────────────────────┐
  │  V2.0 (Enhanced Campus Micro-Economy)                     │
  │  - Integrated UPI / Razorpay Payment Gateway (Test Mode)  │
  │  - WebRTC Peer-to-Peer Video Call Huddles                 │
  │  - Admin & Community Moderation Dashboard                 │
  │  - Faculty Skill Endorsement Badges                       │
  │  - Progressive Web App (PWA) Mobile Support               │
  └─────────────────────────────┬─────────────────────────────┘
                                │
                                ▼
  ┌───────────────────────────────────────────────────────────┐
  │  V3.0 (AI-Powered Campus Ecosystem)                       │
  │  - Gemini AI Smart Matchmaker (Pairing students for DSA)  │
  │  - Semantic Vector Search across Skills & Projects        │
  │  - Automated Resume / Portfolio PDF Generator             │
  │  - Cross-College Exchange Network Extension              │
  └───────────────────────────────────────────────────────────┘
```

### Detailed Breakdown of Versions:

#### 🔹 Version 1.0 (Current Build)
* **Focus:** Foundation, Security, and Core Interactions.
* **Key Features:** Domain auth, skill marketplace, event hosting, real-time DMs, community chats, review system, bookmarks, Campus Pulse leaderboard, Supabase RLS policies.
* **Status:** Fully functional & verified.

#### 🔹 Version 2.0 (Production-Ready Campus Platform)
* **Focus:** Payments, Live Communication & Mobile Accessibility.
* **Planned Features:**
  1. **Razorpay / UPI Integration:** Enable secure tokenized payments for student tutoring or design gigs.
  2. **WebRTC Live Huddles:** Click-to-call audio/video rooms directly in the DM modal.
  3. **Admin Dashboard:** Role-based access control (RBAC) for campus admins to manage users and moderate reported content.
  4. **PWA Support:** Installable app manifest and offline caching for mobile browsers.
  5. **Faculty Verification:** Verification checks where professors can endorse top student skill listings.

#### 🔹 Version 3.0 (Next-Gen AI Campus Ecosystem)
* **Focus:** AI Intelligence, Semantic Matching & Portfolio Automation.
* **Planned Features:**
  1. **Gemini AI Skill Matchmaker:** An AI assistant that analyzes student project needs and automatically matches them with ideal student tutors/collaborators.
  2. **Automated Resume Builder:** One-click export of a student's platform history (reviews, skills, completed gigs) into an executive PDF resume.
  3. **Inter-College Expansion:** Multi-tenant architecture allowing other universities (e.g., RVCE, BMSCE) to onboard while retaining campus domain isolation.

---

## 📄 Section 4: Academic & Research Paper Potential

This project provides strong material for a research paper in IEEE / ACM / Scopus-indexed conferences under CS / Software Engineering / EdTech tracks.

### Recommended Paper Titles & Themes:
1. **Title:** *"Architecting Secure Hyper-Local Student Exchanges: A Row-Level Security (RLS) Approach using Backend-as-a-Service"*
   * **Domain:** Software Engineering / Cloud Security
   * **Focus:** Security design, database RLS policies, domain isolation, and real-time WebSockets.
2. **Title:** *"Gamified Micro-Economies and Trust Frameworks in Higher Education Peer-to-Peer Marketplaces"*
   * **Domain:** Human-Computer Interaction (HCI) / EdTech
   * **Focus:** Reputation systems, real-time contributor leaderboards, and peer review mechanics.

---

*Report generated for college submission and project evaluation.*
