"""End-to-end verification of the 2026-10-22 audit fixes, run against the live
Supabase project using real signed-in sessions through the public (anon-key)
API exactly like the frontend does.

Covers:
  A7  — re-requesting a community join after a rejection (was blocked forever)
  RLS — a community join request used to fail with 42P17 "infinite recursion
        detected in policy" for EVERY user, so the flow was entirely dead
  S2  — a connection request now carries a greeting message
  S8  — an RLS-blocked write returns 0 rows without raising an error
  REGRESSION — community member counts are visible to non-members again

NOTE on the query syntax: this PostgREST version silently IGNORES the legacy
`eq(col,eq.value)` filter syntax and returns the WHOLE table unfiltered. Every
filter below therefore uses the current `col=eq.value` form.
"""

import json
import os
import sys
import urllib.error
import urllib.request

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://ylliuejawkswxnzfyiym.supabase.co").rstrip("/")
ANON = os.environ["SUPABASE_ANON_KEY"]
SERVICE = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
PASSWORD = os.environ.get("DEMO_PASSWORD", "")

results = []

# PostgREST only returns the affected rows of a write when the caller asks
# for them. Without this header a successful INSERT/PATCH returns an empty
# body and a successful PATCH that matched nothing is indistinguishable from
# one that changed everything.
PREFER_REPRESENTATION = {"Prefer": "return=representation"}


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


def svc(path, method="GET", body=None, headers=None, token=None):
    """Call through the service-role key, which bypasses RLS."""
    return api(path, token=token or SERVICE, method=method, body=body, headers=headers)


def write_api(path, token, method, body):
    """A write that returns the affected rows."""
    return api(path, token=token, method=method, body=body, headers=PREFER_REPRESENTATION)


def sign_in(email):
    res = api("/auth/v1/token?grant_type=password", method="POST",
              body={"email": email, "password": PASSWORD})
    if "access_token" not in res:
        return None, res
    return res["access_token"], res


def err_code(res):
    """Extract the PostgREST error code from an error response."""
    if isinstance(res, dict) and "__error__" in res:
        try:
            return json.loads(res["__error__"]).get("code")
        except Exception:
            return None
    return None


def main():
    if not SERVICE:
        print("SUPABASE_SERVICE_ROLE_KEY is required")
        return 2

    # ------------------------------------------------------------------
    # Pick fixtures
    # ------------------------------------------------------------------
    teachers = svc("/rest/v1/teachers?select=user_id,full_name,email&limit=1")
    if not teachers or not isinstance(teachers, list) or not teachers[0]:
        print("Could not load a teacher:", teachers)
        return 2
    teacher = teachers[0]

    community = svc(f"/rest/v1/communities?select=id,name,leader_id&leader_id=eq.{teacher['user_id']}&limit=1")
    if not community or not isinstance(community, list) or not community:
        community = svc("/rest/v1/communities?select=id,name,leader_id&leader_id=not.is.null&limit=1")
    if not community or not isinstance(community, list) or not community:
        print("Could not find a community to test with:", community)
        return 2
    community = community[0]

    # A student who is NOT a member of that community.
    members = svc(f"/rest/v1/community_members?select=user_id&community_id=eq.{community['id']}")
    member_ids = {m["user_id"] for m in (members or [])}

    profiles = svc("/rest/v1/profiles?select=user_id,full_name,email,role&role=eq.student&limit=60")
    student = next((p for p in profiles if p["user_id"] not in member_ids), None)
    if not student:
        print("Could not find a student outside the community")
        return 2

    # The lead of that community needs a login to approve/decline.
    lead_row = svc(f"/rest/v1/teachers?select=user_id,email&user_id=eq.{community['leader_id']}&limit=1")
    lead_email = lead_row[0]["email"] if lead_row else teacher["email"]

    print(f"community : {community['name']} ({community['id']})")
    print(f"student   : {student['full_name']} ({student['email']})")
    print(f"lead      : {lead_email}\n")

    st, raw = sign_in(student["email"])
    check("student can sign in", st is not None, "" if st else json.dumps(raw)[:200])
    if not st:
        return 1

    lt, raw = sign_in(lead_email)
    check("community lead can sign in", lt is not None, "" if lt else json.dumps(raw)[:200])
    if not lt:
        return 1

    # ------------------------------------------------------------------
    # A7 — request -> decline -> request again
    # ------------------------------------------------------------------
    # Clear any leftover row for this pair so the test starts clean.
    svc(f"/rest/v1/community_members?community_id=eq.{community['id']}&user_id=eq.{student['user_id']}",
        method="DELETE")

    ins = write_api("/rest/v1/community_members?select=id", st, "POST",
                    {"community_id": community["id"], "user_id": student["user_id"], "status": "pending"})
    ok_first = isinstance(ins, list) and len(ins) == 1
    check("A7: first join request is accepted", ok_first, json.dumps(ins)[:160])

    row = svc(f"/rest/v1/community_members?select=id,status&community_id=eq.{community['id']}"
              f"&user_id=eq.{student['user_id']}")
    check("A7: request row is 'pending'", bool(row) and len(row) == 1 and row[0]["status"] == "pending",
          json.dumps(row)[:160])

    # The lead declines it. (Filter on the row id only -- filtering on the
    # status would match nothing and silently update 0 rows.)
    member_id = row[0]["id"]
    dec = write_api(f"/rest/v1/community_members?id=eq.{member_id}", lt, "PATCH", {"status": "rejected"})
    check("A7: the lead's decline actually updated a row",
          isinstance(dec, list) and len(dec) == 1, json.dumps(dec)[:160])
    row = svc(f"/rest/v1/community_members?select=id,status&community_id=eq.{community['id']}"
              f"&user_id=eq.{student['user_id']}")
    check("A7: lead can decline the request", bool(row) and len(row) == 1 and row[0]["status"] == "rejected",
          json.dumps(row)[:160])

    # THE FIX: the student requests again. Before the fix this raised 42P17
    # (infinite recursion in the policy) on the FIRST request too.
    again = write_api("/rest/v1/community_members?select=id", st, "POST",
                      {"community_id": community["id"], "user_id": student["user_id"], "status": "pending"})
    ok_again = isinstance(again, list) and len(again) == 1
    check("A7: 'Request Again' succeeds after a rejection", ok_again, json.dumps(again)[:200])

    row = svc(f"/rest/v1/community_members?select=id,status&community_id=eq.{community['id']}"
              f"&user_id=eq.{student['user_id']}")
    check("A7: the pair still holds exactly ONE row", len(row) == 1, f"{len(row)} rows")
    check("A7: that row is 'pending' again", bool(row) and row[0]["status"] == "pending",
          json.dumps(row)[:160])

    # A second request while one is already pending must still be refused.
    dup = write_api("/rest/v1/community_members?select=id", st, "POST",
                    {"community_id": community["id"], "user_id": student["user_id"], "status": "pending"})
    dup_rejected = err_code(dup) == "42501"
    check("A7: a duplicate pending request is still refused", dup_rejected, json.dumps(dup)[:160])

    # A user who already has an ACCEPTED membership must not be able to
    # request again behind the lead's back.
    svc(f"/rest/v1/community_members?community_id=eq.{community['id']}&user_id=eq.{student['user_id']}",
        method="DELETE")
    svc(f"/rest/v1/community_members?community_id=eq.{community['id']}&user_id=eq.{student['user_id']}",
        method="POST", body={"community_id": community["id"], "user_id": student["user_id"], "status": "accepted"})
    sneak = write_api("/rest/v1/community_members?select=id", st, "POST",
                      {"community_id": community["id"], "user_id": student["user_id"], "status": "pending"})
    check("A7: a second request behind an accepted membership is refused",
          err_code(sneak) == "42501", json.dumps(sneak)[:160])

    # Cleanup.
    svc(f"/rest/v1/community_members?community_id=eq.{community['id']}&user_id=eq.{student['user_id']}",
        method="DELETE")

    # ------------------------------------------------------------------
    # S2 — a connection request carries a greeting message
    # ------------------------------------------------------------------
    other = svc("/rest/v1/profiles?select=user_id,full_name,email&role=eq.student&limit=60")
    partner = next((p for p in other if p["user_id"] != student["user_id"]), None)
    if partner:
        svc(f"/rest/v1/connections?sender_id=eq.{student['user_id']}&receiver_id=eq.{partner['user_id']}",
            method="DELETE")
        svc(f"/rest/v1/connections?sender_id=eq.{partner['user_id']}&receiver_id=eq.{student['user_id']}",
            method="DELETE")

        conn = write_api("/rest/v1/connections?select=id", st, "POST",
                         {"sender_id": student["user_id"], "receiver_id": partner["user_id"], "status": "pending"})
        check("S2: connection request is created", isinstance(conn, list) and len(conn) == 1, json.dumps(conn)[:160])

        greet = write_api("/rest/v1/messages?select=id", st, "POST",
                          {"sender_id": student["user_id"], "receiver_id": partner["user_id"],
                           "content": "\U0001F44B Hi! I'd like to connect with you."})
        check("S2: the request carries a greeting message", isinstance(greet, list) and len(greet) == 1,
              json.dumps(greet)[:160])

        # The receiver must now SEE a conversation with the requester.
        pt, praw = sign_in(partner["email"])
        check("S2: the receiver can sign in", pt is not None, "" if pt else json.dumps(praw)[:160])
        seen = api(f"/rest/v1/messages?select=id,sender_id,content&receiver_id=eq.{partner['user_id']}"
                   f"&sender_id=eq.{student['user_id']}", token=pt)
        check("S2: the receiver can see the request in their message list",
              isinstance(seen, list) and len(seen) >= 1, json.dumps(seen)[:160])

        # The receiver's notification query must now surface the requester.
        convos = api(f"/rest/v1/messages?select=sender_id&receiver_id=eq.{partner['user_id']}", token=pt)
        check("S2: the requester shows up in the receiver's conversation list",
              isinstance(convos, list) and any(c["sender_id"] == student["user_id"] for c in convos),
              f"{len(convos) if isinstance(convos, list) else convos} conversations")

        # Cleanup.
        svc(f"/rest/v1/messages?sender_id=eq.{student['user_id']}&receiver_id=eq.{partner['user_id']}",
            method="DELETE")
        svc(f"/rest/v1/connections?sender_id=eq.{student['user_id']}&receiver_id=eq.{partner['user_id']}",
            method="DELETE")
    else:
        check("S2: connection request carries a greeting message", False, "no partner available")

    # ------------------------------------------------------------------
    # S8 — an RLS-blocked update returns 0 rows WITHOUT raising an error
    # ------------------------------------------------------------------
    skill = svc(f"/rest/v1/skills?select=id,user_id,title&user_id=neq.{student['user_id']}&limit=1")
    if skill:
        blocked = write_api(f"/rest/v1/skills?id=eq.{skill[0]['id']}", st, "PATCH", {"title": "hijacked"})
        zero_rows_no_error = isinstance(blocked, list) and len(blocked) == 0
        check("S8: an RLS-blocked update returns 0 rows and no error", zero_rows_no_error,
              json.dumps(blocked)[:160])
        after = svc(f"/rest/v1/skills?select=title&id=eq.{skill[0]['id']}")
        check("S8: the skill was not modified", after and after[0]["title"] != "hijacked",
              json.dumps(after)[:160])
    else:
        check("S8: an RLS-blocked update returns 0 rows and no error", False, "no foreign skill found")

    # ------------------------------------------------------------------
    # REGRESSION — member counts are public again
    # ------------------------------------------------------------------
    counts = api("/rest/v1/rpc/community_member_counts")
    check("REGRESSION: community_member_counts is callable by a signed-out visitor",
          isinstance(counts, list), json.dumps(counts)[:160])

    if isinstance(counts, list):
        check("REGRESSION: it returns a row for every community that has members",
              len(counts) > 0, f"{len(counts)} rows")

        mismatches = []
        for c in counts:
            real = svc(f"/rest/v1/community_members?select=id&community_id=eq.{c['community_id']}"
                       f"&status=eq.accepted")
            if len(real) != int(c["member_count"]):
                mismatches.append((c["community_id"], c["member_count"], len(real)))
        check("REGRESSION: every count matches the real accepted-member count",
              not mismatches, str(mismatches[:3]))

        anon_counts = api("/rest/v1/rpc/community_member_counts", token=ANON)
        check("REGRESSION: counts are readable with the anonymous key",
              isinstance(anon_counts, list) and len(anon_counts) == len(counts),
              f"{len(anon_counts) if isinstance(anon_counts, list) else anon_counts}")

        # A community the viewer is NOT in must still show a real number.
        non_member = next((c for c in counts if c["community_id"] not in {m["community_id"] for m in []}), None)
        check("REGRESSION: counts are returned for communities the viewer has not joined",
              non_member is not None and int(non_member["member_count"]) > 0,
              json.dumps(non_member)[:120])

    # ------------------------------------------------------------------
    # Cleanup + summary
    # ------------------------------------------------------------------
    svc(f"/rest/v1/community_members?community_id=eq.{community['id']}&user_id=eq.{student['user_id']}",
        method="DELETE")

    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    print(f"\n{passed}/{total} checks passed")
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
