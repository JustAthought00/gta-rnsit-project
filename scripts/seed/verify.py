"""End-to-end verification of the seeded GTA demo, using real signed-in
sessions through the public (anon-key) API exactly like the frontend does."""

import json
import os
import sys
import urllib.error
import urllib.request

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://ylliuejawkswxnzfyiym.supabase.co").rstrip("/")
ANON = os.environ["SUPABASE_ANON_KEY"]
# The shared password for every demo account. Deliberately has no default so the
# live credential is never published in the (public) repository.
PASSWORD = os.environ.get("DEMO_PASSWORD", "")

results = []


def check(label, ok, detail=""):
    results.append((label, ok, detail))
    print(f"{'PASS' if ok else 'FAIL'}  {label}" + (f"  [{detail}]" if detail else ""))


def api(path, token=None, method="GET", body=None, headers=None):
    h = {"apikey": ANON, "Authorization": f"Bearer {token or ANON}", "Content-Type": "application/json"}
    if headers:
        h.update(headers)
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{SUPABASE_URL}{path}", data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as exc:
        return {"__error__": exc.read().decode()[:300], "__code__": exc.code}


def sign_in(email):
    res = api("/auth/v1/token?grant_type=password", method="POST",
              body={"email": email, "password": PASSWORD})
    if "access_token" not in res:
        return None, res
    return res["access_token"], res


def main():
    # Derive the demo logins from the roster so this check can never drift
    # from what the seeder actually creates.
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from seed import build_accounts

    accounts = build_accounts()
    by_name = {a["full_name"]: a for a in accounts}
    student_email = os.environ.get("DEMO_STUDENT") or by_name["Tarun S"]["email"]
    teacher_email = os.environ.get("DEMO_TEACHER") or by_name["Dr. Anil Kumar Sharma"]["email"]

    # 1. Sign in as a student with the documented password.
    st, raw = sign_in(student_email)
    check("student can sign in with the shared password", st is not None,
          "" if st else json.dumps(raw)[:200])
    if not st:
        return 1

    # 2. Sign in as a teacher.
    tt, raw = sign_in(teacher_email)
    check("teacher can sign in with the shared password", tt is not None,
          "" if tt else json.dumps(raw)[:200])

    # 3. The signed-in student sees their own profile.
    me = api("/rest/v1/profiles?select=user_id,full_name,role,department&eq(user_id,eq.%s)" % st[:0], st)
    profiles = api("/rest/v1/profiles?select=*", st)
    check("profiles are readable when signed in", isinstance(profiles, list) and len(profiles) >= 79,
          f"{len(profiles) if isinstance(profiles, list) else profiles} profiles")

    mine = [p for p in profiles if p["email"] == student_email]
    check("student profile row exists", len(mine) == 1, student_email)
    check("student profile has role=student", mine and mine[0]["role"] == "student")

    # 4. Roster shape.
    students = [p for p in profiles if p["role"] != "teacher"]
    teachers = [p for p in profiles if p["role"] == "teacher"]
    check("exactly 70 students", len(students) == 70, str(len(students)))
    check("exactly 9 teachers", len(teachers) == 9, str(len(teachers)))

    # 5. Public catalogue surfaces.
    skills = api("/rest/v1/skills?select=id,title,category,user_id", st)
    check("skills are listed", isinstance(skills, list) and len(skills) > 100, f"{len(skills) if isinstance(skills,list) else skills}")

    acts = api("/rest/v1/activities?select=id,title,date,time,deadline,approval_status,photo_url", st)
    ok = isinstance(acts, list)
    check("activities are listed", ok and len(acts) > 40, f"{len(acts) if ok else acts}")

    if ok:
        upcoming = [a for a in acts if a.get("deadline") and a["deadline"] > "2026-10-21T00:00:00Z"]
        check("activities have up-to-date (future) dates", len(upcoming) > 25, f"{len(upcoming)} upcoming")
        dated = [a for a in acts if a.get("date")]
        check("every activity has a formatted date string", len(dated) == len(acts))
        pending = [a for a in acts if a.get("approval_status") == "pending"]
        check("some events await faculty approval", len(pending) >= 3, f"{len(pending)} pending")

    # 6. Faculty directory.
    tch = api("/rest/v1/teachers?select=full_name,designation,expertise,cabin_location,user_id", st)
    check("faculty directory is populated", isinstance(tch, list) and len(tch) == 9,
          f"{len(tch) if isinstance(tch,list) else tch}")

    # 7. Communities + chat (the table that had the recursion bug).
    comms = api("/rest/v1/communities?select=id,name,leader_id,president_id", st)
    check("communities are listed", isinstance(comms, list) and len(comms) == 12,
          f"{len(comms) if isinstance(comms,list) else comms}")
    if isinstance(comms, list) and comms:
        cid = comms[0]["id"]
        msgs = api(f"/rest/v1/community_messages?select=id,content,community_id&eq(community_id,eq.{cid})", st)
        check("community chat messages are readable (no RLS recursion error)",
              isinstance(msgs, list) and "__error__" not in (msgs or {}),
              json.dumps(msgs)[:160] if not isinstance(msgs, list) else f"{len(msgs)} messages")

    # 8. DMs for the signed-in student.
    dms = api("/rest/v1/messages?select=id,sender_id,receiver_id,content&limit=50", st)
    check("student sees their own DMs", isinstance(dms, list) and len(dms) > 0,
          f"{len(dms) if isinstance(dms,list) else json.dumps(dms)[:150]}")
    conns = api("/rest/v1/connections?select=id,sender_id,receiver_id,status", st)
    check("student sees their own connections", isinstance(conns, list) and len(conns) > 0,
          f"{len(conns) if isinstance(conns,list) else json.dumps(conns)[:150]}")

    # 9. Skill requests.
    reqs = api("/rest/v1/skill_requests?select=id,status,skill_id", st)
    check("skill requests are readable by participants",
          isinstance(reqs, list) and "__error__" not in (reqs or {}),
          f"{len(reqs) if isinstance(reqs,list) else json.dumps(reqs)[:150]}")

    # 10. Reviews + bookmarks.
    revs = api("/rest/v1/reviews?select=id,rating,target_type&limit=5", st)
    check("reviews are public", isinstance(revs, list) and len(revs) > 0, f"{len(revs) if isinstance(revs,list) else revs}")
    bms = api("/rest/v1/bookmarks?select=id&limit=5", st)
    check("bookmarks are readable by their owner", isinstance(bms, list),
          f"{len(bms) if isinstance(bms,list) else json.dumps(bms)[:150]}")

    # 11. Teacher sees the moderation queue.
    if tt:
        pend = api("/rest/v1/activities?select=id,title&approval_status=eq.pending", tt)
        check("teacher can see the pending approval queue",
              isinstance(pend, list) and len(pend) > 0,
              f"{len(pend) if isinstance(pend,list) else json.dumps(pend)[:150]}")
        mem = api("/rest/v1/community_members?select=id,status&status=eq.pending", tt)
        check("teacher can see pending community join requests",
              isinstance(mem, list) and len(mem) > 0,
              f"{len(mem) if isinstance(mem,list) else json.dumps(mem)[:150]}")

    # 12. Signup trigger: a brand-new account must get a profile row.
    new_email = "openhouse.probe@rnsit.ac.in"
    created = api("/auth/v1/admin/users", method="POST",
                  body={"email": new_email, "password": PASSWORD, "email_confirm": True,
                        "user_metadata": {"full_name": "Open House Probe",
                                          "department": "Computer Science",
                                          "academic_year": "1st Year"}},
                  headers={"apikey": os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ANON),
                           "Authorization": "Bearer " + os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ANON)})
    if isinstance(created, dict) and created.get("id"):
        probe = api(f"/rest/v1/profiles?select=full_name,department&user_id=eq.{created['id']}",
                    None, headers={"apikey": os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ANON),
                                   "Authorization": "Bearer " + os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ANON)})
        check("a new signup automatically gets a profile row",
              isinstance(probe, list) and len(probe) == 1,
              json.dumps(probe)[:150])
        api(f"/auth/v1/admin/users/{created['id']}", method="DELETE",
            headers={"apikey": os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ANON),
                     "Authorization": "Bearer " + os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ANON)})
        # The auth user delete cascades to the profile row, but remove it
        # explicitly too so a failed cascade can never leave the demo roster
        # looking bigger than it is.
        api(f"/rest/v1/profiles?user_id=eq.{created['id']}", method="DELETE",
            headers={"apikey": os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ANON),
                     "Authorization": "Bearer " + os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ANON)})
    else:
        check("a new signup automatically gets a profile row", False, json.dumps(created)[:150])

    failed = [r for r in results if not r[1]]
    print()
    print(f"{len(results) - len(failed)}/{len(results)} checks passed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
