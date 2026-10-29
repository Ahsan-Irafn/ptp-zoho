# Practical Training Pathways — WordPress Elementor Pro Integration Guide

**Website:** [https://www.pracpathways.com.au/](https://www.pracpathways.com.au/)  
**CRM Endpoint:** `POST https://crm.pracpathways.com.au/api/integrations/elementor/leads`  
**Security Standard:** HMAC-SHA256 request signing with timestamp replay protection ($\le 600$s clock skew)  
**Lead Assignment:** Atomic 50/50 round-robin split between Ayesha Sohail and Maryam Touqeer  
**Timezone:** Australia/Adelaide (ACST / ACDT DST)  

---

## 1. Overview & Architecture

Practical Training Pathways captures student course enquiries directly from Elementor Pro forms across `https://www.pracpathways.com.au/`. Two delivery architectures are supported:

1. **Option A: WordPress Server-Side Adapter Plugin (Recommended)**
   - Intercepts submissions via WordPress action hook `elementor_pro/forms/new_record`.
   - Generates a stable UUID `event_id` prior to dispatch.
   - Signs request payloads with HMAC-SHA256 using a server-held secret.
   - Queues failed deliveries into WordPress cron with bounded exponential backoff (1m, 3m, 10m, 30m, 60m), guaranteeing zero lead loss during CRM maintenance.
   - Never exposes secrets in browser HTML or form hidden fields.

2. **Option B: Elementor Pro Native Webhook (Direct)**
   - Uses Elementor Pro's native *Actions After Submit* &rarr; *Webhook*.
   - Transmits secret token via URL query parameter (`?secret=...`) or `X-Elementor-Webhook-Secret` header.

---

## 2. Elementor Pro Form Field IDs

In the Elementor visual builder, select your form widget, open each field's accordion, and expand **Advanced &rarr; ID**. Configure the field IDs as follows:

| Field Label | Recommended Elementor ID | Description / CRM Mapping |
| :--- | :--- | :--- |
| **Full Name** | `name` or `full_name` | Contact primary name (or split into `first_name` and `last_name`). |
| **First Name** | `first_name` | Candidate given name. |
| **Last Name** | `last_name` | Candidate family name. |
| **Email Address** | `email` | **Required.** Primary deduplication & communication address. |
| **Phone Number** | `phone` or `mobile` | Normalized automatically to Australian standard (`+614...`). |
| **Course Interest** | `course` or `course_interest` | Maps to verified catalogue: `CPC40120` or `CPC50220`. Unknown values flagged for owner review. |
| **Delivery Mode** | `delivery_variant` | `Self-Paced Online` or `Blended / Structured Delivery`. |
| **State / Postcode** | `state` or `postcode` | Australian state (e.g. SA, VIC, NSW) or 4-digit postcode. |
| **Message / Notes** | `message` or `enquiry` | Freeform candidate questions or trade background. |
| **Privacy Consent** | `consent` | Boolean consent acceptance for enrolment contact. |

---

## 3. Server-Side Adapter Installation (Option A)

1. Upload the provided adapter plugin:
   ```bash
   wordpress/ptp-elementor-crm-adapter.php -> /wp-content/plugins/ptp-elementor-crm-adapter.php
   ```
2. In WordPress Admin &rarr; **Plugins**, activate **Practical Training Pathways — Elementor CRM Adapter**.
3. Go to **Settings &rarr; Practical Training Pathways CRM**:
   - **CRM Endpoint URL:** `https://crm.pracpathways.com.au/api/integrations/elementor/leads`
   - **Signing Secret:** Enter the server signing secret generated in CRM Integration Settings (`ptp_elem_sec_...`).
4. Click **Save Settings**.
5. Use the **Test Webhook Dispatch** button in WP Admin to verify immediate HMAC verification.

---

## 4. Native Elementor Pro Webhook Configuration (Option B)

If you prefer using Elementor Pro's native submission action without installing plugins:

1. Open the page containing the form in Elementor Editor (e.g. `/contact-us/`).
2. Click the Form Widget &rarr; **Content** tab.
3. Open **Actions After Submit**:
   - Add **Webhook** to the list (keep your existing *Email* or *Redirect* actions).
4. Expand the **Webhook** accordion:
   - **Webhook URL:**
     ```
     https://crm.pracpathways.com.au/api/integrations/elementor/leads?secret=YOUR_CRM_SECRET_TOKEN
     ```
   - **Advanced Data:** Set to **YES** (transmits form ID, page URL, and field keys).
5. Click **Update** to publish changes.

---

## 5. Security & Verification Guardrails

- **HMAC-SHA256 Verification:** Signatures are computed against the raw request body using constant-time string comparison (`crypto.timingSafeEqual`) to eliminate timing attacks.
- **Replay Protection:** Timestamps drifting more than 10 minutes ($\pm 600$s) are rejected with HTTP 401 `STALE_TIMESTAMP`.
- **Payload Limits:** Maximum request size is capped at 512KB.
- **Rate Limiting:** Requests exceeding 60 requests/minute per client IP receive HTTP 429.
- **Idempotency Deduplication:** Webhook retries reusing the same `event_id` return HTTP 200 `duplicate_ignored` without creating duplicate candidate records, deals, or emails.
- **Secret Rotation:** Owners can rotate secrets from CRM Settings at any time without exposing stored secrets in browser code.
