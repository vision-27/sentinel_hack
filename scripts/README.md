# Database Setup Scripts

This directory contains SQL scripts for setting up the First Responder Emergency Dashboard database.

## Files

### `setup-database.sql`
**Complete setup script** - Creates all tables, indexes, triggers, RLS policies, and seed data in one go.

**Use this for:** Fresh Supabase project setup or complete database initialization.

```bash
# Run in Supabase SQL Editor or via psql
psql -U postgres -d your_database -f scripts/setup-database.sql
```

### `schema.sql`
**Schema only** - Creates tables, indexes, triggers, and RLS policies without any data.

**Use this for:** Production deployments where you don't want demo data.

```bash
psql -U postgres -d your_database -f scripts/schema.sql
```

### `seed-data.sql`
**Seed data only** - Inserts demo data (responders, calls, transcripts, extracted fields).

**Use this for:** Adding demo data to an existing database with schema already in place.

```bash
psql -U postgres -d your_database -f scripts/seed-data.sql
```

## Database Schema

### Tables

1. **responders** - First responders, dispatchers, supervisors
   - Stores user profiles, roles, and jurisdiction info
   
2. **calls** - Emergency call records
   - Main table for tracking active and closed calls
   - Includes location, impact category, priority, and incident details
   
3. **transcript_blocks** - Live call transcripts
   - Real-time transcription chunks from caller, AI, and responders
   - Supports highlighting and tagging
   
4. **extracted_fields** - AI-extracted structured data
   - Key information extracted from call transcripts
   - Includes confidence scores and verification status
   
5. **call_actions** - Responder actions log
   - Tracks all actions taken during a call (dispatch, notes, etc.)
   
6. **audit_logs** - Complete audit trail
   - System-wide audit logging for compliance

### Features

- **Automatic Timestamps**: `created_at` and `updated_at` managed by triggers
- **Row Level Security (RLS)**: Policies ensure responders only see authorized data
- **Realtime Support**: Configured for Supabase Realtime subscriptions
- **Indexes**: Optimized for common query patterns
- **Foreign Keys**: Referential integrity with cascade deletes where appropriate
- **Check Constraints**: Data validation at database level

## Supabase Setup

### Quick Start

1. Create a new Supabase project at [supabase.com](https://supabase.com)

2. Go to the SQL Editor in your Supabase dashboard

3. Copy and paste the contents of `setup-database.sql`

4. Run the script

5. Copy your project URL and anon key to your `.env` file:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Authentication Setup (Optional)

If you want to enable user authentication:

1. Go to Authentication > Providers in Supabase dashboard
2. Enable Email provider
3. Create test users matching the responder emails:
   - dispatcher1@example.com
   - supervisor@example.com
   - dispatcher2@example.com

### Realtime Setup

The setup script automatically configures realtime for:
- `calls` - Get notified of new calls and status changes
- `transcript_blocks` - Stream live transcripts
- `extracted_fields` - Watch AI extraction updates
- `call_actions` - Track responder actions in real-time

## Demo Data

The seed data includes:

- **3 Responders**:
  - Sarah Johnson (Dispatcher, North jurisdiction)
  - Michael Chen (Supervisor, Central jurisdiction)
  - Emma Davis (Dispatcher, South jurisdiction)

- **3 Active Calls**:
  - CALL-2025-001: Critical medical emergency (father collapsed, not breathing)
  - CALL-2025-002: High priority fire (apartment building, 3 people inside)
  - CALL-2025-003: Medium priority traffic accident (2 vehicles, 2 injured)

- **16 Transcript blocks** across all calls
- **14 Extracted fields** with confidence scores

## Troubleshooting

### RLS Policies Blocking Queries

If you're testing without authentication, you may need to temporarily disable RLS:

```sql
ALTER TABLE calls DISABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_blocks DISABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_fields DISABLE ROW LEVEL SECURITY;
-- ... repeat for other tables
```

### UUID Extension Not Available

If you get an error about `uuid-ossp`, run:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### Realtime Not Working

Check that tables are added to the realtime publication:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE calls;
ALTER PUBLICATION supabase_realtime ADD TABLE transcript_blocks;
ALTER PUBLICATION supabase_realtime ADD TABLE extracted_fields;
ALTER PUBLICATION supabase_realtime ADD TABLE call_actions;
```

## Schema Modifications

When modifying the schema:

1. Update `schema.sql` with your changes
2. Update `setup-database.sql` to include the changes
3. Test with a fresh database
4. Update TypeScript types in `src/types/index.ts`
5. Create a migration script for existing deployments

## Production Considerations

- **Remove seed data** for production deployments (use `schema.sql` only)
- **Backup regularly** using Supabase backup features or `pg_dump`
- **Monitor performance** - add indexes if specific queries are slow
- **Review RLS policies** - ensure they match your security requirements
- **Enable audit logging** - configure `audit_logs` writes in application code
- **Set up monitoring** - use Supabase dashboard or external monitoring tools

