# GTA demo seeder

Tools that populate the GTA (Go To App) Supabase project with a realistic RNSIT
campus so the app can be demoed live without anyone having to type in data.

## Files

| File | Purpose |
|------|---------|
| `roster.py` | The 70 students + 9 faculty. Single source of truth for names, emails, departments, years. |
| `seed.py` | Creates the auth accounts and every content table (skills, activities, communities, DMs, reviews, projects). |
| `verify.py` | 23 end-to-end checks that sign in as a real student/teacher and read the app's own API. |
| `credentials.md` | **Generated, git-ignored.** The handover sheet with every login email. |
| `.seeded_emails.json` | **Generated, git-ignored.** Manifest of seeder-owned auth emails, used to purge stale demo accounts. |

## Running

```bash
# 1. Put your keys in scripts/seed/.env.local (git-ignored)
cat > scripts/seed/.env.local <<'EOF'
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service-role key>
DEMO_PASSWORD=<shared password for every demo account>
EOF

# 2. Seed
set -a && . scripts/seed/.env.local && set +a
python3 scripts/seed/seed.py

# 3. Verify
python3 scripts/seed/verify.py
```

`seed.py` needs the **service-role** key (it creates auth users). `verify.py`
only needs the anon key plus the service-role key for the signup-trigger check.

## Properties

- **Deterministic** — the RNG is seeded with `20261021`, so re-running produces
  the exact same campus. Useful for demos and for screenshots.
- **Idempotent** — each run rebuilds the demo tables and deletes auth accounts
  that the seeder previously owned but no longer uses (tracked in
  `.seeded_emails.json`), so old demo users don't linger.
- **Destructive to demo data** — it wipes and recreates the seeded tables. Do not
  run it against a database that holds real user data.
- Every generated auth account is **pre-confirmed** (`email_confirm: true`), so
  there is no email-verification step during a live demo.

## Demo accounts

70 students + 9 faculty, all sharing one password. Emails are
derived from the name (`first.last@rnsit.ac.in`); `Dr.`/`Prof.` prefixes are
stripped from the local part. The full list lives in the generated
`credentials.md`, which is deliberately **not** committed to this public
repository — nor is the shared password, which is read from `DEMO_PASSWORD`
with no default value baked into the source.
