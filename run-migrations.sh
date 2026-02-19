#!/bin/bash

# Supabase Database Migration Script
# Run this script to apply all pending migrations to your Supabase database

# Session pooler connection (works for migrations)
export DATABASE_URL="postgresql://postgres.yezeyzqalpiefanrosws:globNFK8uziL24H7@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require"
export DIRECT_DATABASE_URL="postgresql://postgres.yezeyzqalpiefanrosws:globNFK8uziL24H7@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require"

echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Generating Prisma Client..."
npx prisma generate

echo "Migrations completed!"
