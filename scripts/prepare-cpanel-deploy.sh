#!/usr/bin/env sh

set -eu

if [ ! -f .next/standalone/server.js ]; then
  echo "Missing standalone build. Run npm run build first." >&2
  exit 1
fi

mkdir -p .next/standalone/.next
cp -R .next/static .next/standalone/.next/static
cp -R public .next/standalone/public

echo "cPanel runtime prepared at .next/standalone"
