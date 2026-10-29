# Practical Pathways CRM — Durable Background Worker & Queue Deployment

## 1. Architectural Design
The CRM guarantees durable asynchronous processing for:
- Lead ingestion & normalization
- Transactional email dispatch
- Scheduled follow-up notifications & SLA escalation
- Webhook reconciliation & replay defense

The queue is backed by the durable `job_queue` table in the database with atomic row locks:
- Jobs are polled and locked (`status = 'processing'`, `locked_at = now()`, `locked_by = worker_id`).
- Completed jobs are marked `completed`.
- Failed jobs record `last_error` and use exponential backoff (`delay = 2^(attempts) * 30s`).
- Jobs exceeding `max_attempts` (default: 5) transition to `dead_letter` for owner inspection.
- Does **not** depend on browser timers or unawaited background promises.

## 2. Deployment Options

### Option A: Dedicated Node.js Daemon (PM2 / Systemd / Docker)
Run the dedicated long-running worker process:
```bash
npm run worker
```

With PM2:
```bash
pm2 start "npm run worker" --name "pracpathways-crm-worker"
pm2 save
pm2 startup
```

With Systemd (`/etc/systemd/system/crm-worker.service`):
```ini
[Unit]
Description=Practical Pathways CRM Background Worker
After=network.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/var/www/pracpathways-crm
ExecStart=/usr/bin/npm run worker
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

### Option B: Cloud Cron (Vercel Cron / Supabase pg_cron / AWS EventBridge / GitHub Actions)
If deploying serverless, trigger the idempotent worker tick endpoint:

```
GET /api/cron/worker
Authorization: Bearer <CRON_SECRET>
```

#### Vercel `vercel.json` Cron Configuration:
```json
{
  "crons": [
    {
      "path": "/api/cron/worker",
      "schedule": "* * * * *"
    }
  ]
}
```

#### Supabase `pg_cron` (PostgreSQL):
```sql
SELECT cron.schedule(
  'process-crm-jobs-every-minute',
  '* * * * *',
  $$
  SELECT net.http_get(
    url := 'https://<your-crm-domain>/api/cron/worker',
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  $$
);
```
