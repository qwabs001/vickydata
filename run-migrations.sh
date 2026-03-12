#!/usr/bin/env bash

set -euo pipefail

# Supabase Database Migration Script
# Run this script to apply all pending migrations to your Supabase database

load_env_file() {
  local env_file="$1"
  [[ -f "$env_file" ]] || return 0

  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" == *=* ]] || continue

    local key="${line%%=*}"
    local value="${line#*=}"

    key="${key#"${key%%[![:space:]]*}"}"
    key="${key%"${key##*[![:space:]]}"}"

    if [[ "$value" =~ ^\".*\"$ || "$value" =~ ^\'.*\'$ ]]; then
      value="${value:1:${#value}-2}"
    fi

    export "$key=$value"
  done < "$env_file"
}

append_param() {
  local url="$1"
  local kv="$2"
  if [[ "$url" == *"$kv"* ]]; then
    printf '%s' "$url"
  elif [[ "$url" == *\?* ]]; then
    printf '%s&%s' "$url" "$kv"
  else
    printf '%s?%s' "$url" "$kv"
  fi
}

load_env_file ".env.local"
load_env_file ".env"

DATABASE_URL="${DATABASE_URL:-postgresql://postgres.kbzdbwaahfcxutelbmnm:PASSWORD@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require&connection_limit=1&pgbouncer=true}"
DIRECT_DATABASE_URL="${DIRECT_DATABASE_URL:-}"

if [[ -z "$DIRECT_DATABASE_URL" ]]; then
  DIRECT_DATABASE_URL="$DATABASE_URL"
fi

if [[ "$DATABASE_URL" == *"pooler.supabase.com:6543"* ]]; then
  DATABASE_URL="$(append_param "$DATABASE_URL" "prepared_statements=false")"
fi

if [[ "$DIRECT_DATABASE_URL" == *"pooler.supabase.com:6543"* ]]; then
  DIRECT_DATABASE_URL="$(append_param "$DIRECT_DATABASE_URL" "prepared_statements=false")"
fi

if [[ "$DATABASE_URL" == *":PASSWORD@"* || "$DIRECT_DATABASE_URL" == *":PASSWORD@"* ]]; then
  echo "Set DATABASE_URL and DIRECT_DATABASE_URL with your real Supabase password before running migrations." >&2
  exit 1
fi

export DATABASE_URL
export DIRECT_DATABASE_URL

echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Generating Prisma Client..."
npx prisma generate

echo "Migrations completed!"
