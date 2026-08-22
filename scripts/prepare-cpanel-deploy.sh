#!/usr/bin/env sh

set -eu

if [ ! -f .next/standalone/server.js ]; then
  echo "Missing standalone build. Run npm run build first." >&2
  exit 1
fi

mkdir -p .next/standalone/.next
cp -R .next/static .next/standalone/.next/static
cp -R public .next/standalone/public

# On cPanel, Apache serves `/_next/static` from the domain document root before
# Passenger handles the request. Keep that public copy in sync so new builds do
# not leave browsers with missing JavaScript chunks and blank pages.
if [ "${CPANEL_BUILD:-}" = "1" ] && [ -d "${HOME}/public_html" ]; then
  mkdir -p "${HOME}/public_html/_next/static"
  cp -R .next/static/. "${HOME}/public_html/_next/static/"
fi

# Prisma engines are loaded dynamically, so Next's standalone file tracing does
# not always include them. Copy the generated client engines explicitly.
if [ -d node_modules/.prisma ] && [ ! -e .next/standalone/node_modules/.prisma ]; then
  mkdir -p .next/standalone/node_modules/.prisma
  cp -R node_modules/.prisma/. .next/standalone/node_modules/.prisma/
fi

echo "cPanel runtime prepared at .next/standalone"
