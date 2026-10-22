# GTA Bug Audit & Fix TODO

Audit dates: 2026-10-19 (first pass), 2026-10-22 (verification + round 2) against the live
Supabase project (`ylliuejawkswxnzfyiym`). Status: `[ ]` open, `[~]` in progress, `[x]` fixed.

Everything marked `[x]` below has been verified against the **live** database with real
signed-in sessions (see [Verification](#verification)). Items marked `[ ]` are genuine
follow-ups that were deliberately left out of scope.

---

## P1 — Core features broken

- [x] **A1. "Add Event" — student events vanish after creation (USER-REPORTED).**
  Students insert events with `approval_status='pending'` (RLS requires it), but `Home.tsx`
  and `AllActivities.tsx` filter out every non-approved event *including the owner's own*,
  so after the success toast the event disappears from the entire UI.
  Worse: all 7 live accounts are students — no teacher exists to approve anything, so 4/5
  live events are stuck pending forever.
  Fix: show the owner their own pending events in listings with a "Pending approval" badge,
  and change the success toast to say the event awaits faculty approval.
- [x] **A2. Project collaborator search always fails → invites can never be sent.**
  `AddProjectModal.tsx` built `.not('user_id','in',[])` with an empty array →
  malformed filter `user_id=not.in.` → PostgREST 400 → search always returned "no users".
  Fix: guard the empty array and fall back to a plain directory read.
- [x] **A3. Skill request flow never reached the owner.** The request row was created
  without `owner_id`, so the owner's request list was always empty. Fixed with a
  `BEFORE INSERT` trigger (`set_skill_request_owner`) plus the client passing the owner.
- [x] **A4. `notifications` never marked anything as read.** The app had no `read` column
  on `reviews` / `skill_requests`; reading is now persisted locally per user.
- [x] **A5. Review notifications could never be dismissed** — the "seen" state was never
  persisted, so every reload re-marked all historical reviews unread.
- [x] **A6. Community leader actions had no effect** — the leader could not promote /
  demote members because the update was optimistically reported as done.
- [x] **A7. A rejected community join request could never be re-requested.** The pair was
  locked out of the community forever. **Fixed by dropping the hard
  `UNIQUE(community_id, user_id)` constraint in favour of two partial unique indexes
  (`community_members_one_pending_per_pair`, `community_members_one_accepted_per_pair`)
  and adding a `BEFORE INSERT` trigger that clears a stale `rejected` row for the pair.**
- [x] **A7-CRITICAL (found 2026-10-22). Community join requests were 100% broken.**
  The `"Users can request community membership"` RLS policy read its own table:

  ```sql
  and not exists (select 1 from public.community_members existing
                   where existing.community_id = community_members.community_id ...)
  ```

  Postgres refuses to evaluate a policy that references the table it guards, so **every**
  insert raised `42P17 infinite recursion detected in policy for relation
  "community_members"`. The seeded membership rows were written with the service-role key
  (which bypasses RLS), so the demo data looked healthy while the real flow was dead.
  **Fixed** by moving the check into a `SECURITY DEFINER` helper
  (`public.has_membership_request`) — the same trick the SELECT policy already uses via
  `is_accepted_member()`. An audit of all 53 policies confirmed this was the **only**
  self-referencing policy left in the database.

## P2 — Data & correctness

- [x] **B1–B4.** Review/rating correctness, activity capacity, duplicate prevention and the
  `connections` / `project_collaborators` pair uniqueness fixes (all previously applied).
- [x] **B5.** `connections_one_per_pair` / `connections_no_self_pair` are live.
- [x] **B6.** Legacy `connections.status = 'declined'` rows are rejected by a CHECK
  constraint; the status domain is now `('pending','accepted','rejected')`.
- [x] **MEMBER COUNTS (regression, found 2026-10-22). Every community card showed
  "0 members".** The `community_members` SELECT policy was tightened so that non-members
  can only see their own row, which also hid the roster the member count was derived
  from. **Fixed** with a `SECURITY DEFINER` RPC `community_member_counts()` that returns
  counts only — no identities — so the counts stay visible without re-opening the
  membership table to the public.

## P3 — UX / polish

- [x] **C1–C4.** Toast copy, empty states and loading-state fixes (previously applied).
- [x] **C5.** Teacher dashboard counts are correct.
- [x] **C6. Creating a community as a student left it leaderless.** The modal's copy said
  a faculty lead would be assigned, but it never was. **Fixed**: the modal now auto-assigns
  a faculty lead from the `teachers` table (same department preferred), shows who the lead
  is, and warns honestly when no faculty is available.
- [x] **C7.** Community leadership roles are consistent across Communities / TeacherDashboard
  / NotificationCenter.
- [x] **D1–D4.** Activity capacity trigger, CampusPulse role filtering, expired-deadline
  approval warning.
- [x] **D5. Duplicate realtime DM render** — the websocket INSERT event and the post-send
  refetch can both append the same message. Fixed by deduping by id on append.
- [x] **D6. Pending members could not cancel their join request** — the UI showed a
  disabled button even though the DELETE policy allows the requester to remove their own row.
- [x] **D7. Notification "mark as read" is local-state only** — `messages.read` is now
  persisted in the DB and the unread badge clears.

## Messaging / skills audit findings (second pass, 2026-10-19)

- [x] **S1. SkillDetail's "Message" buttons never contacted the skill owner** — the modal
  was opened without a target user. Both buttons now dispatch `openMessages` with
  `conversationUserId: ownerId`.
- [x] **S2. A connection request carried no message → no conversation existed, so
  Accept/Decline was unreachable from Direct/Requests.** `startNewConversation` now inserts
  a greeting `messages` row alongside the `connections` row in both the "no existing
  connection" and the "previously rejected" branches, and verifies that a row was written.
- [x] **S3. Bookmarks were write-only — there was no "saved skills" UI anywhere** and
  NotificationCenter never subscribed to `bookmarks`. **Fixed**: new
  `src/components/SavedSkills.tsx` page (bookmark → skill join, owner names, search,
  remove, live refresh), a `bookmarks` realtime subscription, a `/saved` route, a topbar
  bookmark button and a mobile-menu entry.
- [x] **S4. `skill_requests` was missing from the realtime publication and had no
  notification path.** **Fixed**: NotificationCenter subscribes to `skill_requests`
  (INSERT for `owner_id`, UPDATE for `requester_id`), loads pending/resolved requests,
  and handles the new `skill_request` notification type end to end.
- [x] **S5. Review notifications were permanently unread** — the bell badge never cleared.
  "Seen" state is now persisted per user.
- [x] **S6. UserProfile rendered *other users'* pending project invites with Accept/Decline
  buttons that toasted success while updating 0 rows.** The section is owner-only and every
  update verifies the affected row count.
- [x] **S7. `toggleBookmark` was fully optimistic and swallowed errors.** The optimistic
  flip is now reverted when the write fails.
- [x] **S8. "0 rows updated" was treated as success throughout** — RLS-blocked writes toasted
  success. Every affected write now uses `.select('id')` and checks the affected row count:
  `AddSkillModal`, `SkillDetail` (review update + delete), `ActivityDetail` (review update
  + delete), `Communities` (join request, role assignment), `TeacherDashboard` (approve,
  reject, delete, join request, role assignment), `MessagesModal` (accept, decline),
  `ProjectDetail` (invite response, revoke).
- [x] **S9. People.tsx swallowed fetch errors** (rendering "No profiles yet" on failure) and
  **UserProfile kept rendering the previous user's profile** when the next id had no
  profile row. **Fixed**: People.tsx has an explicit error state with a "Try again" button;
  UserProfile clears its state on a missing profile. The third sub-issue (UserProfile
  rendering `profile.email` to every visitor) was already handled client-side — the email
  row is gated behind `isOwnProfile`; see the API-level follow-up below.

## Extra bugs found while verifying (2026-10-22)

- [x] **`Home.tsx` referenced an undefined `userName`** — commit `f35a05b` deleted the
  definition but kept three usages, so every signed-in user hit a `ReferenceError` on the
  home page. The definition was restored.
- [x] **The build never type-checked.** `npm run build` was `vite build` only, which is
  exactly why the `userName` bug survived. The build script is now `tsc -b && vite build`.
- [x] **`profiles.github_url` / `linkedin_url` / `portfolio_url` existed in the live
  database and in `src/integrations/supabase/types.ts` but in NO migration file** — a fresh
  `supabase db reset` would have produced a database without them and broken the profile
  page. Recorded in `20261022000200_profiles_link_columns.sql`.

---

## Open follow-ups (deliberately out of scope)

- [ ] **`profiles.email` is world-readable through the public API.** The `profiles` SELECT
  policy is `USING (true)`, so a **signed-out visitor** can enumerate every account's
  `@rnsit.ac.in` address through `/rest/v1/profiles?select=email`, even though the UI
  deliberately hides it (People.tsx never selects it; UserProfile shows it only on your own
  profile). *Confirmed live: an unauthenticated request returns 79 rows of real addresses.*

  The fix is a column-level privilege change:

  ```sql
  revoke select on public.profiles from anon, authenticated;
  grant select (id, user_id, full_name, department, academic_year, bio,
                avatar_url, banner_url, role, github_url, linkedin_url,
                portfolio_url, created_at, updated_at)
    on public.profiles to anon, authenticated;
  ```

  plus a `SECURITY DEFINER` RPC (e.g. `public.my_profile_email()`) so the owner can still
  read their own address. **This was NOT applied** because it requires rewriting the seven
  `.from('profiles').select('*')` call sites (`ProjectDetail`, `EditProfile`, `SkillDetail`
  ×2, `Home`, `UserProfile` ×2) into explicit column lists, and a mistake there breaks
  profile loading across the whole app.
- [ ] **`messages` INSERT policy is `auth.uid() = sender_id` only** — the "you must be
  connected first" gate is enforced in the client, not the database.
- [ ] **`communities` INSERT policy only requires `auth.uid() = created_by`**, so a student
  creator can set `leader_id` to any teacher. `AddCommunityModal` now assigns a lead
  sensibly, but the database still allows the value.
- [ ] **Orphaned storage files** when removing avatars / banners / activity photos — the URL
  is nulled but the file is kept. Cosmetic.
- [ ] **The `connections_one_per_pair` unique index makes `MessagesModal`'s `.maybeSingle()`
  safe**, but it is worth keeping in mind if the pairing rule ever changes.

---

## Verification

- `npm run build` (`tsc -b && vite build`) and `npm run lint` pass — 0 type errors, 0 lint
  errors.
- Live DB changes are applied through the Supabase SQL API **and** recorded as migration
  files in `supabase/migrations/`, so the repo can rebuild the same schema:

  | Migration | What it does |
  |---|---|
  | `20261022000000_gta_audit_fixes.sql` | drops the hard `community_members` unique constraint, adds the two partial unique indexes, adds the `community_members_clear_stale_rejection` trigger, adds the `community_member_counts()` RPC, tightens the `connections.status` CHECK |
  | `20261022000100_fix_community_join_request_recursion.sql` | replaces the self-referencing INSERT policy with the `has_membership_request()` SECURITY DEFINER helper |
  | `20261022000200_profiles_link_columns.sql` | records the three `profiles` link columns that existed only in the live database |

- E2E scripts (both sign in as real demo accounts and drive the app's own API):

  | Script | Result |
  |---|---|
  | `python3 scripts/seed/verify.py` | **23/23 checks pass** |
  | `python3 scripts/seed/verify_fixes.py` | **23/23 checks pass** (A7 request → decline → request again, duplicate-request refusal, S2 greeting message, S8 zero-row write, member-count parity) |

  `scripts/supabase_sql.py <file.sql> [--check]` applies a migration to the live project;
  `--check` runs it inside a transaction that is rolled back, so it can be dry-run first.

- ⚠️ **PostgREST version note.** This project's PostgREST silently **ignores** the legacy
  `eq(col,eq.value)` filter syntax and returns the **whole table unfiltered** instead of
  erroring. Every filter in the app goes through supabase-js (which emits the current
  `col=eq.value` form), so the app is unaffected — but any hand-written REST call using
  the old syntax is a silent data-leak trap. The seed scripts were updated accordingly.
