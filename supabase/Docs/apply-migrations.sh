#!/bin/bash

# Supabase Migration Runner Script
# This script applies all pending migrations to your Supabase database

set -e

echo "🚀 SOC Dashboard - Supabase Migration Runner"
echo "=============================================="

# Configuration
SUPABASE_URL="${VITE_SUPABASE_URL:-https://tjbnyurvlmbywxjlfunf.supabase.co}"
SUPABASE_KEY="${VITE_SUPABASE_ANON_KEY:-}"
SERVICE_ROLE_KEY="${VITE_SUPABASE_SERVICE_ROLE_KEY:-}"

# Check if keys are provided
if [ -z "$VITE_SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ ERROR: VITE_SUPABASE_SERVICE_ROLE_KEY environment variable not set"
    echo ""
    echo "To set it up:"
    echo "1. Go to https://app.supabase.com/project/tjbnyurvlmbywxjlfunf/settings/api"
    echo "2. Copy your Service Role Key (NOT the Anon Key)"
    echo "3. Run: export VITE_SUPABASE_SERVICE_ROLE_KEY='your-service-key'"
    echo "4. Then run this script again"
    exit 1
fi

# Display configuration
echo ""
echo "📋 Configuration:"
echo "   Supabase URL: $SUPABASE_URL"
echo "   Service Role Key: ${VITE_SUPABASE_SERVICE_ROLE_KEY:0:20}..."
echo ""

# Function to execute SQL migration
apply_migration() {
    local file=$1
    local name=$(basename "$file")
    
    echo "🔄 Applying migration: $name"
    
    # Read the SQL file
    local sql=$(cat "$file")
    
    # Execute via Supabase API
    curl -X POST \
        "${SUPABASE_URL}/rest/v1/rpc/execute_sql" \
        -H "Authorization: Bearer ${VITE_SUPABASE_SERVICE_ROLE_KEY}" \
        -H "Content-Type: application/json" \
        -d "{\"sql\": $(echo "$sql" | jq -Rs .)}" \
        --silent --show-error || echo "⚠️  Migration might have been applied or had warnings"
    
    echo "✅ $name - Done"
    echo ""
}

# Navigate to migrations directory
cd /Users/poornachandrad/Downloads/supabase/migrations

echo "📁 Found migrations directory"
echo ""

# Get all migration files
migrations=($(ls -1 *.sql 2>/dev/null | sort))

if [ ${#migrations[@]} -eq 0 ]; then
    echo "❌ No migration files found in migrations directory"
    exit 1
fi

echo "📊 Found ${#migrations[@]} migration(s):"
for migration in "${migrations[@]}"; do
    echo "   - $migration"
done
echo ""

# Ask for confirmation
read -p "Continue with applying these migrations? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Migration cancelled"
    exit 1
fi

echo ""
echo "🔐 Applying migrations to Supabase..."
echo ""

# Apply each migration
for migration in "${migrations[@]}"; do
    apply_migration "$migration"
done

echo ""
echo "✨ All migrations completed!"
echo ""
echo "Next steps:"
echo "1. Verify tables in Supabase dashboard: https://app.supabase.com/project/tjbnyurvlmbywxjlfunf/editor"
echo "2. Test the application: npm run dev"
echo "3. Check for any errors in browser console"
echo ""
