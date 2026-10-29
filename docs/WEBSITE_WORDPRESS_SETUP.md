# Practical Pathways CRM — Website & WordPress Lead Capture Setup

## 1. Overview
The CRM accepts lead submissions from website contact forms, landing pages, and WordPress form builders via a secure HTTP POST webhook endpoint:

```
POST https://<your-crm-domain>/api/webhooks/website-lead
Content-Type: application/json
```

## 2. Payload Schema
| Field Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `fullName` | String | **Yes** | Full candidate name (min 2 characters) |
| `email` | String | **Yes** | Candidate email address |
| `phone` | String | Optional | Raw phone number (auto-normalized to E.164) |
| `company` | String | Optional | Hospital, medical college, or workplace |
| `city` | String | Optional | Candidate city (e.g. Lahore, Karachi, Islamabad) |
| `message` | String | Optional | Questions or course interest |
| `website_hp` | String | Optional | **Anti-Spam Honeypot**: Must be left empty |
| `utm_source` | String | Optional | Marketing source (e.g. `google`, `meta`, `linkedin`) |
| `utm_medium` | String | Optional | Marketing medium (e.g. `cpc`, `display`, `email`) |
| `utm_campaign`| String | Optional | Campaign identifier |
| `gclid` | String | Optional | Google Click Identifier for paid ad attribution |
| `fbclid` | String | Optional | Meta / Facebook Click Identifier |
| `landing_page` | String | Optional | Full URL of the landing page where form was submitted |
| `referrer` | String | Optional | HTTP referrer |
| `consent` | Boolean| Optional | Explicit marketing / communication consent |

## 3. WordPress Integration Guide

### Option A: WPForms (Webhooks Addon or Zapier / Webhook Action)
1. In WordPress Admin, navigate to **WPForms** &rarr; **Edit Form**.
2. Go to **Settings** &rarr; **Webhooks**.
3. Set **Request URL** to: `https://<your-crm-domain>/api/webhooks/website-lead`
4. Set **Request Method** to `POST` and **Request Format** to `JSON`.
5. Map form fields:
   - `fullName` &rarr; `{field_id="1"}`
   - `email` &rarr; `{field_id="2"}`
   - `phone` &rarr; `{field_id="3"}`
   - `message` &rarr; `{field_id="4"}`
   - `gclid` &rarr; `{query_var="gclid"}`
   - `utm_source` &rarr; `{query_var="utm_source"}`
   - `utm_campaign` &rarr; `{query_var="utm_campaign"}`

### Option B: Elementor Pro Forms
1. In Elementor Editor, select the Form widget.
2. In the panel, go to **Actions After Submit** &rarr; Add **Webhook**.
3. Under **Webhook**, paste: `https://<your-crm-domain>/api/webhooks/website-lead`.
4. Ensure your form field IDs match: `fullName`, `email`, `phone`, `message`.
5. Add a hidden field with ID `website_hp` (honeypot). If a bot fills this hidden field, the submission is discarded silently.

### Option C: Embeddable Responsive Iframe
If you prefer zero coding or custom plugin setup, paste this iframe directly into any WordPress or HTML page:

```html
<iframe 
  src="https://<your-crm-domain>/embed/form" 
  width="100%" 
  height="720" 
  frameborder="0" 
  style="border: none; border-radius: 16px; overflow: hidden;"
  title="Practical Pathways Admissions Enquiry"
></iframe>
```

## 4. Deduplication & Repeat Enquiry Handling
- **Provider Retry**: If a form plugin posts the same submission multiple times, the idempotency key stops duplicate lead creation or duplicate emails.
- **Repeat Candidate**: If an existing doctor submits another enquiry 2 weeks later, the CRM keeps their original assigned agent (Ayesha or Maryam), updates `latest_enquiry_at`, and appends the new touchpoint to their unified activity timeline.
