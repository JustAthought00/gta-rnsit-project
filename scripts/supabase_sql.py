#!/usr/bin/env python3
"""Apply a .sql file to the live Supabase project via the Management SQL API.

Usage: python3 scripts/supabase_sql.py <file.sql> [--check]

--check runs the file inside a transaction and rolls back, so you can validate
DDL without touching the live database.

The Management API access token is read from the environment:

    export SUPABASE_ACCESS_TOKEN=sbp_...
    python3 scripts/supabase_sql.py supabase/migrations/<file>.sql

It is also picked up automatically from scripts/seed/.env.local (git-ignored)
if that file defines it. Nothing is hardcoded here.
"""
import json
import os
import sys
import urllib.error
import urllib.request

PROJECT_REF = os.environ.get("SUPABASE_PROJECT_REF", "ylliuejawkswxnzfyiym")
API = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query"

ENV_LOCAL = os.path.join(os.path.dirname(os.path.abspath(__file__)), "seed", ".env.local")


def load_token() -> str:
    token = os.environ.get("SUPABASE_ACCESS_TOKEN", "").strip()
    if token:
        return token

    # Fall back to the git-ignored seed env file, if it carries a token.
    if os.path.exists(ENV_LOCAL):
        with open(ENV_LOCAL) as f:
            for line in f:
                line = line.strip()
                if line.startswith("SUPABASE_ACCESS_TOKEN="):
                    return line.split("=", 1)[1].strip().strip("\"'")

    sys.exit(
        "SUPABASE_ACCESS_TOKEN is not set.\n"
        "  export SUPABASE_ACCESS_TOKEN=sbp_...\n"
        f"  (or add SUPABASE_ACCESS_TOKEN=... to {ENV_LOCAL})"
    )


def run(query: str, token: str):
    req = urllib.request.Request(
        API,
        data=json.dumps({"query": query}).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)

    path = sys.argv[1]
    check = "--check" in sys.argv[2:]
    token = load_token()

    with open(path) as f:
        sql = f.read()

    if check:
        sql = f"begin;\n{sql}\nrollback;"

    status, body = run(sql, token)
    print(f"HTTP {status}")
    print(json.dumps(body, indent=2) if not isinstance(body, str) else body)
    sys.exit(0 if status in (200, 201) else 1)


if __name__ == "__main__":
    main()
