#!/usr/bin/env python3
"""Seed the GTA (Go To App) database with a realistic RNSIT demo dataset.

Creates
  * 70 student + 9 faculty auth accounts (email confirmed, known password)
  * profiles enriched with bio / avatar / banner / role
  * faculty directory rows in `teachers`
  * skills, activities, activity participants
  * communities with leadership, membership and group-chat history
  * connections, direct messages, skill requests
  * reviews and bookmarks
  * projects with collaborators

Everything is deterministic (seeded RNG) so re-running produces the same campus.

Usage:
    SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... python3 scripts/seed/seed.py
"""

from __future__ import annotations

import json
import os
import random
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from roster import build_students, build_teachers  # noqa: E402

IST = timezone(timedelta(hours=5, minutes=30))
UTC = timezone.utc

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://ylliuejawkswxnzfyiym.supabase.co").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
# The shared password for every demo account. Deliberately has no default so the
# live credential is never published in the (public) repository.
DEMO_PASSWORD = os.environ.get("DEMO_PASSWORD", "")

if not SERVICE_KEY:
    sys.exit("SUPABASE_SERVICE_ROLE_KEY is required (see scripts/seed/README.md)")
if not DEMO_PASSWORD:
    sys.exit("DEMO_PASSWORD is required (see scripts/seed/README.md)")

RNG = random.Random(20261021)

# --------------------------------------------------------------------------------------
# HTTP helpers
# --------------------------------------------------------------------------------------


def _request(method: str, path: str, body=None, extra_headers=None, expect_json=True):
    url = path if path.startswith("http") else f"{SUPABASE_URL}{path}"
    data = json.dumps(body).encode() if body is not None else None
    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    if extra_headers:
        headers.update(extra_headers)
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if expect_json and raw else raw
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode()[:800]
        raise RuntimeError(f"{method} {url} -> HTTP {exc.code}: {detail}") from exc


def insert(table: str, rows: list[dict]):
    """Bulk insert, chunked so PostgREST never sees a giant body."""
    if not rows:
        return []
    out = []
    for i in range(0, len(rows), 200):
        chunk = rows[i : i + 200]
        res = _request(
            "POST",
            f"/rest/v1/{table}",
            chunk,
            {"Prefer": "return=representation"},
        )
        out.extend(res if isinstance(res, list) else [])
    return out


def upsert(table: str, rows: list[dict], on_conflict: str):
    if not rows:
        return []
    # PostgREST reads every `Prefer` value from a single header — two separate
    # Prefer headers means the second one is dropped and the upsert silently
    # degrades into a plain insert.
    return _request(
        "POST",
        f"/rest/v1/{table}?on_conflict={on_conflict}",
        rows,
        {"Prefer": "return=representation, resolution=merge-duplicates"},
    )


def delete_all(table: str, filters: str = ""):
    """PostgREST refuses a DELETE without a WHERE clause, so scope it to
    "every row that has an id"."""
    query = filters or "id=not.is.null"
    return _request("DELETE", f"/rest/v1/{table}?{query}", expect_json=False)


# --------------------------------------------------------------------------------------
# Identity helpers
# --------------------------------------------------------------------------------------

_TITLE_PREFIXES = {"dr", "prof", "mr", "ms", "mrs", "dr."}


def email_local_part(full_name: str) -> str:
    parts = [p for p in full_name.replace(".", " ").split() if p]
    parts = [p for p in parts if p.lower().strip(".") not in _TITLE_PREFIXES]
    if not parts:
        parts = ["rnsit"]
    first = parts[0].lower()
    last = parts[-1].lower() if len(parts) > 1 else "rnsit"
    return f"{first}.{last}"


def build_accounts():
    """Return the 79 accounts (students + faculty) with unique emails."""
    students = build_students()
    teachers = build_teachers()

    accounts = []
    seen = set()
    for person in students + teachers:
        base = email_local_part(person["full_name"])
        local = base
        n = 2
        while local in seen:
            local = f"{base}{n}"
            n += 1
        seen.add(local)
        accounts.append(
            {
                **person,
                "email": f"{local}@rnsit.ac.in",
                "role": "teacher" if person in teachers else "student",
            }
        )
    return accounts


# --------------------------------------------------------------------------------------
# Content pools
# --------------------------------------------------------------------------------------

SKILL_POOL = {
    "Programming & Tech": [
        ("DSA & Competitive Programming Mentorship", "Cracked 3-star CodeChef and coached 20+ juniors through their first 4-star solve. I run a weekly problem-solving clinic and will take you from 'I know the syntax' to 'I can attempt an unseen problem'.", "Expert", "300"),
        ("React & TypeScript Frontend Development", "Shipped four production React apps — one of them is a campus attendance portal used by 600 students. Comfortable with hooks, state management, Tailwind and writing components people actually enjoy using.", "Expert", "450"),
        ("Node.js & Express REST API Development", "I build clean, well-structured backend services with Node, Express and PostgreSQL. Auth, rate limiting, error handling, pagination — the boring stuff done properly. Happy to review your API design over a coffee.", "Intermediate", "350"),
        ("Python for Data Science & Automation", "Pandas, NumPy, scikit-learn, and a lot of time spent automating repetitive spreadsheet work. I can help you clean a messy dataset, build a dashboard or just make that 4-hour manual report take 4 minutes instead.", "Intermediate", "300"),
        ("Machine Learning Model Building", "Computer vision and tabular models end to end — data prep, feature engineering, training, evaluation and deployment. I have built an attendance-recognition model and a campus crowd-counting prototype.", "Intermediate", "500"),
        ("Full-Stack Web App Development", "From database schema to deployed URL. I can scope a project, break it into sprints and hand you a working app with a proper README and CI. Best for first-time builders who want to ship something real.", "Intermediate", "400"),
        ("Android App Development (Kotlin)", "Native Android apps with Jetpack Compose. I have two apps on the Play Store and will happily walk you through creating a project, wiring an API and shipping a build to a group of testers.", "Intermediate", "350"),
        ("Cloud Deployment on AWS, Vercel & Supabase", "CI/CD, environment variables, custom domains, rollbacks and monitoring. If your app works locally but you have no idea how to put it online for the world to see, this is me.", "Expert", "450"),
        ("Database Design & SQL Optimisation", "Normalisation, indexing, query plans and the slow-query hunt. I can take a 4-second report query down to 200ms and show you exactly which index did it.", "Expert", "400"),
        ("Linux, Shell Scripting & DevOps Basics", "Cron jobs, systemd services, rsync, log rotation and the grep/sed/awk trio that saves you an afternoon. Perfect for students running student servers or automating lab experiments.", "Intermediate", "250"),
        ("Git & GitHub Workflow Training", "Branches, rebases, PR reviews, resolving conflicts without fear, and a CI pipeline that runs lint + tests on every push. We will practise on a real repo, not slides.", "Beginner", "200"),
        ("Cybersecurity & Ethical Hacking Basics", "CTF-style walkthroughs: network scanning, password hygiene, OWASP Top 10 and how to think like an attacker. Run by a student who trains for campus security competitions.", "Intermediate", "400"),
        ("Flutter App Development", "One codebase, Android and iOS. I built a Flutter app for our department's attendance system and can get you from `flutter create` to a signed APK on your phone in one session.", "Intermediate", "350"),
        ("IoT & Arduino Embedded Projects", "Sensors, MQTT, dashboards — I have live sensors on the college balcony reporting temperature every 30 seconds. Great for mini-projects and IoT club builds.", "Expert", "300"),
        ("Django & DRF Backend Development", "Model-view-router done properly: serializers, permissions, pagination, and admin panels that make your mentor's life easier. I can also help you understand Django when the docs get dense.", "Intermediate", "350"),
        ("Docker & CI/CD Pipeline Setup", "Containerise an app, write a Dockerfile that actually works, and wire GitHub Actions to test and deploy on every push. Your future self will thank you.", "Intermediate", "400"),
        ("Prompt Engineering & AI Tooling for Campus Projects", "Using LLMs properly in a product — structured prompts, retrieval, evaluation and guardrails. I built an AI doubt-solver for our department's DSA course.", "Beginner", "250"),
        ("Quantum Computing Basics & Qiskit", "Qubits, superposition, and running circuits on real quantum hardware via IBM Quantum. Currently working through the RNSIT quantum initiative.", "Beginner", "300"),
        ("Technical Writing & API Documentation", "I write documentation people actually read — clear READMEs, API references and tutorial walkthroughs for our college projects. Available for documentation reviews.", "Intermediate", "250"),
        ("Competitive Programming & Codeforces Ratings", "Rated 1600+ on Codeforces. I coach beginners through CF ratings, contest strategy and how to actually remember what you solved.", "Expert", "300"),
    ],
    "Graphics & Design": [
        ("Poster & Banner Design for College Fests", "I have designed posters for 20+ college events — the big fest banners, the small workshop flyers, and the Instagram square versions of both. Clean hierarchy, readable at phone size, printable at A2.", "Expert", "400"),
        ("UI/UX Design with Figma", "Wireframes, auto-layout components, and a design system your developers will thank you for. I have redesigned our college's fest registration portal end to end.", "Expert", "500"),
        ("Logo & Brand Identity Design", "Logos, colour palettes, typography and a mini brand guide. I make sure the logo still works when someone shrinks it to a 32px favicon.", "Intermediate", "450"),
        ("Product Photography for Startups & Events", "Studio-style product shots using natural light and a simple setup. Also do food photography for the canteen festival.", "Intermediate", "500"),
        ("Social Media Templates in Canva", "Carousels, reels covers, story templates and a reusable brand kit so your club posts stop looking like five different people made them.", "Beginner", "200"),
        ("Motion Graphics & Explainer Videos", "After Effects work: kinetic typography, simple 2D character animation, and 30-second explainers for a product pitch. I animate what other people only describe.", "Expert", "550"),
        ("Illustration & Digital Art", "Procreate and Adobe Illustrator. Character sketches, editorial illustrations and hand-drawn campus scenes. Open to commissions and character-design collabs.", "Intermediate", "350"),
        ("3D Product Renders in Blender", "Cycles renders, glass and metal materials, studio lighting. I can model and render your product idea so it looks real before it is built.", "Intermediate", "500"),
        ("Presentation & Slide Design", "Investor decks, academic presentations and lab reports that look professional in ten seconds. I will restructure your content until the story lands.", "Expert", "400"),
        ("T-Shirt & Merchandise Design", "Screen-print-ready artwork for college fests — you get the layered PSD, the print-ready PNG and the mockup preview.", "Intermediate", "350"),
        ("Thumbnail & Poster Design for YouTube", "High-CTR thumbnails with readable text at 120px, plus channel banner sets. I have run A/B tests on my own channel and iterate on what wins.", "Expert", "400"),
    ],
    "Writing & Translation": [
        ("Technical Blog & Documentation Writing", "Long-form technical writing that developers finish instead of abandon. I write the setup guides and tutorials for our club's open-source projects.", "Expert", "350"),
        ("Proofreading & Copy Editing", "Grammar, tense, consistency and tone — for reports, emails and resumes. I catch the small things that make a document look careless.", "Expert", "200"),
        ("Kannada ⇄ English Translation", "Native-level Kannada to English and back. Documentation, survey forms, event flyers, and help with the official college correspondence.", "Expert", "250"),
        ("Resume & LinkedIn Profile Writing", "ATS-friendly resumes and LinkedIn profiles that pass the first screen. I have reviewed 100+ student resumes and rewritten most of them.", "Expert", "400"),
        ("Academic Report & Thesis Formatting", "IEEE/APA/MLA templates, reference management, plagiarism-safe phrasing and clean formatting for project reports.", "Intermediate", "300"),
        ("Script Writing for Short Films", "Short-form screenplay and story structure — loglines, beats and dialogue that does not sound like a textbook. I script our department's annual short film.", "Intermediate", "350"),
        ("Content Writing for Campus Media", "Articles, event recaps and interview pieces for the campus magazine. Pitching, interviewing and writing to a deadline.", "Intermediate", "250"),
        ("Data Interpretation & Report Writing", "Turning a table of numbers into a paragraph a principal will actually read. Charts, findings and honest caveats.", "Intermediate", "300"),
        ("Poetry & Creative Writing", "Short poems and prose in English and Kannada. Open to reading at open mics and lit fest submissions.", "Beginner", "150"),
        ("Interview Preparation & Mock HR", "Mock interviews across DSA, projects and HR rounds, with honest feedback and a written action plan after each session.", "Expert", "350"),
        ("English Speaking Practice & IELTS Prep", "Spoken English coaching, group discussions and IELTS band-score strategy. I scored 8.0 and coached six students past 7.0.", "Expert", "300"),
    ],
    "Video & Animation": [
        ("Event Photography & Cinematography", "Full coverage of college fests, technical talks and cultural night — candid moments plus staged portraits. Delivered in 24 hours.", "Expert", "600"),
        ("Video Editing in Premiere Pro", "Cuts that land on the beat, colour, sound design and clean subtitles. I edit our college fest's after-movie every year.", "Expert", "450"),
        ("After Effects Motion Graphics", "Animated titles, logos and data visualisations for videos. I turn a static logo into a proper sting.", "Expert", "500"),
        ("3D Animation & Modelling in Blender", "Character rigs, walk cycles and short 3D shorts rendered in EEVEE. Currently on a 90-second campus promo.", "Intermediate", "500"),
        ("Drone Photography & Aerial Shoots", "DJI-certified for the college campus — the aerial shots of the main building and the annual sports day. I fly with permissions and safety first.", "Expert", "800"),
        ("Podcast Production & Audio Editing", "Multi-mic recording, noise removal, levelling and hosting. I produce our department's weekly tech podcast.", "Intermediate", "400"),
        ("Short Reels & TikTok Editing", "Vertical edits with captions, hooks and music sync for campus reels that actually get watched.", "Expert", "350"),
        ("Colour Grading & LUT Creation", "Consistent looks across a whole event's footage, plus custom LUTs you can reuse.", "Intermediate", "400"),
        ("Live Streaming & OBS Setup", "Multi-camera live streams for technical talks and results days — scene switching, restreaming and audio routing.", "Expert", "600"),
        ("Documentary & Interview Filming", "Interview lighting, two-camera setups and quiet-room audio for student documentaries.", "Intermediate", "550"),
    ],
    "Music & Audio": [
        ("Acoustic Guitar & Chord Lessons", "From your first three chords to fingerpicking patterns and pop song covers. I have taught 40+ beginners.", "Expert", "250"),
        ("Keyboard / Synth Playback", "Chord progressions, arpeggios and playing along with a band. I play keys for our college band.", "Intermediate", "250"),
        ("Carnatic & Hindustani Vocal Training", "Classical voice training with solfege and raga practice. I am a disciple at a neighbourhood music school and teach beginner ragas.", "Expert", "350"),
        ("Beat Making & FL Studio Production", "Producing loops and full tracks — drum design, mixing and arrangement in FL Studio.", "Intermediate", "400"),
        ("DJ Mixing & Live Set Building", "Beatmatching, EQ mixing and building a 45-minute set for campus nights. I have played two college fests.", "Expert", "500"),
        ("Voice Over & Dubbing", "Neutral-to-Mangaluru accent English and Kannada dubbing for short films and ads. Home studio with a treated corner.", "Intermediate", "400"),
        ("Sound Design for Short Films", "Foley and ambient layers that make a scene feel real. Footsteps, doors, rain — the invisible 50% of the audio.", "Intermediate", "350"),
        ("Event Sound & Stage Audio", "Line-array tuning, monitor mixes and a redundant signal chain so the fest does not go silent.", "Expert", "600"),
        ("Western Music Band Rehearsals", "Guitar, bass, keys and drums — we practise covers weekly and play at college events.", "Intermediate", "250"),
        ("Rap & Beatboxing Coaching", "Flow drills, breath control and writing bars. Two years on the campus rap scene.", "Beginner", "200"),
    ],
    "Digital Marketing": [
        ("Instagram Growth & Reels Strategy", "Content pillars, posting cadence and hook writing. I grew our club page from 200 to 3,000 followers in five months.", "Expert", "450"),
        ("Meta & Google Ads for Small Businesses", "Campaign structure, audience research, creative testing and CAC maths. I have run real budgets for local businesses.", "Intermediate", "500"),
        ("SEO for Campus Events & Startups", "Keyword research, on-page fixes and local listings. Ranked our department's fest page on the first page of Google.", "Intermediate", "400"),
        ("Content Calendar & Social Media Planning", "A 30-day calendar for clubs and student bodies, with templates and a batch-production workflow.", "Intermediate", "300"),
        ("LinkedIn & Personal Branding", "A profile that recruiters notice, plus the posting cadence and commenting habits that build visibility.", "Expert", "400"),
        ("WhatsApp & Telegram Community Marketing", "Broadcast lists, channel growth and engagement loops for student communities.", "Intermediate", "250"),
        ("Influencer Outreach & Collab Sourcing", "Finding the right campus creators, pitching them properly and closing deals.", "Beginner", "300"),
        ("Campaign Analytics: GA4 & Meta Insights", "Reading reports properly, spotting what actually drives sign-ups, and reporting in a way stakeholders act on.", "Intermediate", "400"),
        ("Google Business Profile Setup & Local SEO", "Getting a campus venture found on Google Maps, with reviews, posts and Q&A handled.", "Beginner", "250"),
        ("Event Promotion Campaign Planning", "Full-funnel plan for a single college event: pre-registration push, day-of coverage and post-event retention.", "Expert", "400"),
    ],
    "Business": [
        ("Startup Pitch Deck Design", "Ten slides that make an investor keep listening — problem, insight, solution, traction, ask. I have watched 30 decks live.", "Expert", "600"),
        ("Financial Modelling & Excel Dashboards", "Three-statement models, scenario analysis and a dashboard that updates when you change an assumption.", "Expert", "550"),
        ("Market Research & Competitive Analysis", "Real survey work, competitor teardown and a sizing estimate you can defend in a viva.", "Intermediate", "450"),
        ("B2B Sales Outreach & Lead Generation", "Cold email that gets replies, a workable cadence and a tracker that tells you what works.", "Intermediate", "400"),
        ("Product Management & Roadmapping", "Discovery, user stories, prioritisation frameworks and a roadmap that survives contact with engineering.", "Expert", "500"),
        ("Business Plan & Feasibility Study", "Market, operations, cost model and risk section — the format a college entrepreneurship cell expects.", "Intermediate", "400"),
        ("Accounting & GST Basics for Startups", "Bookkeeping, invoicing, GST registration and the returns that must be filed. I run my own venture's books.", "Intermediate", "350"),
        ("Brand Naming & Tagline", "Names that pass a trademark sanity check and taglines that fit under a logo.", "Beginner", "300"),
        ("HR & Campus Recruitment Support", "Job descriptions, screening rubrics and running a campus drive end to end.", "Intermediate", "350"),
        ("E-commerce Store Setup (Shopify)", "Store, catalogue, payments and the shipping math for a student-run venture.", "Intermediate", "400"),
    ],
    "Other": [
        ("Chess Coaching (FIDE-rated)", "Rated 1850. Openings, endgame technique and how to actually remember what you learned. I run the RNSIT chess club's weekly sessions.", "Expert", "300"),
        ("Cricket & Football Coaching", "Batting and bowling technique, field placement, and fitness for the inter-college tournament.", "Intermediate", "250"),
        ("Badminton & Table Tennis", "Footwork drills, shot technique and doubles strategy. Represented RNSIT at the state-level inter-college meet.", "Expert", "300"),
        ("Swimming & Fitness Training", "Stroke correction and general fitness programming for students who spend most of their day sitting.", "Intermediate", "300"),
        ("Yoga & Meditation Sessions", "Beginner-friendly morning sessions on the campus lawn — breathing, posture and focus for exam season.", "Intermediate", "200"),
        ("Home Cooking & Tiffin Service", "South Indian and continental meals, plus a weekly tiffin subscription for hostel students.", "Expert", "250"),
        ("Canteen & Event Food Catering", "Snack stalls and full-day catering for college events — I run the food desk at the annual fest.", "Expert", "350"),
        ("Cycling & Bike Repair", "Commuter fixes, gear tuning and basic wheel truing for the campus cycle club.", "Beginner", "200"),
        ("First Aid & CPR Certification", "Hands-only CPR, choking response and campus emergency protocol. Certified, and I can help your club get certified too.", "Expert", "300"),
        ("Public Speaking & Debate Coaching", "Structure, delivery and rebuttals for the campus debate circuit — I represented RNSIT at the inter-college nationals.", "Expert", "350"),
    ],
}

SKILL_CATEGORIES = list(SKILL_POOL.keys())

SKILL_DESC_SUFFIXES = [
    "Weekday evenings work best for me.",
    "I can do a free intro session first so you can see how we work together.",
    "I have done this for over 20 people already and I am happy to share references.",
    "Come with whatever you have — I will help you get set up.",
    "First session is a quick 20-minute call to scope what you actually need.",
    "Happy to do this in a group if your friends want in too.",
    "I keep a shared Google Doc with everything I teach, so you never lose notes.",
]

VENUES = [
    "Main Auditorium, Block A",
    "Seminar Hall 3, Block C",
    "CSE Lab 2, Block B",
    "Central Library, Ground Floor",
    "Sports Complex, East Campus",
    "Design Studio, Block D",
    "Innovation Center, Block E",
    "ECE Lab 1, Block C",
    "Open Air Amphitheatre",
    "Canteen, Block A Ground Floor",
    "Conference Room 4, Block A",
    "Mechanical Workshop, Block F",
    "Quadrangle, Main Campus",
    "PG Block Seminar Hall",
    "NBA Court, Sports Complex",
    "Auditorium 2, Block B",
]

# (title, category, description, venue, max_participants, requirements, organizer_type, group_name)
ACTIVITY_TEMPLATES = [
    ("DSA Bootcamp: Cracking Coding Interviews", "Academic", "A six-week structured bootcamp covering arrays, trees, graphs and dynamic programming. Each session ends with a timed contest problem. Bring a laptop with a working IDE — we will set everything else up in session one.", "CSE Lab 2, Block B", 40, "Laptop with a code editor installed; basic familiarity with any programming language", "individual", None),
    ("Hackathon 48: Build in a Weekend", "Technology", "Forty-eight hours to build something shippable. Teams of two to four, mentors on the floor from hour six, and a demo session on Sunday evening. Judges score build quality, originality and how well you explain the problem you solved.", "Innovation Center, Block E", 120, "Laptop, charger and a USB drive; teams formed on day one if you come solo", "group", "GTA Hackathon Committee"),
    ("AI & ML Study Group — Weekly Meetup", "Technology", "A weekly reading group on papers and implementations. We rotate presenters, and each meetup ends with a reproducible experiment anyone can run. We are currently working through attention mechanisms end to end.", "Conference Room 4, Block A", 25, "Notebook with a GPU (or a Colab link); curiosity about how models actually work", "individual", None),
    ("Inter-Department Coding Championship", "Technology", "Rounds of competitive programming run by the Coding Club, with a team of three representing each department. The top teams advance to the inter-college stage.", "CSE Lab 1, Block B", 90, "A laptop and an RNSIT student ID; register with your department coordinator", "group", "RNSIT Coding Club"),
    ("Robotics Workshop: Build a Line-Follower", "Technology", "Assemble, code and tune a line-following robot from scratch. We provide the hardware kits, the Arduino IDE setup and one mentor per four teams. Finish the day with a working bot on the track.", "Design Studio, Block D", 30, "A laptop; prior Arduino experience is helpful but not required", "group", "Robotics & IoT Club"),
    ("Placement Prep Bootcamp — Aptitude & DSA", "Career", "Six weeks of aptitude, data structures and mock interviews, structured exactly like a campus drive: 45 minutes of aptitude, 45 minutes of DSA, then a mock interview with real feedback.", "Seminar Hall 3, Block C", 60, "A resume to share and a laptop for the practice rounds", "group", "Placement Prep Cell"),
    ("Resume Clinic with Hiring Managers", "Career", "Bring a printed resume and leave with a marked-up version. We have alumni from product and service companies doing 15-minute reviews in rotating slots.", "Conference Room 4, Block A", 35, "A printed resume — we do not have printers on the spot", "individual", None),
    ("Mock Interview Marathon", "Career", "Back-to-back mock interviews across DSA, system design, HR and behavioural rounds, with scorecards and a written improvement plan for every participant.", "Main Auditorium, Block A", 45, "A resume and a coding-ready laptop", "group", "Placement Prep Cell"),
    ("Startup Pitch Night", "Career", "Ten early-stage ventures from the campus incubator pitch to a panel of alumni investors and founders. The audience votes; the best pitch gets a three-month mentorship.", "Main Auditorium, Block A", 120, "Open to all — just walk in", "group", "Entrepreneurship Cell"),
    ("Open House: Meet the Departments", "Social", "An open day where every department sets up a stall, shows its labs and current projects, and talks about what a first year actually does. Faculty and senior students are on hand all afternoon.", "Quadrangle, Main Campus", 200, "Nothing at all — just turn up", "group", "GTA Open House Committee"),
    ("RNSIT Cultural Night — Live", "Arts & Culture", "The annual cultural evening: classical and western performances, a band finale, stand-up, and the inter-hostel dance battle. Seating is first come, first served, and the last three rows are reserved for the hostels.", "Open Air Amphitheatre", 400, "An entry pass from your hostel coordinator", "group", "Cultural Committee"),
    ("Photography Walk: Street & Campus", "Arts & Culture", "A four-hour photo walk around the campus and the old city neighbourhood. We cover natural light, candid street framing and a short critique session over chai at the end.", "Central Library, Ground Floor", 25, "Any camera or phone; a notebook is handy", "individual", None),
    ("Design Jam: UI in a Weekend", "Arts & Culture", "Design a complete app interface for a real campus problem — attendance, canteen queues or lost-and-found — and present it. Judging is on clarity, usability and how well you defend your decisions.", "Design Studio, Block D", 40, "Figma account (free tier is fine)", "group", "Design Collective"),
    ("Short Film Screening & Director Talk", "Arts & Culture", "A screening of student-made short films with a talkback from the directors, followed by an open question-and-answer session.", "Auditorium 2, Block B", 80, "Nothing required", "individual", None),
    ("Music Night — Open Mic", "Arts & Culture", "The stage is open for anyone: bands, solo singers, guitarists, poets and stand-up. Sign-up closes at 7 PM on the day.", "Open Air Amphitheatre", 150, "An instrument if you are bringing one", "group", "Music Collective"),
    ("Intra-Campus Football Tournament", "Sports", "Twelve teams, knockout from the quarter-finals. Hostel teams of seven, a rolling trophy and a very loud crowd. Finals are under lights.", "Sports Complex, East Campus", 220, "Studded or turf boots; jersey colours provided by the hostel", "group", "Sports Council"),
    ("Basketball League — Season 3", "Sports", "A ten-team league with practice matches on weekdays and finals on Saturday evening. Players are registered by hostel.", "NBA Court, Sports Complex", 120, "Sports shoes and indoor kit", "group", "Sports Council"),
    ("Inter-Hostel Cricket Tournament", "Sports", "Six hostels, round-robin league followed by a knockouts final. The trophy presentation includes the usual unsportsmanlike conduct debate, which we keep for after.", "East Ground, Sports Complex", 200, "Cricket kit and a helmet if you have one", "group", "Sports Council"),
    ("Chess & Carrom Open", "Sports", "Round-robin chess on the doubles boards plus a knockout carrom tournament. Entries close when the first two rounds start, so come early.", "Central Library, Ground Floor", 60, "Nothing required", "individual", None),
    ("Morning Yoga on the Lawn", "Sports", "Sunrise sessions on the campus lawn for the exam season and the general good of everyone. All levels, no equipment needed, and we finish by 7 AM so it does not eat into your morning.", "Quadrangle, Main Campus", 35, "A mat if you have one; we have a few spares", "individual", None),
    ("Blood Donation Camp", "Social", "Organised with a partner hospital. Students and staff can donate; the drive also runs a registration desk for the college's blood donor registry.", "Innovation Center, Block E", 80, "Aadhaar card; eat a good breakfast beforehand", "group", "NSS Unit"),
    ("Lake Cleanup Drive", "Social", "We are cleaning the lake and the stretch of road around it. Gloves and bags are provided; please wear closed shoes and carry water.", "East Campus, Lake Road", 60, "Closed shoes and a water bottle", "group", "Eco Club"),
    ("Diwali Celebration & Rangoli", "Social", "Rangoli competition on the quadrangle, a lighting ceremony at 6 PM, and the traditional potluck in the hostel courtyards afterwards. Entries for the rangoli competition close on the 12th.", "Quadrangle, Main Campus", 180, "Colours for the rangoli if you can, otherwise we provide them", "group", "Cultural Committee"),
    ("Tech Talk: Building for Scale", "Academic", "A guest talk on the architecture decisions that actually matter in the first year of a product — caching, queues, and what to defer.", "Seminar Hall 3, Block C", 100, "Nothing required", "individual", None),
    ("Research Paper Reading Workshop", "Academic", "How to read a research paper in 20 minutes, how to write a related-work summary, and how to keep a literature review that is not just a list of PDFs.", "PG Block Seminar Hall", 40, "A research paper of your own, if you have one", "individual", None),
    ("Git & GitHub Bootcamp for Freshers", "Academic", "Branches, pull requests, conflict resolution and a CI pipeline, practised on a real repository rather than slides. Designed for students who have never used Git outside a single-file assignment.", "CSE Lab 2, Block B", 50, "A GitHub account; a laptop if you have one", "individual", None),
    ("Math Club: Problem of the Week", "Academic", "A weekly problem with a worked solution posted afterwards, plus a short discussion thread. This week's problem set is on discrete mathematics and counting.", "CSE Lab 1, Block B", 35, "Paper for your attempts", "individual", None),
    ("English Communication Club", "Academic", "Spoken English practice in pairs, group discussion rounds and a short presentation every week. The focus is on confidence and clarity, not grammar drills.", "Conference Room 4, Block A", 30, "Nothing required", "group", "English Club"),
    ("Core Competitive Programming: Advanced Track", "Academic", "Graph algorithms, segment trees, DP and advanced string algorithms, with a contest every Sunday. Entry is competitive but the sessions themselves are beginner friendly.", "CSE Lab 2, Block B", 45, "A laptop with a competitive programming setup", "individual", None),
    ("FOSS Contribution Sprint", "Technology", "A guided sprint to make your first open-source pull request. We pick issues from projects that have actually merged from RNSIT students, and a mentor reviews every PR.", "Innovation Center, Block E", 60, "A GitHub account and a code editor", "group", "FOSS Club"),
    ("Cloud Native Bootcamp with Free Credits", "Technology", "Containers, Kubernetes basics and cloud deployment, run on credits we arrange. We finish with each participant deploying their own service.", "Design Studio, Block D", 35, "A laptop; an email address for the cloud account signup", "individual", None),
    ("IoT Build Night: Sensors to Dashboard", "Technology", "Bring a sensor, leave with a live dashboard. We wire up temperature, humidity and motion sensors, push the data over MQTT and graph it.", "Design Studio, Block D", 24, "A laptop; sensors and boards are provided", "group", "Robotics & IoT Club"),
    ("Cybersecurity Awareness Workshop", "Academic", "Password hygiene, phishing simulation, and what actually happens when a college Wi-Fi network is compromised. Run in partnership with the campus IT team.", "ECE Lab 1, Block C", 70, "Nothing required", "group", "Cyber Security Cell"),
    ("Women in Tech: Panel & Networking", "Career", "Three alumnae in product, data and security talk about their first year in the industry, followed by an open networking session.", "Main Auditorium, Block A", 150, "Nothing required", "group", "Women in Tech Collective"),
    ("Alumni & Startup Founder AMA", "Career", "An open question-and-answer with two founders and one engineer from alumni, on the honest version of starting out after college.", "Seminar Hall 3, Block C", 110, "Questions can be submitted anonymously on a form at the entrance", "group", "Alumni Cell"),
    ("Internship Application Sprint", "Career", "We sit down one on one and actually submit applications: company research, tailored CVs, and a tracker so nothing slips.", "PG Block Seminar Hall", 40, "A laptop and your existing CV", "individual", None),
    ("Startup Idea Clinic", "Career", "Bring a rough idea and leave with a sharper version of it. Mentors help with the customer, the wedge and the first experiment you can run this week.", "Conference Room 4, Block A", 30, "A rough idea in writing, even one line", "individual", None),
    ("Freshers' Orientation: Know Your Campus", "Social", "The welcome session for first years: campus map, hostel and mess rules, club sign-ups, library orientation and the academic calendar for the year.", "Main Auditorium, Block A", 300, "None", "group", "Student Affairs Office"),
    ("Departmental Farewell — CSE Batch 2021", "Social", "The outgoing batch celebrates four years of campus life with a lamp-lighting, a few speeches that are genuinely short, and a band that plays badly on purpose.", "Main Auditorium, Block A", 250, "None", "group", "CSE Student Association"),
    ("Inter-Department Cultural Night", "Arts & Culture", "Eight departments, eight different interpretations of the same song. Judged, but mostly enjoyed.", "Open Air Amphitheatre", 350, "None", "group", "Cultural Committee"),
    ("Poster Presentation Day", "Academic", "Final-year project teams present their work to a review panel of faculty and industry mentors. Open to all years, and a good way to see what is being built.", "Main Auditorium, Block A", 180, "None", "group", "Project Review Board"),
    ("GTA Product Meetup", "Technology", "A working session on this year's project ideas, with short pitches from each team and honest feedback on scope, feasibility and what to cut.", "Innovation Center, Block E", 50, "Bring your project idea, however rough", "group", "GTA Core Team"),
    ("Webinar: Careers in Core Engineering", "Career", "Core roles in manufacturing, design and quality control, and how to prepare for them from campus. Two alumni working in the industry take questions.", "Seminar Hall 3, Block C", 90, "None", "individual", None),
    ("Chess Lecture & Simul", "Academic", "A guest master gives a 90-minute lecture and then plays a simul against the audience. Strong players are welcome — the master enjoys a real game.", "Auditorium 2, Block B", 120, "None", "group", "RNSIT Chess Club"),
    ("Sports Day Trials — Track & Field", "Sports", "Open trials for the inter-college athletics team: 100m, 200m, 400m, long jump and relay. Trials run in heats, so come early.", "East Ground, Sports Complex", 80, "Sports shoes and sportswear", "group", "Sports Council"),
    ("Film Club Screening — Recent Bengali Cinema", "Arts & Culture", "A subtitled screening of a recent Bengali feature with a short introduction on its place in the region, followed by a discussion.", "Auditorium 2, Block B", 100, "None", "individual", None),
    ("Volunteer Training: First Aid at Events", "Social", "Practical training for student volunteers: crowd management, first response, radio protocol and evacuation procedure for college events.", "Central Library, Ground Floor", 45, "None", "group", "NSS Unit"),
    ("Photography Exhibition: Campus Through the Year", "Arts & Culture", "An exhibition of the best campus photographs submitted through the year, with prints available and a short talk by the judging panel.", "Design Studio, Block D", 80, "None", "group", "Photography Club"),
    ("Open Mic: Poetry Evening", "Arts & Culture", "Ten minutes each, no themes, applause-based. Sign-up at the entrance from 6 PM; the evening is bilingual.", "Central Library, Ground Floor", 60, "None", "individual", None),
]

# Community definitions: (name, description, chat_seed_theme)
COMMUNITY_TEMPLATES = [
    ("Coding Club", "The RNSIT Coding Club. Problem solving, weekly contests, and building things on weekends. All skill levels welcome — bring your laptop and your frustration with recursion.", "coding"),
    ("Robotics & IoT Club", "Hardware, sensors, motors and firmware. We build the line-followers, the rovers and the campus IoT nodes.", "robotics"),
    ("Design Collective", "Designers, illustrators and builders of interfaces. Critique sessions every Friday and a proper design system we maintain together.", "design"),
    ("Photography Circle", "Photo walks, editing sessions and print critiques. From phone shooters to people with a real camera and a tripod.", "photo"),
    ("Business & Startups", "Campus entrepreneurs. We run the pitch night, the idea clinic and the internship sprint, and we are serious about talking about unit economics.", "business"),
    ("Music Collective", "Bands, soloists, producers and stage crew. We practise on Wednesday nights and play for real events twice a year.", "music"),
    ("AI & ML Reading Group", "Papers, implementations and experiments. Everyone presents at least once. No gatekeeping, no 'just read the abstract'.", "ai"),
    ("Astronomy Club", "Telescope nights on the terrace, astrophotography, and the RNSIT satellite tracking project.", "astro"),
    ("Debate & Communication", "The campus debate circuit. Weekly rounds, parliamentary format, and monthly inter-college practice bouts.", "debate"),
    ("Web Dev Sprinters", "Ship one thing a month. React, Node, Postgres, deployments. We review each other's PRs and pair on weekends.", "webdev"),
    ("Placement Prep Cell", "Everything placement-related: aptitude, DSA, mock interviews, resume reviews and referral sharing. The most useful room in the college.", "placement"),
    ("Sports Council", "All the teams, one group. Training schedules, gear, tournament logistics and the inevitable debate about playing surface.", "sports"),
]

# Chat lines per community theme. {a} = speaker name.
CHAT_SCRIPT = {
    "coding": [
        "Anyone up for today's LeetCode session at 6? Library, second floor.",
        "Posted the DP sheet for this week — start with the knapsack ones, they are easier than they look.",
        "That last Codeforces contest was brutal. C was the difference between a good rating and a great one.",
        "Reminder: the club's first round of the inter-college contest closes on Friday.",
        "I pushed the fix for the attendance portal, can someone review the PR?",
        "Which language do most of you actually use for contests?",
        "Debugging a recursion for 3 hours and it was a missing base case. Pain.",
        "Hackathon teams should finalise by tonight so we can print the certificates.",
        "Can someone explain graph BFS to me? I have watched three videos and it still refuses to click.",
        "DSA sheet for the week is up. Streak starts tomorrow.",
    ],
    "robotics": [
        "Line follower kits are in, come pick yours up from the club room.",
        "The IR sensor array is behaving oddly on the black tape. Anyone free to look at it?",
        "We got a 92% completion rate on the obstacle course. Last week was 61%.",
        "Battery life on the rover is about 25 minutes — need to fix the power distribution.",
        "Soldering session on Saturday, bring your own iron if you have one.",
        "The IoT dashboard is live now, temperature and humidity from three nodes.",
        "Who has the spare JGA25 motor mounts? We need four.",
        "We are running a line-following track at the fest, need volunteers on both days.",
        "PID tuning on the gimbal was the fix. It is steady now.",
    ],
    "design": [
        "Critique session at 5 today, bring whatever you are working on.",
        "Posted the updated colour tokens, the primary one is a bit darker now.",
        "Does anyone have a good icon set that is actually free for commercial use?",
        "The registration flow still loses people on the mobile step. I ran five people through it today.",
        "Figma file for the fest branding is open, please do not rename the top-level frames.",
        "Reminder that critique is about the work, not the person.",
        "Made three versions of the landing hero, the second one is clearly the one.",
        "Should we build a shared component library or keep each project separate? Genuinely asking.",
    ],
    "photo": [
        "Photo walk on Saturday, meet at the library gate at 7 AM. Golden hour light is the whole point.",
        "Shot the fest rehearsal last night, the lighting in the auditorium was dramatic.",
        "Anyone editing in Lightroom? Sharing my presets for the campus set.",
        "The print submission deadline is next Wednesday.",
        "Got permission for the drone shoot over the sports ground, it looks unreal from up there.",
        "Long exposure of the light trail at the main gate, that came out well.",
        "Critique night is going to be longer this week because there are so many submissions.",
        "Reminder: the exhibition needs a title for each print.",
    ],
    "business": [
        "Pitch night sign-up closes Thursday, we have nine slots and they will go fast.",
        "Reviewed your deck. Cut slides 3 to 6, the story is stronger without them.",
        "The unit economics slide needs the CAC number, not just a market size claim.",
        "We got the mentorship slot confirmed for three teams from the incubator.",
        "Customer interviews for the canteen queue app — who is free this week?",
        "Reminder: the internship sprint is for placements, not for people who already have one.",
        "The registration page for the fest should ask for the department before the year.",
        "Talking to a local printer about rates for the stall, will share the quote.",
    ],
    "music": [
        "Practice room is booked for Wednesday, 5 to 8.",
        "We need a second guitarist for the cultural night set.",
        "Recording the album track this weekend, need a quiet space.",
        "Sound check moved to 4 PM because of the exam schedule.",
        "Who is doing the setlist? We should decide before Friday.",
        "The band has a new arrangement for the finale, it is much better.",
        "Bringing the mixer from the sports complex for the open mic.",
        "Reminder: everyone in the choir needs to be there by 6 for the sound check.",
    ],
    "ai": [
        "This week's paper is on sparse attention — I will present the first half.",
        "Anyone running the experiments on a free Colab? I need a GPU for the larger one.",
        "Implementing the attention block from scratch in PyTorch, will push it tonight.",
        "Reminder: everyone presents at least once this term.",
        "The evaluation harness is in the repo, run it before you compare numbers.",
        "Questions about the training stability in section 4, anyone get that?",
        "Found a bug in the data preprocessing, fixing it and re-running.",
        "The reading list for the semester is up.",
    ],
    "astro": [
        "Telescope night on the terrace, weather looks clear for Friday.",
        "Saturn was crisp tonight at 200x, everyone should come see it.",
        "The satellite tracking project got its mount approval.",
        "Astrophotography submissions for the exhibition are open.",
        "Someone check the power on the projector for the talk next week.",
        "New moon is on the 14th, best night of the month.",
        "The dome light keeps interfering with the sensors, we need to cover it.",
        "Bringing the star chart for anyone who does not know what to look at.",
    ],
    "debate": [
        "This week's motion: should college attendance be compulsory. Prep thread is up.",
        "Practice bout at 5, two teams confirmed, two slots open.",
        "Feedback on your POI delivery was strong. Slow down a touch on the rebuttal.",
        "Inter-college nationals team announcement on Friday.",
        "Motion writing workshop before the prelims, everyone should attend.",
        "Can we get more people for the audience side, judging quality matters.",
        "The best POI this round was on the funding argument, genuinely good.",
        "Reminder: the format has changed, re-read the rules.",
    ],
    "webdev": [
        "Shipping one thing a month. What is everyone working on?",
        "Moved the API to Postgres with proper migrations, no more duplicate rows.",
        "Anyone deploying to Vercel with a monorepo, I want to compare setups.",
        "Pairing on the auth flow tonight, library, 7 PM.",
        "Deployed the new landing page, the build time is down to 40 seconds.",
        "The webhook retry logic was dropping events, fixed and pushed.",
        "Reviewing PRs every Sunday at 11, bring your WIP.",
        "Reminder: the sprint demo is next Friday, five minutes each.",
    ],
    "placement": [
        "Aptitude test 1 is scheduled for Saturday, 10 AM, hall 3.",
        "Sharing the referral list for the drive, use it properly.",
        "Mock interview slots for 3rd years open tonight.",
        "Attached the DSA sheet with the company-wise pattern split.",
        "If you have applied anywhere, update the tracker so others can follow up.",
        "Two of us from last year are taking mock interviews this week.",
        "The resume clinic needs more reviewers, message me.",
        "Reminder: group 2 submissions close Sunday night.",
    ],
    "sports": [
        "Football trials at 4 PM, bring the indoor kit.",
        "Cricket practice is on the east ground, weather looks fine.",
        "Basketball league schedule is out, we play four matches before the finals.",
        "Need to order new bibs for the tournament, sizes collected.",
        "The ground is booked for the inter-college match on the 12th.",
        "Fitness test for the athletics trials is at 7 AM sharp.",
        "Anyone have the scorecard from the last match?",
        "Trophy engraving deadline is Friday, send the team name in the right spelling.",
    ],
}

DM_SCRIPT = [
    [
        ("Hey! Saw your post about the DSA bootcamp — is it still open for second years?", "Yes, we have about 12 seats left. Do you have any coding background?"),
        ("A bit of Java from the 1st year labs, nothing beyond loops and arrays honestly.", "That is more than enough. Most people start from the same place. Saturday's session covers the basics anyway."),
        ("That works. Which block is it in?", "CSE Lab 2, Block B, from 10 AM to 1 PM."),
        ("Perfect, I will be there. Thanks!", "See you there. Bring a laptop if you have one, we have spares otherwise."),
    ],
    [
        ("Hi, I need a poster for our club's technical fest. Are you taking commissions?", "I am, yes. What is the event, what size, and when do you need it?"),
        ("Tech fest, 22nd to 24th, and I need an A2 vertical banner plus the square Instagram versions.", "Send me the event name, date and the department logo. Give me a day and I will send you two options to choose from."),
        ("Perfect. Here is the logo file.", "Got it, I will start tonight."),
        ("Also do you do a rush fee?", "No rush fee for campus clubs, you cover my printing cost and that is it."),
        ("That is very fair, thank you!", "Any time. I will send the first draft tomorrow evening."),
    ],
    [
        ("Hey, are you the one who took the mock interview last week? The feedback was genuinely useful.", "That was me! Glad it helped. Are you preparing for the same drive?"),
        ("Yes, same one. Do you think I should add the internship I did to the projects section?", "Yes, but lead with one line on what you actually did. Recruiters stop at the bullet points that say nothing."),
        ("Good point, I will rewrite it tonight.", "Send it to me when you are done, I will read it."),
        ("Thanks, really appreciate it.", "Happy to help. Reach out any time."),
    ],
    [
        ("Do you have the design files for the fest posters?", "Yes, the layered PSD and the print-ready PDF are in the shared drive."),
        ("Perfect, our treasurer needs the PDF for the printing quote.", "Send it across, tell me the paper size you need and I will check the margins."),
        ("A2 portrait, 200 DPI.", "That is already what I exported. I will share the link."),
        ("Much appreciated, you have saved us a lot of back and forth."),
    ],
    [
        ("Quick one — are you going to the inter-college coding contest?", "Yes, registered yesterday. Team of three for CSE, we still need one more person."),
        ("I could join if the team is still short.", "Perfect, you would be the third. Practice is Saturday morning, lab 1."),
        ("Count me in. What time does it start?", "9:30 AM, and the first warm-up round starts at 10."),
        ("Great, see you there.", "Will add you to the group."),
    ],
    [
        ("Hi, saw your GitHub. The README on your attendance project is really clean.", "Thanks! It took three rewrites to get it to that point."),
        ("Would you be up for pairing on the frontend for our department project?", "Sure, when are you free?", "I am usually free after 5 PM on weekdays and all day Saturday."),
        ("Thursday at 5 works for me, library?", "Library it is. I will bring the API docs so we can agree on the shape first."),
        ("Looking forward to it."),
    ],
    [
        ("Are you going to the placement cell workshop on Saturday?", "Yes, and I am going to the aptitude mock right after it."),
        ("Is the mock really as hard as last year's?", "Supposedly yes, but the pattern repeats, so the sheet helps a lot."),
        ("Can you share the sheet when you get it?", "Will do, I will upload it to the cell drive."),
        ("Thanks, that would help a lot."),
    ],
    [
        ("Hey, I need a drone shot of the main building for the fest promo.", "I can do that, I have the certification. Which day and what time of day?",
         "Sunday morning around 7, we want the golden hour light.", "That is my favourite slot. I will come to the block early and take the ground shots too if you need B-roll."),
        ("That would be great. We need about 40 seconds of usable footage.", "You will get that and then some. I will send you both the graded and the original files."),
    ],
    [
        ("Hi, I would like to learn Python from scratch for data analysis.", "Absolutely, that is my main area. Have you written any code before?", "Only a little in the lab, some loops and a few if statements."),
        ("That is a fine place to start. We will go slow for the first two sessions and build up from there.", "Great, when can we start?", "I have a slot on Tuesday and Thursday evenings, and Saturday mornings."),
        ("Tuesday evening works for me.", "Library, second floor, 6 PM. Bring a laptop if you have one.", "I will. Thank you!"),
    ],
    [
        ("Hey, could you review my Python code? It keeps failing on the last test case.", "Send it over. When you say the last test case, is it the one with the empty list?", "Yes, exactly that one.", "That is usually an off-by-one in the loop boundary. Send it and we will find it."),
    ],
    [
        ("Do you have the design files for the fest posters?", "Yes, the layered PSD and the print-ready PDF are in the shared drive."),
        ("Perfect, our treasurer needs the PDF for the printing quote.", "Send it across, tell me the paper size you need and I will check the margins."),
        ("A2 portrait, 200 DPI.", "That is already what I exported. I will share the link."),
    ],
    [
        ("Are you bringing the soldering kit to the robotics workshop?", "Yes, I have two soldering irons and enough solder. Do you have the soldering wicks?", "I have a few but they are old. I will order more before Saturday.", "Bring the old ones anyway, they still work. I have extra safety goggles if anyone needs them.", "Perfect, see you at the lab."),
    ],
    [
        ("Need a last-minute poster for the sports day. Can you turn it around by tonight?", "Send me the content and logo. Yes, I can do it tonight if you confirm by 8 PM.", "Confirmed, content is in the shared doc. Deadline tomorrow morning.", "Will have it to you by 11. Sending both the print file and the Instagram square.", "You are a lifesaver, thank you!"),
    ],
    [
        ("Your interview went well I hope?", "It did, I think. They asked a lot about the backend project, which I was ready for thanks to the mock sessions.", "Nice. When do they let you know?", "By Friday apparently.", "Let me know, I will keep my fingers crossed."),
    ],
    [
        ("Do you have the notes from the machine learning session?", "Yes, I cleaned them up and added the notebooks. Shared them in the drive folder.", "The attention implementation was genuinely helpful. One question though, why use a learnable temperature?", "The scale of the dot products changes with dimension, so a fixed temperature breaks down for longer sequences.", "That makes sense, thanks for explaining."),
    ],
    [
        ("I am building a campus lost and found app, want to team up?", "Interested. What is your stack?", "React and Supabase. I want real-time posting so people see items as they come in.", "That fits the app. I can do the backend and the image uploads. Send me the repo.", "Done, you have collaborator access. I added you on the backend role."),
    ],
    [
        ("Any news on the placement drive companies list?", "Eight so far. Four are open, two are in the approval stage and two I am still chasing.", "Can you share it with the cell?", "Uploaded to the drive folder with the drive dates.", "Thanks, that helps everyone prepare."),
    ],
    [
        ("Are you going to the cultural night rehearsal?", "Yes, at 4 in the auditorium for the sound check.", "I might be five minutes late, will you hold my spot?", "Will do."),
    ],
    [
        ("Hi, I need help setting up the AWS free tier for our project.", "Sure, what are you trying to deploy?", "A Node API and a Postgres database. I want them on a free tier that does not expire next month.", "Use an EC2 instance with a credit, not the free tier one that gets reclaimed. I can walk you through it on a call.", "That sounds much more stable. What do you need from me beforehand?", "An AWS account with a card verified, and access to the key you are using.", "Can we do a call today?", "Give me twenty minutes and I will send you the invite."),
    ],
    [
        ("Do you have a spare HDMI cable for the projector?", "I do, I will bring it. The one from the lab has been unreliable.", "Great, the seminar hall one is worse."),
    ],
    [
        ("Your English club session was really useful today.", "Thank you! Glad the practice helped. Have you tried the recording exercise I mentioned?", "Not yet, but I will. Thanks again for the feedback on my delivery.", "Come back next week, we are doing group discussions."),
    ],
    [
        ("Can I borrow your notes for the thermodynamics module?", "Sure, I will share the drive folder. I added the extra derivations too.", "You are a lifesaver, thanks!"),
    ],
    [
        ("Are we still doing the FOSS sprint on Sunday?", "Yes, and I have three issues lined up that are beginner friendly.", "Perfect. I will review the ones nobody picks up.", "Deal. See you Sunday."),
    ],
]

SKILL_REQUEST_MESSAGES = [
    "Hi, I saw your skill listing and I am stuck on exactly this. Could you help me for an hour?",
    "I am preparing for the placement drive and this is one of the topics I keep getting stuck on. Would you be available this week?",
    "We have a project deadline next month and we need help with this specific part. Would you take it on?",
    "I would like to book a session for this. I can pay the listed rate, or we can do it as a skill swap — I can help you with X in return.",
    "Hey, complete beginner here. Would you be patient with me and start from the basics?",
    "Our club is running a session on this topic and we would love to have you as the mentor for it.",
]

REVIEW_COMMENTS = [
    "Explained it properly instead of just telling me the answer. Very patient with questions.",
    "Took the time to actually understand where I was stuck. Genuinely helpful session.",
    "Practical and to the point. Would definitely book again.",
    "Shared their own notes and templates afterwards. Great value.",
    "Clear communication, and the follow-up message after the session was a nice touch.",
    "Solved my problem in half the time I expected. Highly recommended.",
    "Friendly and encouraging. Exactly what I needed to get unstuck.",
    "Well structured. The only note is that it went a bit fast in the last third.",
    "Really kind about my very basic questions. Learned a lot.",
    "Good session. The examples were from real projects, which made it click.",
    "Fixed the bug I had been stuck on for two days. Lifesaver.",
    "Very thorough and well prepared. Brought printed notes for me.",
    "Good at adapting the pace. Skipped what I already knew and focused on the gaps.",
    "Helped me understand the concept, not just the syntax. That is what I needed.",
    "Solid session, easy to book and easy to reach afterwards.",
    "Showed me a cleaner approach than the one I was using. Big improvement.",
]

PROJECT_TEMPLATES = [
    ("Campus Attendance Portal", "A web portal where departments mark attendance and students can see their own record across every subject, with a low-bandwidth mode for the college Wi-Fi.", "github.com/rnsit/campus-attendance"),
    ("Skill Exchange Backend", "The REST API and realtime layer behind GTA itself — profiles, skills, activity listings and a messaging queue that handles classroom-scale traffic.", "github.com/rnsit/skill-exchange-api"),
    ("Fresher Navigation App", "A mobile app that shows first years every building, lab and office on campus, with indoor routing and a live canteen queue estimate.", "github.com/rnsit/campus-nav"),
    ("Club Fest Manager", "A single dashboard for club secretaries to create events, collect registrations, track attendance and print certificates in one go.", "github.com/rnsit/fest-manager"),
    ("Study Group Scheduler", "Matches students who want to study together by subject, time and intensity, then books them into a shared study room.", "github.com/rnsit/study-match"),
    ("Placement Prep Tracker", "Tracks every student's application, referral, aptitude score and interview round across a campus-wide drive, with a shared referral pool.", "github.com/rnsit/placement-tracker"),
    ("Library Seat Booker", "Real-time seat availability across the central library, with a token system that stops the same seat being claimed twice.", "github.com/rnsit/seat-booker"),
    ("Canteen Cashless Payment", "A campus-wide tap-to-pay card for the canteen and the food stalls, with a student budget cap and a monthly statement.", "github.com/rnsit/cashless-canteen"),
    ("IoT Campus Energy Monitor", "Smart meters on the classrooms and labs with a live dashboard showing consumption per block and flagging abnormal usage.", "github.com/rnsit/energy-monitor"),
    ("Lost and Found Board", "A simple board where found items are posted with a photo and claimants can claim them with a one-time code.", "github.com/rnsit/lost-found"),
    ("Notes Sharing Platform", "Structured notes per subject and per branch, with version history and peer review before a note is published.", "github.com/rnsit/notes-platform"),
    ("Sports Tournament Manager", "Fixtures, team sheets, live scores and a bracket for the annual inter-hostel tournaments.", "github.com/rnsit/tournament-manager"),
    ("Waste Segregation Dashboard", "Bin-fill sensors across the campus feeding a dashboard that routes the collection vehicle when a bin is full.", "github.com/rnsit/waste-dashboard"),
    ("AI Doubt Solver", "A retrieval-augmented assistant that answers questions from the course notes and past question papers, and admits when it does not know.", "github.com/rnsit/ai-doubt-solver"),
    ("Bus Tracker", "Live GPS positions of the campus buses with an arrival-time estimate for each stop, shown on a simple map.", "github.com/rnsit/bus-tracker"),
    ("Portfolio Builder", "A tool where students assemble a portfolio from their skills, projects and reviews into a shareable single page.", "github.com/rnsit/portfolio-builder"),
    ("Campus Events API", "A unified API over every club's event data, so students can see all campus events in one calendar instead of eleven group chats.", "github.com/rnsit/campus-events-api"),
    ("Feedback Kiosk", "An anonymous, kiosk-style feedback system for students to rate course and faculty, with aggregation that protects individual anonymity.", "github.com/rnsit/feedback-kiosk"),
    ("Second-hand Marketplace", "A verified campus marketplace for second-hand textbooks, lab coats and hostel equipment, with student ID verification.", "github.com/rnsit/campus-marketplace"),
    ("Weather Station Network", "A network of low-cost weather stations around campus feeding a live map and a forecasting model for the annual sports day.", "github.com/rnsit/weather-network"),
]

PROJECT_SKILL_ROLES = [
    "Frontend", "Backend", "Database & Schema", "Realtime & WebSockets", "Auth & RBAC",
    "UI/UX Design", "DevOps & Deployment", "Data Pipeline", "Mobile (React Native)", "Testing & QA",
]


# --------------------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------------------


def chunked(seq, size):
    for i in range(0, len(seq), size):
        yield seq[i : i + size]


def past_iso(days_ago: float) -> str:
    ts = datetime.now(UTC) - timedelta(days=days_ago)
    return ts.isoformat(timespec="seconds")


def ist_midnight(day: datetime) -> datetime:
    return datetime(day.year, day.month, day.day, 0, 0, 0, tzinfo=IST)


def fmt_date(day: datetime) -> str:
    return day.strftime("%a, %d %b %Y")


def fmt_time(hour: int, minute: int = 0) -> str:
    suffix = "AM" if hour < 12 else "PM"
    h12 = hour if 1 <= hour <= 12 else (hour - 12 if hour > 12 else 12)
    return f"{h12}:{minute:02d} {suffix}"


# --------------------------------------------------------------------------------------
# Seeding
# --------------------------------------------------------------------------------------


def ensure_auth_accounts(accounts: list[dict]) -> dict[str, str]:
    """Create (or repair) the auth users. Returns {email: user_id}."""
    existing = {}
    page = 1
    while True:
        res = _request("GET", f"/auth/v1/admin/users?page={page}&per_page=200")
        if not res or not res.get("users"):
            break
        for u in res["users"]:
            existing[u["email"]] = u["id"]
        if len(res["users"]) < 200:
            break
        page += 1

    ids = {}
    for acc in accounts:
        email = acc["email"]
        payload = {
            "email": email,
            "password": DEMO_PASSWORD,
            "email_confirm": True,
            "user_metadata": {
                "full_name": acc["full_name"],
                "department": acc["department"],
                "academic_year": acc["academic_year"],
            },
        }
        if email in existing:
            uid = existing[email]
            # Reset the password and make sure the account is confirmed + named.
            _request(
                "PUT",
                f"/auth/v1/admin/users/{uid}",
                {
                    "password": DEMO_PASSWORD,
                    "email_confirm": True,
                    "user_metadata": payload["user_metadata"],
                },
            )
        else:
            res = _request("POST", "/auth/v1/admin/users", payload)
            uid = res["id"]
        ids[email] = uid
    return ids


def _count(table: str, flt: str) -> int:
    """Exact row count for a filtered query, via PostgREST's count=exact header."""
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{table}?{flt}",
        headers={
            "apikey": SERVICE_KEY,
            "Authorization": f"Bearer {SERVICE_KEY}",
            "Prefer": "count=exact",
            "Range": "0-0",
        },
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        content_range = resp.headers.get("Content-Range", "")
    total = content_range.split("/")[-1]
    return int(total) if total.isdigit() else 0


MANIFEST_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".seeded_emails.json")


def _load_manifest() -> set:
    try:
        with open(MANIFEST_PATH, encoding="utf-8") as fh:
            return set(json.load(fh))
    except (OSError, ValueError):
        return set()


def _save_manifest(emails: set):
    with open(MANIFEST_PATH, "w", encoding="utf-8") as fh:
        json.dump(sorted(emails), fh, indent=2)


def remove_legacy_accounts(accounts):
    """Delete leftover test accounts that are not part of the demo roster.

    The database was seeded by hand during development, so it carries a few
    placeholder accounts ("Doreamon", "kumar", ...). They own no content, but
    they do show up in /people and would make the roster look wrong.

    Two groups are removed:

    1. Accounts a PREVIOUS run of this seeder created that are no longer in
       the roster (a name was renamed, a collision suffix changed). These are
       tracked in `.seeded_emails.json`, so we know we made them and it is
       safe to remove them and everything they own.
    2. Any other account that is not in the roster AND owns no rows anywhere.

    Anything the team actually created is left alone.
    """
    roster_emails = {a["email"] for a in accounts}
    previous = _load_manifest()
    stale = previous - roster_emails

    existing = {}
    page = 1
    while True:
        res = _request("GET", f"/auth/v1/admin/users?page={page}&per_page=200")
        if not res or not res.get("users"):
            break
        for u in res["users"]:
            existing[u["email"]] = u["id"]
        if len(res["users"]) < 200:
            break
        page += 1

    removed = []
    for email, uid in existing.items():
        if email in roster_emails:
            continue

        if email in stale:
            # We created it on an earlier run — delete it and everything it owns.
            _purge_account_rows(uid)
            _request("DELETE", f"/auth/v1/admin/users/{uid}", expect_json=False)
            removed.append(email)
            continue

        # Otherwise only remove it when it owns nothing at all.
        owned = 0
        for table in (
            "skills", "activities", "projects", "reviews", "bookmarks",
            "community_members", "activity_participants", "project_collaborators",
            "teachers",
        ):
            owned += _count(table, f"user_id=eq.{uid}")
        owned += _count("skill_requests", f"requester_id=eq.{uid}")
        owned += _count("skill_requests", f"owner_id=eq.{uid}")
        owned += _count("messages", f"sender_id=eq.{uid}")
        owned += _count("messages", f"receiver_id=eq.{uid}")
        owned += _count("connections", f"sender_id=eq.{uid}")
        owned += _count("connections", f"receiver_id=eq.{uid}")
        if owned:
            continue
        _request("DELETE", f"/auth/v1/admin/users/{uid}", expect_json=False)
        removed.append(email)

    _save_manifest(roster_emails)
    return removed


def _purge_account_rows(uid: str):
    """Delete every row a seeded account owns, including the ones that do not
    reference auth.users with a cascade (messages, connections, reviews...)."""
    for table in ("reviews", "bookmarks", "messages", "connections", "skill_requests"):
        for col in ("user_id", "sender_id", "receiver_id", "requester_id", "owner_id"):
            try:
                delete_all(table, f"{col}=eq.{uid}")
            except Exception:  # noqa: BLE001 - the column may not exist on this table
                pass


def seed_profiles(accounts, ids):
    rows = []
    for i, acc in enumerate(accounts):
        uid = ids[acc["email"]]
        avatar = f"https://i.pravatar.cc/400?u={acc['email']}"
        banner = None
        if acc["role"] == "student" and i % 3 == 0:
            banner = f"https://picsum.photos/seed/gtabanner{i}/1200/320"
        bio = acc["bio"]
        if acc.get("usn"):
            bio = f"USN: {acc['usn']}. {bio}"
        rows.append(
            {
                "user_id": uid,
                "full_name": acc["full_name"],
                "email": acc["email"],
                "department": acc["department"],
                "academic_year": acc["academic_year"],
                "bio": bio,
                "avatar_url": avatar,
                "banner_url": banner,
                "role": acc["role"],
                "github_url": f"https://github.com/{acc['email'].split('@')[0].replace('.', '')}"
                if acc["role"] == "student" and i % 4 == 0
                else None,
                "linkedin_url": None,
                "portfolio_url": None,
                "updated_at": datetime.now(UTC).isoformat(timespec="seconds"),
            }
        )
    upsert("profiles", rows, "user_id")
    return rows


def seed_teachers(accounts, ids):
    rows = []
    for acc in accounts:
        if acc["role"] != "teacher":
            continue
        rows.append(
            {
                "user_id": ids[acc["email"]],
                "full_name": acc["full_name"],
                "email": acc["email"],
                "department": acc["department"],
                "designation": acc["designation"],
                "experience": acc["experience"],
                "expertise": acc["expertise"],
                "cabin_location": acc["cabin_location"],
            }
        )
    upsert("teachers", rows, "user_id")
    return rows


def seed_skills(students, ids):
    """Give every student one to three skills drawn from the category pool."""
    # Track which (category, index) pairs are already used so titles stay unique.
    used = set()
    rows = []
    skill_index = 0

    for si, st in enumerate(students):
        uid = ids[st["email"]]
        # Weighted skill count: a core group is very active, most have one or two.
        r = RNG.random()
        if r < 0.28:
            n = 3
        elif r < 0.72:
            n = 2
        else:
            n = 1

        # Top contributors get more.
        if si < 8:
            n = 3

        # Bias the category towards the student's department.
        preferred = {
            "Computer Science": "Programming & Tech",
            "Information Science": "Programming & Tech",
            "Electronics": "Programming & Tech",
            "Mechanical": "Other",
            "Civil": "Other",
            "Electrical": "Programming & Tech",
            "MBA": "Business",
            "MCA": "Programming & Tech",
        }[st["department"]]

        cats = [preferred]
        cats += [c for c in SKILL_CATEGORIES if c != preferred]
        RNG.shuffle(cats)

        for k in range(n):
            cat = cats[k % len(cats)]
            pool = SKILL_POOL[cat]
            # Prefer an unused entry, otherwise allow reuse with a different owner.
            choice = None
            for _ in range(12):
                idx = RNG.randrange(len(pool))
                if (cat, idx) not in used:
                    choice = idx
                    break
            if choice is None:
                choice = RNG.randrange(len(pool))
            used.add((cat, choice))
            title, desc, experience, rate = pool[choice]
            desc = desc + " " + RNG.choice(SKILL_DESC_SUFFIXES)
            rows.append(
                {
                    "user_id": uid,
                    "title": title,
                    "description": desc,
                    "category": cat,
                    "experience": experience,
                    "hourly_rate": rate,
                    "availability": RNG.choice(
                        ["Weekdays", "Weekends", "Evenings (After 5 PM)", "Flexible"]
                    ),
                    "created_at": past_iso(RNG.uniform(1, 75)),
                    "updated_at": past_iso(RNG.uniform(0, 1)),
                }
            )
            skill_index += 1
    # Return the INSERTED rows — the caller needs the generated ids.
    return insert("skills", rows)


def seed_activities(students, teachers, ids):
    """Create the campus event calendar: past, present and upcoming."""
    rows = []
    people = [("student", s) for s in students] + [("teacher", t) for t in teachers]

    for idx, (title, category, desc, venue, cap, reqs, org_type, group_name) in enumerate(
        ACTIVITY_TEMPLATES
    ):
        # 78% student-organised, 22% faculty-organised.
        if RNG.random() < 0.22:
            kind, person = RNG.choice([p for p in people if p[0] == "teacher"])
        else:
            kind, person = RNG.choice([p for p in people if p[0] == "student"])
        uid = ids[person["email"]]

        # Spread events from three weeks ago to four months out.
        offset = RNG.randint(-20, 125)
        day = (datetime.now(IST) + timedelta(days=offset)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        hour = RNG.choice([9, 10, 11, 14, 15, 16, 17, 18, 19])
        minute = RNG.choice([0, 0, 30])

        deadline = ist_midnight(day) - timedelta(hours=6)
        # A handful of upcoming events are still awaiting faculty approval so the
        # teacher dashboard has real work in it during the demo.
        approval = "approved"
        if offset > 0 and RNG.random() < 0.18:
            approval = "pending"

        # The open house is the event this platform gets demoed at, so it is
        # pinned to tomorrow and always approved - it must never read as a
        # stale past event or sit in the approval queue.
        if title == "Open House: Meet the Departments":
            offset = 1
            day = (datetime.now(IST) + timedelta(days=offset)).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
            hour, minute = 11, 30
            deadline = ist_midnight(day) - timedelta(hours=6)
            approval = "approved"

        rows.append(
            {
                "user_id": uid,
                "title": title,
                "description": desc,
                "category": category,
                "date": fmt_date(day),
                "time": fmt_time(hour, minute),
                "venue": venue,
                "max_participants": cap,
                "requirements": reqs,
                "organizer_type": org_type,
                "group_name": group_name,
                "photo_url": f"https://picsum.photos/seed/gtaact{idx}/800/450",
                "deadline": deadline.astimezone(UTC).isoformat(timespec="seconds"),
                "approval_status": approval,
                "created_at": past_iso(RNG.uniform(2, 60)),
                "updated_at": past_iso(RNG.uniform(0, 2)),
            }
        )

    # A few extra student-organised events so the listing is long.
    extra_titles = [
        ("Study Group: Operating Systems", "Academic", "Weekly OS problem-solving and doubt clearing for the third-year batch."),
        ("Mini Project Showcase — ISE", "Academic", "Second-year ISE teams present their mini projects to faculty and peers."),
        ("Open Kitchen: South Indian Specials", "Arts & Culture", "A cook-off with teams of three, judged by the hostel mess staff."),
        ("Sunrise Run — 5KM", "Sports", "A 5km run around the campus loop, finishing at the sports complex for breakfast."),
        ("Volunteer Drive: Campus Clean-Up", "Social", "A morning clean-up drive across the quadrangle and the hostel blocks."),
        ("Dev Tools Meetup: Local-First Apps", "Technology", "A hands-on session on building apps that work without a network."),
        ("Public Speaking Masterclass", "Academic", "A two-hour workshop on structure, delivery and handling questions."),
        ("Startup Legal Basics", "Career", "Registration, IP and the first contracts a student founder needs."),
    ]
    for j, (title, category, desc) in enumerate(extra_titles):
        person = RNG.choice(students)
        uid = ids[person["email"]]
        day = (datetime.now(IST) + timedelta(days=RNG.randint(4, 100))).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        deadline = ist_midnight(day) - timedelta(hours=6)
        rows.append(
            {
                "user_id": uid,
                "title": title,
                "description": desc,
                "category": category,
                "date": fmt_date(day),
                "time": fmt_time(RNG.choice([10, 11, 15, 16, 17])),
                "venue": RNG.choice(VENUES),
                "max_participants": RNG.choice([20, 30, 40, 50, 80]),
                "requirements": "None",
                "organizer_type": "individual",
                "group_name": None,
                "photo_url": f"https://picsum.photos/seed/gtaactx{j}/800/450",
                "deadline": deadline.astimezone(UTC).isoformat(timespec="seconds"),
                "approval_status": "approved" if RNG.random() < 0.75 else "pending",
                "created_at": past_iso(RNG.uniform(1, 30)),
                "updated_at": past_iso(RNG.uniform(0, 1)),
            }
        )

    # Return the INSERTED rows — the caller needs the generated ids.
    return insert("activities", rows)


def seed_participants(activities, students, ids):
    """Fill events with attendees, respecting each event's capacity."""
    rows = []
    student_ids = [ids[s["email"]] for s in students]
    for act in activities:
        cap = act["max_participants"] or 30
        # Leave some events mostly empty so the "X of Y joined" bar looks real.
        take = RNG.randint(min(3, cap), max(3, int(cap * RNG.uniform(0.15, 0.85))))
        take = min(take, cap)
        for uid in RNG.sample(student_ids, min(take, len(student_ids))):
            rows.append(
                {
                    "activity_id": act["id"],
                    "user_id": uid,
                    "joined_at": past_iso(RNG.uniform(0, 40)),
                }
            )
    # De-duplicate (activity, user) pairs.
    seen = set()
    deduped = []
    for r in rows:
        key = (r["activity_id"], r["user_id"])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(r)
    insert("activity_participants", deduped)
    return deduped


def seed_communities(accounts, ids, students, teachers):
    """Create communities with leadership, membership and chat history."""
    students_only = [a for a in accounts if a["role"] == "student"]
    teachers_only = [a for a in accounts if a["role"] == "teacher"]

    community_rows = []
    for name, desc, theme in COMMUNITY_TEMPLATES:
        teacher = RNG.choice(teachers_only)
        creator = RNG.choice(students_only + teachers_only)
        president = RNG.choice(students_only)
        vp = RNG.choice([s for s in students_only if s is not president])
        community_rows.append(
            {
                "name": name,
                "description": desc,
                "created_by": ids[creator["email"]],
                "leader_id": ids[teacher["email"]],
                "president_id": ids[president["email"]],
                "vice_president_id": ids[vp["email"]],
                "created_at": past_iso(RNG.uniform(30, 120)),
            }
        )
    created = insert("communities", community_rows)

    member_rows = []
    message_rows = []
    name_by_uid = {ids[a["email"]]: a["full_name"] for a in accounts}

    for community, template in zip(created, COMMUNITY_TEMPLATES):
        name, desc, theme = template
        cid = community["id"]
        # Leadership + a random slice of students as accepted members.
        leaders = {community["created_by"], community["leader_id"], community["president_id"], community["vice_president_id"]}
        member_count = RNG.randint(14, 34)
        members = set(leaders)
        for s in RNG.sample(students_only, member_count):
            members.add(ids[s["email"]])
        # A few pending join requests for the teacher dashboard to approve.
        pending = RNG.sample(students_only, RNG.randint(2, 5))
        pending_ids = {ids[s["email"]] for s in pending} - members

        for uid in members:
            member_rows.append(
                {
                    "community_id": cid,
                    "user_id": uid,
                    "status": "accepted",
                    "joined_at": past_iso(RNG.uniform(1, 90)),
                }
            )
        for uid in pending_ids:
            member_rows.append(
                {
                    "community_id": cid,
                    "user_id": uid,
                    "status": "pending",
                    "joined_at": past_iso(RNG.uniform(0, 6)),
                }
            )

        # Group chat.
        script = CHAT_SCRIPT[theme]
        chat_participants = [u for u in members if u in name_by_uid]
        for i, line in enumerate(script):
            speaker = RNG.choice(chat_participants)
            message_rows.append(
                {
                    "community_id": cid,
                    "sender_id": speaker,
                    "content": line,
                    "created_at": past_iso(RNG.uniform(0.05, 40)),
                }
            )

    insert("community_members", member_rows)
    insert("community_messages", message_rows)
    return created, member_rows, message_rows


def seed_connections_and_messages(accounts, ids):
    """Direct messages + the connection rows that make them show up in the UI."""
    students = [a for a in accounts if a["role"] == "student"]
    connection_rows = []
    message_rows = []
    used_pairs = set()

    def pair_key(a, b):
        return tuple(sorted((a, b)))

    # Conversations drawn from the DM script.
    for convo in DM_SCRIPT:
        # Pick a pair that has not been used yet.
        for _ in range(60):
            a, b = RNG.sample(students, 2)
            ua, ub = ids[a["email"]], ids[b["email"]]
            if pair_key(ua, ub) in used_pairs:
                continue
            used_pairs.add(pair_key(ua, ub))
            break
        else:
            continue

        # Who sent the first message (and therefore the request).
        ua, ub = ids[a["email"]], ids[b["email"]]
        status = "accepted"
        if RNG.random() < 0.22:
            status = "pending"
        connection_rows.append(
            {
                "sender_id": ua,
                "receiver_id": ub,
                "status": status,
                "created_at": past_iso(RNG.uniform(1, 30)),
            }
        )

        # Only accepted connections carry a message thread; a pending request has
        # the greeting that triggered it.
        if status == "accepted":
            lines = convo
        else:
            lines = convo[:1]

        base = RNG.uniform(1, 20)
        for i in range(0, len(lines), 2):
            msg_a, msg_b = lines[i], lines[i + 1] if i + 1 < len(lines) else None
            message_rows.append(
                {
                    "sender_id": ua,
                    "receiver_id": ub,
                    "content": msg_a,
                    "read": RNG.random() < 0.7,
                    "created_at": past_iso(base + i * 0.02),
                }
            )
            if msg_b:
                message_rows.append(
                    {
                        "sender_id": ub,
                        "receiver_id": ua,
                        "content": msg_b,
                        "read": RNG.random() < 0.7,
                        "created_at": past_iso(base + i * 0.02 + 0.01),
                    }
                )

    # Extra connections, most of them carrying a short thread so the Direct
    # message list is not full of empty conversations.
    OPENERS = [
        ("Hey, saw you are in the coding club too. What are you working on?", "A campus attendance app. You?"),
        ("Hi! Are you going to the placement prep session this evening?", "Yes, I am. Are you going to the aptitude part as well?"),
        ("Hello, do you have the reference notes for the DBMS unit tests?", "I do, I will share the folder with you."),
        ("Hey, quick one — is the drone photography workshop still open?", "Yes, there are four seats left."),
        ("Hi, are you presenting at the poster day?", "Yes, project 14, at 2 PM."),
        ("Hey, thanks for the session yesterday. It really helped.", "Glad it did. Do the homework and it will stick."),
        ("Hi, are you interested in the inter-college hackathon?", "Very. Which track are you going for?", "The campus one. Still deciding on the rest."),
        ("Hello, are you from ISE?", "Yes, 3rd year. And you?", "MCA, 1st year. I am trying to find people from ISE for the FOSS sprint."),
    ]
    for i in range(55):
        for _ in range(60):
            a, b = RNG.sample(students, 2)
            ua, ub = ids[a["email"]], ids[b["email"]]
            if pair_key(ua, ub) in used_pairs:
                continue
            used_pairs.add(pair_key(ua, ub))
            break
        else:
            continue

        status = RNG.choice(["accepted", "accepted", "accepted", "pending", "rejected"])
        connection_rows.append(
            {
                "sender_id": ua,
                "receiver_id": ub,
                "status": status,
                "created_at": past_iso(RNG.uniform(1, 60)),
            }
        )
        if status != "accepted":
            continue
        opener = RNG.choice(OPENERS)
        base = RNG.uniform(1, 40)
        message_rows.append(
            {
                "sender_id": ua,
                "receiver_id": ub,
                "content": opener[0],
                "read": RNG.random() < 0.6,
                "created_at": past_iso(base),
            }
        )
        if RNG.random() < 0.8:
            message_rows.append(
                {
                    "sender_id": ub,
                    "receiver_id": ua,
                    "content": opener[1],
                    "read": RNG.random() < 0.6,
                    "created_at": past_iso(base - 0.02),
                }
            )

    insert("connections", connection_rows)
    insert("messages", message_rows)
    return connection_rows, message_rows


def seed_skill_requests(skills, accounts, ids):
    """Structured requests against real skills, in every lifecycle state."""
    rows = []
    owner_by_skill = {s["id"]: s["user_id"] for s in skills}
    for sk in skills:
        if RNG.random() < 0.45:
            continue
        owner = owner_by_skill[sk["id"]]
        candidates = [a for a in accounts if ids[a["email"]] != owner]
        requester = RNG.choice(candidates)
        status = RNG.choice(["pending", "pending", "accepted", "declined"])
        rows.append(
            {
                "skill_id": sk["id"],
                "requester_id": ids[requester["email"]],
                "owner_id": owner,
                "message": RNG.choice(SKILL_REQUEST_MESSAGES),
                "status": status,
                "created_at": past_iso(RNG.uniform(0.5, 45)),
                "updated_at": past_iso(RNG.uniform(0, 0.5)),
            }
        )
    insert("skill_requests", rows)
    return rows


def seed_reviews(skills, activities, accounts, ids):
    """Reviews on skills and activities — the only public 'social proof' surface."""
    rows = []
    people = list(accounts)
    # Skill reviews.
    for sk in skills:
        if RNG.random() < 0.55:
            continue
        n = RNG.randint(1, 4)
        reviewers = RNG.sample([p for p in people if ids[p["email"]] != sk["user_id"]], n)
        for r in reviewers:
            rows.append(
                {
                    "user_id": ids[r["email"]],
                    "target_type": "skill",
                    "target_id": sk["id"],
                    "rating": RNG.choices([5, 4, 3], weights=[0.6, 0.32, 0.08])[0],
                    "comment": RNG.choice(REVIEW_COMMENTS),
                    "created_at": past_iso(RNG.uniform(1, 60)),
                }
            )
    # Activity reviews.
    for act in activities:
        if RNG.random() < 0.5:
            continue
        n = RNG.randint(1, 5)
        reviewers = RNG.sample([p for p in people if ids[p["email"]] != act["user_id"]], n)
        for r in reviewers:
            rows.append(
                {
                    "user_id": ids[r["email"]],
                    "target_type": "activity",
                    "target_id": act["id"],
                    "rating": RNG.choices([5, 4, 3], weights=[0.62, 0.3, 0.08])[0],
                    "comment": RNG.choice(REVIEW_COMMENTS),
                    "created_at": past_iso(RNG.uniform(1, 60)),
                }
            )
    insert("reviews", rows)
    return rows


def seed_bookmarks(skills, activities, accounts, ids):
    rows = []
    for sk in skills:
        for p in RNG.sample(accounts, RNG.randint(0, 3)):
            if ids[p["email"]] == sk["user_id"]:
                continue
            rows.append(
                {
                    "user_id": ids[p["email"]],
                    "target_type": "skill",
                    "target_id": sk["id"],
                    "created_at": past_iso(RNG.uniform(1, 50)),
                }
            )
    for act in activities:
        for p in RNG.sample(accounts, RNG.randint(0, 2)):
            if ids[p["email"]] == act["user_id"]:
                continue
            rows.append(
                {
                    "user_id": ids[p["email"]],
                    "target_type": "activity",
                    "target_id": act["id"],
                    "created_at": past_iso(RNG.uniform(1, 50)),
                }
            )
    insert("bookmarks", rows)
    return rows


def seed_projects(accounts, ids):
    """Projects with collaborators — the 'team' surface on the profile page."""
    project_rows = []
    owners = [a for a in accounts if a["role"] == "student"]
    used_titles = set()
    for i, (title, desc, gh) in enumerate(PROJECT_TEMPLATES):
        owner = owners[i % len(owners)]
        project_rows.append(
            {
                "user_id": ids[owner["email"]],
                "title": title,
                "description": desc,
                "github_link": f"https://{gh}",
                "team_members": None,
                "created_at": past_iso(RNG.uniform(10, 120)),
            }
        )
    created = insert("projects", project_rows)

    collaborator_rows = []
    for proj in created:
        pool = [a for a in accounts if a["email"]]
        teammates = RNG.sample(pool, RNG.randint(2, 5))
        for t in teammates:
            if ids[t["email"]] == proj["user_id"]:
                continue
            status = RNG.choices(
                ["accepted", "pending", "declined"], weights=[0.75, 0.18, 0.07]
            )[0]
            collaborator_rows.append(
                {
                    "project_id": proj["id"],
                    "user_id": ids[t["email"]],
                    "inviter_id": proj["user_id"],
                    "skill": RNG.choice(PROJECT_SKILL_ROLES),
                    "status": status,
                    "created_at": past_iso(RNG.uniform(5, 90)),
                    "responded_at": past_iso(RNG.uniform(0, 5)) if status != "pending" else None,
                }
            )
    insert("project_collaborators", collaborator_rows)
    return created, collaborator_rows


# --------------------------------------------------------------------------------------
# Credentials sheet
# --------------------------------------------------------------------------------------


def write_credentials(accounts, path):
    lines = [
        "# GTA Demo Accounts — RNSIT Open House",
        "",
        f"**Generated:** {datetime.now(IST).strftime('%d %b %Y, %I:%M %p IST')}  ",
        f"**Live URL:** https://gta-rnsit-project.vercel.app  ",
        f"**Shared password for every account:** `{DEMO_PASSWORD}`",
        "",
        "> All 79 accounts use the same password so you can hop between them live during the demo.",
        "> Every account is pre-confirmed — no email verification step.",
        "",
        "## Teachers (9)",
        "",
        "| # | Name | Email | Department | Designation |",
        "|---|------|-------|------------|-------------|",
    ]
    t = [a for a in accounts if a["role"] == "teacher"]
    for i, a in enumerate(t, 1):
        lines.append(
            f"| {i} | {a['full_name']} | `{a['email']}` | {a['department']} | {a['designation']} |"
        )
    lines += [
        "",
        "## Students (70)",
        "",
        "| # | Name | Email | Department | Year | USN |",
        "|---|------|-------|------------|------|-----|",
    ]
    s = [a for a in accounts if a["role"] == "student"]
    for i, a in enumerate(s, 1):
        lines.append(
            f"| {i} | {a['full_name']} | `{a['email']}` | {a['department']} | {a['academic_year']} | {a.get('usn','')} |"
        )
    lines += [
        "",
        "## What to show in the demo",
        "",
        "1. **Sign in as a teacher** (e.g. `dr.anil.sharma@rnsit.ac.in`) → *Manage* tab: approve the",
        "   pending events and pending community join requests.",
        "2. **Sign in as a student** (e.g. `tarun.s@rnsit.ac.in`) → Skills, Activities, Communities,",
        "   Messages, People, Faculty.",
        "3. **Live realtime demo:** open two browser windows, sign in as two different students,",
        "   and send a message in one — the other updates instantly.",
        "4. **Skill request flow:** student B requests a skill from student A → A sees it in the bell",
        "   notification and can accept/decline.",
        "5. **Campus Pulse** on the home page shows live counts and the Top Contributors board.",
        "",
    ]
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))
    return len(s), len(t)


# --------------------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------------------


def main():
    if not SERVICE_KEY:
        print("SUPABASE_SERVICE_ROLE_KEY is required", file=sys.stderr)
        return 1

    accounts = build_accounts()
    students = [a for a in accounts if a["role"] == "student"]
    teachers = [a for a in accounts if a["role"] == "teacher"]
    print(f"[1/9] roster: {len(students)} students, {len(teachers)} teachers")

    ids = ensure_auth_accounts(accounts)
    print(f"[2/9] auth accounts ready: {len(ids)}")

    removed = remove_legacy_accounts(accounts)
    if removed:
        print(f"      removed {len(removed)} leftover test accounts: {', '.join(removed)}")

    # Wipe the demo surfaces so a re-run is clean and idempotent.
    for table in [
        "reviews", "bookmarks", "skill_requests", "project_collaborators",
        "projects", "messages", "connections", "community_messages",
        "community_members", "communities", "activity_participants",
        "activities", "skills",
    ]:
        try:
            delete_all(table)
        except Exception as exc:  # noqa: BLE001
            print(f"      ! could not clear {table}: {exc}")
    print("[3/9] existing demo data cleared")

    seed_profiles(accounts, ids)
    print("[4/9] profiles written")

    seed_teachers(accounts, ids)
    print("[5/9] faculty directory written")

    skills = seed_skills(students, ids)
    activities = seed_activities(students, teachers, ids)
    print(f"[6/9] {len(skills)} skills, {len(activities)} activities")

    seed_participants(activities, students, ids)
    print(f"[7/9] activity participants written")

    communities, members, chat = seed_communities(accounts, ids, students, teachers)
    print(f"      {len(communities)} communities, {len(members)} memberships, {len(chat)} chat messages")

    conns, msgs = seed_connections_and_messages(accounts, ids)
    print(f"      {len(conns)} connections, {len(msgs)} direct messages")

    reqs = seed_skill_requests(skills, accounts, ids)
    revs = seed_reviews(skills, activities, accounts, ids)
    bms = seed_bookmarks(skills, activities, accounts, ids)
    print(f"      {len(reqs)} skill requests, {len(revs)} reviews, {len(bms)} bookmarks")

    projects, collabs = seed_projects(accounts, ids)
    print(f"      {len(projects)} projects, {len(collabs)} collaborators")

    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "credentials.md")
    ns, nt = write_credentials(accounts, out)
    print(f"[9/9] credentials written to {out} ({ns} students + {nt} teachers)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
