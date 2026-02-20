#!/bin/bash

# Supabase Database Migration Script
# Run this script to apply all pending migrations to your Supabase database

# Supabase pooler connection
export DATABASE_URL="postgresql://postgres.ryxxamwxeskfvojltfdt:ZUNEJz6gyFNaEHsA@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require&connection_limit=1&pgbouncer=true"
export DIRECT_DATABASE_URL="postgresql://postgres.ryxxamwxeskfvojltfdt:ZUNEJz6gyFNaEHsA@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require&connection_limit=1&pgbouncer=true"

echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Generating Prisma Client..."
npx prisma generate

echo "Migrations completed!"
