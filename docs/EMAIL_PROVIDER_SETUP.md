# Practical Pathways CRM — Transactional Email Provider Setup Guide

## 1. Overview
The CRM delivers transactional acknowledgements, agent alerts, and owner summaries through a durable database-backed queue (`job_queue` and `email_messages`).

Sender Identity:
- **Default Sender Name**: Practical Pathways Admissions
- **Sender Email**: `info@pracpathways.com.au`
- **Reply-To**: `info@pracpathways.com.au`

## 2. Supported Providers
The application includes pluggable adapters for:
- **Resend** (Recommended for Next.js App Router)
- **Postmark**
- **SendGrid**
- **Custom SMTP**
- **Mock Transactional Mailer** (Active zero-config engine for local testing and development)

## 3. Production DNS Authentication (SPF, DKIM, DMARC)
For emails to land reliably in applicant inboxes (Gmail, Outlook, Yahoo) without spam filtering, configure these DNS records on your domain registrar (`pracpathways.com.au`):

### A. SPF (Sender Policy Framework)
Add or update the TXT record on `pracpathways.com.au`:
```
Type: TXT
Host: @
Value: v=spf1 include:_spf.resend.com ~all
```

### B. DKIM (DomainKeys Identified Mail)
Add the CNAME or TXT keys provided in your email provider dashboard:
```
Type: CNAME
Host: resend._domainkey.pracpathways.com.au
Value: dkim.resend.com
```

### C. DMARC (Domain-based Message Authentication)
Add the DMARC TXT record:
```
Type: TXT
Host: _dmarc.pracpathways.com.au
Value: v=DMARC1; p=reject; pct=100; rua=mailto:dmarc-reports@pracpathways.com.au; aspf=s; adkim=s
```

## 4. Unsubscribe & Anti-Spam Compliance
- Every outgoing email automatically receives a signed cryptographic token link: `https://<your-crm-domain>/unsubscribe?token=<SIGNED_PAYLOAD>`.
- Clicking the link adds the recipient to `suppression_records` and flags the contact as `email_suppressed: true`.
- The CRM automatically intercepts and cancels any pending marketing or automated follow-up sequences to suppressed emails.
- Transactional messages (e.g. password recovery) are handled under separate explicit operational rules.
