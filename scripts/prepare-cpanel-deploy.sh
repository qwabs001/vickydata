#!/usr/bin/env sh

set -eu

if [ ! -f .next/standalone/server.js ]; then
  echo "Missing standalone build. Run npm run build first." >&2
  exit 1
fi

mkdir -p .next/standalone/.next
cp -R .next/static .next/standalone/.next/static
cp -R public .next/standalone/public

# Prisma engines are loaded dynamically, so Next's standalone file tracing does
# not always include them. Copy the generated client engines explicitly.
if [ -d node_modules/.prisma ]; then
  mkdir -p .next/standalone/node_modules/.prisma
  cp -R node_modules/.prisma/. .next/standalone/node_modules/.prisma/
fi

echo "cPanel runtime prepared at .next/standalone"
