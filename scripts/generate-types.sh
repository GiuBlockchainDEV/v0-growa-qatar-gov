#!/bin/bash

# Supabase Type Generation Script
# Generates TypeScript types from the Supabase schema

set -e

ENV=${1:-local}

if [ "$ENV" = "local" ]; then
  echo "Generating types from local Supabase..."
  supabase gen types typescript --local > supabase/types/database.ts
elif [ "$ENV" = "production" ]; then
  if [ -z "$SUPABASE_PROJECT_ID" ]; then
    echo "Error: SUPABASE_PROJECT_ID environment variable not set"
    exit 1
  fi
  echo "Generating types from production Supabase (${SUPABASE_PROJECT_ID})..."
  supabase gen types typescript --project-id "$SUPABASE_PROJECT_ID" > supabase/types/database.ts
else
  echo "Usage: ./scripts/generate-types.sh [local|production]"
  exit 1
fi

echo "Types generated successfully at supabase/types/database.ts"
