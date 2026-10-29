# Practical Pathways CRM — Production Launch Checklist

Follow this checklist prior to pointing live paid ad campaigns or production domain traffic to the CRM:

- [x] **Code & Database Schema Migrations**
  - PostgreSQL schema, enum types, indexes, and triggers verified in `supabase/migrations/`.
  - Multi-tenant organization scoping active throughout tables.
- [x] **Permissions & Role-Based Access Control**
  - Owners (Jawad & Sohail) have separate individual logins.
  - Calling Agents (Ayesha & Maryam) restricted to assigned records.
  - Direct URL access to unassigned records blocked (403 Forbidden).
  - Last active owner deletion/disablement prevented by database invariant.
- [x] **Deduplication & Ingestion Pipeline**
  - Webhook provider retries ignored safely without duplicate records or emails.
  - Genuine repeat enquiries linked to existing contact, preserving assigned agent.
  - Conflicting phone/email matches flagged for owner review.
  - Automatic round-robin assignment alternates between active agents.
- [x] **Calling Workspace & Dialer**
  - Queues configured (New assigned, Today's follow-ups, Overdue, No-answer, Callbacks).
  - Native `tel:` click-to-dial baseline active.
  - Call duration, outcomes, discussion notes, and scheduled follow-ups persist to timeline.
- [x] **Email Automation & Compliance**
  - Transactional welcome acknowledgements with variable substitution.
  - Signed unsubscribe links with automatic suppression list enforcement.
  - Test leads (`is_test: true`) blocked from sending live customer emails.
- [ ] **External Provider Secrets & Keys Setup (To be completed with live credentials)**
  - Enter production `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.
  - Complete Meta App Review for `leads_retrieval` and paste Page Access Token.
  - Set Google Ads Lead Form webhook key `google_key` in Google Ads Manager.
  - Configure Resend / Postmark API key and verify DNS records (SPF, DKIM, DMARC) on `pracpathways.com.au`.
- [x] **Security Hardening**
  - Security headers configured (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`).
  - Embed form allows cross-origin embed on WordPress (`/embed/form`).
  - Formula injection sanitization on CSV exports (`=`, `+`, `-`, `@` escaped).
  - Append-only security audit trail active for sensitive actions.
- [x] **Automated Acceptance Verification**
  - 21 out of 21 automated acceptance tests passed.
  - Next.js production build compiled with 0 errors.
