# Practical Pathways CRM — Meta Lead Ads Setup Guide

## 1. Overview
The CRM integrates directly with Facebook and Instagram Lead Ads using Meta's Graph API Webhooks.

```
Callback URL: https://<your-crm-domain>/api/webhooks/meta
Verify Token: meta_verify_pracpathways_secret_token (configured in Integrations / .env)
```

## 2. Prerequisites & Permissions
To ingest live Meta leads, your Meta Developer App and Business Manager require:
- **App Review Permissions**:
  - `leads_retrieval` (Access to read lead data)
  - `pages_manage_ads` (Manage page ad connections)
  - `pages_show_list` (View page list)
- **Business Manager Access**: Admin or Developer access to the Practical Pathways Meta Business Account and Facebook Page.
- **System User & Page Access Token**: A long-lived Page Access Token with subscription to the `leadgen` webhook field.

## 3. Webhook Subscription Configuration
1. Open [Meta for Developers](https://developers.facebook.com/) &rarr; Select your App.
2. Under **Products**, add or open **Webhooks** &rarr; Select **Page** from the dropdown.
3. Click **Subscribe to this object**.
4. Enter:
   - **Callback URL**: `https://<your-crm-domain>/api/webhooks/meta`
   - **Verify Token**: `meta_verify_pracpathways_secret_token`
5. Click **Verify and Save**. Meta will dispatch a `GET` request with `hub.mode=subscribe`, `hub.verify_token`, and `hub.challenge`. The CRM echoes `hub.challenge` with status `200 OK`.
6. Under Page fields, find **leadgen** and click **Subscribe**.

## 4. Subscribing Your Facebook Page
You must attach your Page to the app using Graph API Explorer or curl:

```bash
POST https://graph.facebook.com/v19.0/{page-id}/subscribed_apps
  ?subscribed_fields=leadgen
  &access_token={PAGE_ACCESS_TOKEN}
```

## 5. Security & Signature Verification
- In production, Meta passes the header `x-hub-signature-256: sha256=<HMAC_HASH>`.
- The CRM calculates `HMAC-SHA256(raw_body, META_APP_SECRET)` using timing-safe byte comparison (`crypto.timingSafeEqual`) to prevent timing attacks.
- Tampered or unauthenticated payloads are rejected with `401 Unauthorized`.

## 6. Testing Procedure
1. Open the [Meta Lead Ads Testing Tool](https://developers.facebook.com/tools/lead-ads-testing/).
2. Select your Page and Instant Form &rarr; Click **Create Lead**.
3. Check the CRM under **Leads & Enquiries** (`/leads`) and verify the candidate appears, assigned to Ayesha or Maryam.
4. Or use the built-in simulator in the CRM at `/test-capture` under the **Meta Lead Ads** tab.
