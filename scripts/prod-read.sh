#!/usr/bin/env bash
# prod-read.sh — READ-ONLY production database queries (GET only).
#
# Usage:
#   bash scripts/prod-read.sh '<postgrest-query>'
# e.g.
#   bash scripts/prod-read.sh 'commitments?select=run_date,assignee&source_type=eq.reservation&run_date=eq.2026-06-28'
#   bash scripts/prod-read.sh 'chore_definitions?select=id,title&title=ilike.*water*'
#
# Read-only BY CONSTRUCTION: it always issues `curl --get` (never -X / -d /
# POST / PATCH / DELETE) against the Supabase REST (PostgREST) endpoint, using
# SUPABASE_URL + SUPABASE_SECRET_KEY from .env.local. It cannot write — changing
# production data is a separate, explicitly user-authorized step. This is why it
# is safe to allowlist in auto mode.
#
# Why a script (not raw curl): allowlisting bare `curl` would also permit
# writes and exfiltration to arbitrary URLs. This wrapper pins the method to GET
# and the host to our Supabase project, so the grant stays read-only.
#
# Note: node + supabase-js hangs in this environment; curl is the working tool.
set -euo pipefail

q="${1:?usage: prod-read.sh '<table>?select=...&filters'}"

env_file=".env.local"
[ -f "$env_file" ] || { echo "prod-read: $env_file not found (run from repo root)" >&2; exit 1; }

url=$(grep -m1 '^SUPABASE_URL=' "$env_file" | cut -d= -f2-)
key=$(grep -m1 '^SUPABASE_SECRET_KEY=' "$env_file" | cut -d= -f2-)
[ -n "${url:-}" ] && [ -n "${key:-}" ] \
  || { echo "prod-read: missing SUPABASE_URL / SUPABASE_SECRET_KEY in $env_file" >&2; exit 1; }

curl -s --get --max-time 30 "${url%/}/rest/v1/${q}" \
  -H "apikey: ${key}" \
  -H "Authorization: Bearer ${key}"
echo
