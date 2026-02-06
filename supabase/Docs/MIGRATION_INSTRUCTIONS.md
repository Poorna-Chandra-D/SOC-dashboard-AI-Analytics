# 🚀 How to Apply Migrations to Supabase

## Quick Start (5 minutes)

### Step 1: Get Your Service Role Key
1. Go to: https://app.supabase.com/project/tjbnyurvlmbywxjlfunf/settings/api
2. Under "Project API Keys", copy the **Service Role Key** (NOT the Anon Key)
3. Keep it safe - you'll need it in step 3

### Step 2: Open Supabase SQL Editor
1. Go to: https://app.supabase.com/project/tjbnyurvlmbywxjlfunf/sql/new
2. Click **SQL Editor** in the left sidebar
3. Click the **+** button to create a new query

### Step 3: Copy & Run the Migration SQL
1. Open this file: `/Users/poornachandrad/Downloads/COMPLETE_MIGRATION.sql`
2. Copy ALL the SQL code
3. Paste it into the Supabase SQL Editor
4. Click **Run** (▶️ button at top right)
5. Wait for completion (should take 10-30 seconds)

### Step 4: Verify Success
1. At the bottom of the SQL editor, you should see results
2. Look for the verification query showing all 12 tables
3. If you see them, ✅ Migration successful!

---

## What Gets Created

### Tables (12 total)
✅ **Existing Tables:**
- threats
- alerts
- network_events
- ai_analysis_logs

✅ **New Tables:**
- incident_responses (tracks automated responses)
- user_roles (RBAC)
- roles_permissions (permission matrix)
- teams (team organization)
- team_members (team membership)
- audit_logs (compliance audit trail)
- siem_configs (SIEM integration credentials)
- external_integrations (general integrations)

### Permissions Assigned
- ✅ 7 Admin permissions
- ✅ 5 Analyst permissions
- ✅ 3 Responder permissions
- ✅ 2 Viewer permissions
- ✅ 3 Engineer permissions

### Indexes Created
- ✅ 14 performance indexes
- ✅ Covers all common queries
- ✅ Optimizes dashboard loading

---

## Troubleshooting

### "Error: Relation already exists"
This is normal if running multiple times. The migration includes `IF NOT EXISTS` clauses.
**Solution:** This is fine - just continue

### "Permission denied"
You might be using the Anon Key instead of Service Role Key.
**Solution:** 
1. Go to: https://app.supabase.com/project/tjbnyurvlmbywxjlfunf/settings/api
2. Copy the Service Role Key (longer key)
3. Re-run the migration

### "UUID type not found"
Your Supabase project might not have the uuid extension.
**Solution:** Run this first:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### "Foreign key constraint failed"
The migration ran partially. Tables exist but aren't fully connected.
**Solution:**
1. Go to: https://app.supabase.com/project/tjbnyurvlmbywxjlfunf/editor
2. Check if all tables exist
3. If some are missing, run the complete migration again

---

## Alternative: Run Individual Parts

If the complete migration fails, you can run parts separately:

### Part 1 - Core RBAC Tables
Copy from line 10-85 of COMPLETE_MIGRATION.sql

### Part 2 - SIEM Integration
Copy from line 90-135 of COMPLETE_MIGRATION.sql

### Part 3 - Fix Existing Tables
Copy from line 140-155 of COMPLETE_MIGRATION.sql

### Part 4 - Indexes
Copy from line 160-180 of COMPLETE_MIGRATION.sql

### Part 5 - Verify
Copy from line 185-200 of COMPLETE_MIGRATION.sql

---

## Verify It Worked

### In Supabase Dashboard:
1. Click **Editor** → **Tables**
2. You should see all these tables:
   - threats ✓
   - alerts ✓
   - network_events ✓
   - ai_analysis_logs ✓
   - incident_responses ✓
   - user_roles ✓
   - roles_permissions ✓
   - teams ✓
   - team_members ✓
   - audit_logs ✓
   - siem_configs ✓
   - external_integrations ✓

### In Your App:
1. Run: `npm run dev`
2. Go to http://localhost:5173
3. Login with your test account
4. Check Admin panel → Users tab
5. Check Admin panel → Audit tab
6. Check Integrations page

---

## Next: Update Environment Variables

Create `.env.local` in your soc-dashboard folder:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://tjbnyurvlmbywxjlfunf.supabase.co
VITE_SUPABASE_ANON_KEY="Your Key"

# Service Role (backend only - never commit)
VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

---

## Support

If you encounter issues:
1. Check Supabase Status: https://status.supabase.com
2. View Supabase Logs: https://app.supabase.com/project/tjbnyurvlmbywxjlfunf/logs
3. Review migration file for syntax errors
4. Try running parts separately instead of all at once
