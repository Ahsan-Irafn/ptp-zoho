# Practical Pathways CRM — Backup & Disaster Recovery Guide

## 1. Overview
Database integrity is paramount for applicant records, contact history, and attribution touchpoints.
All timestamps are stored in standard UTC; business hours and displays use `Asia/Karachi`.

## 2. Supabase PostgreSQL Backup Strategy

### Managed Backups
If running on Supabase Pro / Enterprise:
- Daily automatic backups are enabled by default.
- Point-In-Time-Recovery (PITR) allows restoration to any second within the retention window (e.g. 7 to 30 days).

### Manual Logical Backup (pg_dump)
To take an immediate logical export of the CRM schema and data:

```bash
pg_dump \
  -h db.<project-ref>.supabase.co \
  -p 5432 \
  -U postgres \
  -d postgres \
  -F c \
  -b \
  -v \
  -f "crm_backup_$(date +%Y%m%d_%H%M%S).dump"
```

## 3. Restore Test Procedure
1. Create a staging/isolated database.
2. Apply versioned migrations in order:
   ```bash
   psql -h <staging-host> -U postgres -d staging_crm -f supabase/migrations/20261020000000_init_crm.sql
   psql -h <staging-host> -U postgres -d staging_crm -f supabase/migrations/20261020000001_rls_policies.sql
   psql -h <staging-host> -U postgres -d staging_crm -f supabase/migrations/20261020000002_functions_triggers.sql
   psql -h <staging-host> -U postgres -d staging_crm -f supabase/migrations/20261020000003_storage_policies.sql
   ```
3. Restore custom data archive:
   ```bash
   pg_restore -h <staging-host> -U postgres -d staging_crm -v "crm_backup_<timestamp>.dump"
   ```
4. Verify row count and integrity:
   - Check `SELECT count(*) FROM contacts;`
   - Check `SELECT count(*) FROM lead_submissions;`
   - Verify `protect_last_owner` trigger operates correctly.

## 4. Local File-Backed Store Backup (Development / Offline Mode)
When running the local engine, all data is durably stored in `.crm_data/db.json`:
- Back up: Copy `.crm_data/db.json` to secure storage or encrypted archive.
- Restore: Place `db.json` in `.crm_data/` and restart the application.
