# GTA Bug Audit & Fix TODO

Audit date: 2026-10-19. Found by code audit + live end-to-end testing against the production
Supabase project (`ylliuejawkswxnzfyiym`). Status: `[ ]` open, `[~]` in progress, `[x]` fixed.

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
  `AddProjectModal.tsx:71-76` builds `.not('user_id','in',[])` with an empty array →
  malformed filter `user_id=not.in.` → PostgREST 400 → search always returns "No students".
  Fix: only apply the exclusion filter when the list is non-empty; also exclude the current
  user so self-invites (which fail RLS and abort the whole batch insert) are impossible.
- [x] **A3. Editing an activity from its detail page silently deletes the registration deadline.**
  `ActivityDetail.tsx:611-631` passes `activityToEdit` without `deadline`; the modal prefills
  `''` and unconditionally writes `deadline: null` on save.
  Fix: pass the full activity row.
- [ ] **A4. (M1) Notification deep-links open chat but never load messages — stale closure.**
  `MessagesModal.tsx:87-100` registers the `openMessages` listener in a mount-only effect,
  permanently capturing `loadMessages` with `currentUser === null` → no-op. Deep-links
  (notification toast, NotificationCenter, UserProfile "Message") show an empty thread or
  *another person's* messages under the new header, and never mark messages read.
- [ ] **A5. (M2) Send is gated on `activeTab`, not on the thread displayed → messages
  silently dropped or sent to the wrong chat.** Deep-linked DM while on the Groups tab
  either does nothing on Enter or posts into a stale community thread.
- [ ] **A6. (M3) Community group chat is not live — no realtime subscription for
  `community_messages` anywhere**, though the table is in the `supabase_realtime`
  publication. Two members effectively can't chat.
- [ ] **A7. (M4) A declined join request permanently blocks re-joining a community.**
  `community_members` INSERT policy requires no row of *any* status to exist; the decline
  row stays forever. UI keeps showing a "Request to Join" button that can only fail with a
  raw RLS error. NotificationCenter also writes `'declined'` where the schema documents
  `'rejected'`.

## P2 — High: core flows fail or lose data

- [x] **B1. EditProfile: 2nd+ save fails once a faculty directory entry exists.**
  After inserting into `teachers` (unique on user_id), `teacherEntry` state is never set →
  next save re-inserts → unique violation → "Failed to create faculty directory entry".
- [x] **B2. EditProfile: teacher-entry *update* errors are swallowed** — failed saves still
  toast "Profile updated!".
- [x] **B3. Accepted collaborations invisible to visitors (RLS too narrow).**
  `project_collaborators` SELECT policy only lets participants see rows, so
  `UserProfile.tsx` "Collaborations" and `ProjectDetail.tsx` "Team Members" are empty for
  everyone except the involved users — contradicting the migration's stated design
  ("the project then shows on their profile").
  Fix: migration allowing public read of rows with status='accepted' (keep pending private);
  **APPLIED LIVE + verified.**
- [x] **B4. ProjectDetail: "remove collaborator" (X) button is nested inside a `<Link>`** —
  clicking it also navigates to the collaborator's profile, interrupting the removal.
- [ ] **B5. (M5) `connections` has no uniqueness + `.maybeSingle()` misuse → a DM pair can
  be bricked forever.** Double-click or mutual requests insert 2+ rows; `maybeSingle()`
  then errors, status falls back to 'none', every send is blocked with "hasn't accepted
  your connection request yet", and each retry adds another row. `startNewConversation`
  never checks insert errors and toasts success regardless.
- [ ] **B6. (M6) "Decline" implemented twice with diverging statuses** — MessagesModal
  writes `'rejected'`, NotificationCenter writes `'declined'`. Both lose the conversation
  for both users forever with no reset path; `'declined'` is additionally misread as
  pending-direction (inverted status) and UserProfile's decline check misses it entirely,
  so a declined user can still DM from the profile page.

## P3 — Medium

- [x] **C1. Deadline drifts by the UTC offset on every edit from EditProfile** —
  `deadline.slice(0,16)` feeds a UTC ISO string into a `datetime-local` input that reads it
  as local time (shifts 5h30m for IST), then re-serializes on save.
  Fix: proper UTC→local prefill and local→UTC submit conversion.
- [x] **C2. Auth: signup verification race** — `onAuthStateChange` fires SIGNED_IN and
  redirects into the app before the explicit `signOut()` meant to enforce the
  "check your email" screen runs. Nondeterministic flicker/bypass.
- [x] **C3. Reviews have no uniqueness** — `reviews` lacks a unique
  (user_id, target_type, target_id) constraint; the "already reviewed" duplicate check in
  `ActivityDetail.tsx:132` is dead code and double-submits skew ratings.
  Fix: migration — dedupe existing rows, add partial unique index; **APPLIED LIVE + E2E verified.**
- [x] **C4. Demoted teachers stay in the public faculty directory forever** —
  switching role Faculty→Student in EditProfile never deletes the `teachers` row and
  `Teachers.tsx` lists all rows with no role check.
- [ ] **C5. (M7) A sitting president can never transfer the presidency** — the
  communities UPDATE policy has no WITH CHECK, so handing over the role you hold *only*
  through that role fails RLS on the new row.
- [ ] **C6. (M8) Students can create leadless communities, contradicting the modal's own
  copy** ("New communities must have a teacher lead"). With zero teacher accounts, every
  community ends up leaderless. Resolution: keep creation working (otherwise the feature is
  dead) but make the copy/flow honest about who approves joins.
- [ ] **C7. (M9) Pending join requests are world-readable** — `community_members` SELECT is
  `USING (true)`; any visitor (even signed-out) can enumerate who requested to join which
  community. Fix: migration restricting SELECT to the requester, members, and leads.

## P4 — Lower priority

- [x] **D1. Pending/rejected activities are shown on the owner's *public* profile** to all
  visitors (`UserProfile.tsx:112-120`), contradicting the "hidden until approved" design.
  Fix: hide from visitors, show to owner (with badge).
- [x] **D2. Activity capacity is only enforced in the UI** — concurrent joins can overbook
  `max_participants`. Fix: DB trigger on `activity_participants` enforcing capacity.
  **APPLIED LIVE + E2E verified (2nd join to full event → "Activity is full").**
- [x] **D3. CampusPulse "Students" count includes teacher accounts.**
- [x] **D4. TeacherDashboard can approve an event whose deadline already passed** (it
  instantly becomes invisible everywhere) — now warns before approving.
- [ ] **D5. (M10) Duplicate realtime DM render** — the websocket INSERT event and the
  post-send refetch can both append the same message. Fix: dedupe by id on append.
- [ ] **D6. (M10) Pending members can't cancel their join request** — UI shows a disabled
  button though the DELETE policy allows the requester to remove their own row.
- [ ] **D7. (M10) Notification "mark as read" is local-state only** — clicking a
  notification never flips `messages.read` in the DB (blocked by A4), so Home's unread
  badge never clears.

## Messaging/skills audit findings (second pass, 2026-10-19)

- [ ] **S1. (P1) SkillDetail's "Message" / "Message to coordinate" buttons never contact
  the skill owner** — the modal is opened without a target user or `openMessages` payload;
  the owner never receives a request or message. Same root cause family as A4/S2.
- [ ] **S2. (P1) A connection request carries no message → no conversation exists, so
  Accept/Decline is unreachable from Direct/Requests** — first Message click inserts only a
  `connections` row and returns before the greeting-message insert; the receiver must use
  the bell, and even after accepting, no conversation appears until the sender clicks
  Message a *second* time.
- [ ] **S3. (P2) Bookmarks are write-only — there is no "saved skills" UI anywhere** and
  NotificationCenter never subscribes to `bookmarks` (the realtime publication exists for
  it). Half the promised feature is unreachable.
- [ ] **S4. (P2) `skill_requests` is missing from the realtime publication and has no
  notification path** — owners only discover requests by revisiting the skill page;
  requesters stay on "Request pending" until manual reload.
- [ ] **S5. (P2) Review notifications are permanently unread — the bell badge never
  clears.** `markAllRead` only persists `messages.read`; reviews have no read column, so
  every reload re-marks all historical reviews unread.
- [ ] **S6. (P2) UserProfile renders *other users'* pending project invites with Accept/
  Decline buttons that toast success while updating 0 rows** (RLS filters the row out;
  PostgREST reports no error). Section must be owner-only and updates must verify rows.
- [ ] **S7. (P3) `toggleBookmark` is fully optimistic and swallows errors** — DB failures
  still toast "Bookmarked!" while state disagrees until reload.
- [ ] **S8. (P3) "0 rows updated" treated as success throughout** — `respondToRequest`
  (SkillDetail), AddSkillModal update, review delete: RLS-blocked updates toast success.
  Fix pattern: `.select('id')` + check affected rows.
- [ ] **S9. (P3-minor) People.tsx swallows fetch errors** (renders "No profiles yet" on
  failure); **UserProfile keeps rendering the previous user's profile when the next id has
  no profile row**; **UserProfile renders `profile.email` to every visitor** while People.tsx
  deliberately excludes it — align on the private design.

## Deferred / by-design notes

- Orphaned storage files when removing avatar/banner/activity photos (URL nulled, file kept) — cosmetic, safe to skip.
- `messages`/`communities`/`skills` audit: separate audit running — findings appended below.

---

## Verification

- `npm run build` + `npm run lint` must pass after fixes.
- Live DB changes are applied via the Supabase SQL API **and** recorded as migration files
  in `supabase/migrations/` so the repo stays in sync.
- E2E-tested with a real signed-in student user against production.
