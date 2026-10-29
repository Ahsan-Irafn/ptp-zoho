# Practical Pathways CRM — Google Ads Lead Form Setup Guide

## 1. Overview
The CRM supports two distinct Google Ads lead capture mechanisms:
1. **Native Google Ads Lead Form Extensions / Assets**: Ingested via direct Google Webhook.
2. **Website Enquiries Attributed to Google Ads**: Visitors who click a Google Ad, land on the website with `gclid` / UTM parameters, and submit a website form.

```
Google Webhook URL: https://<your-crm-domain>/api/webhooks/google-ads
google_key (Key): google_lead_secret_key_pracpathways_2026
```

## 2. Setting Up Native Lead Form Webhook in Google Ads
1. Sign in to your [Google Ads Account](https://ads.google.com/).
2. In the navigation menu, click **Ads & assets** &rarr; **Assets** &rarr; **Lead form**.
3. Create a new lead form or edit an existing one.
4. Scroll to **Export leads from Google Ads** &rarr; Select **Other data integration options (Webhook)**.
5. In **Webhook URL**, enter: `https://<your-crm-domain>/api/webhooks/google-ads`.
6. In **Key**, enter the configured key: `google_lead_secret_key_pracpathways_2026` (or custom key configured in Settings).
7. Click **Send test data**.
8. Verify Google shows a green checkmark indicating successful delivery.

## 3. Schema & Data Parsing
Google delivers an array of `user_column_data`:
```json
{
  "lead_id": "884102941092817265",
  "api_version": "1.0",
  "form_id": "773322",
  "campaign_id": "991827",
  "google_key": "google_lead_secret_key_pracpathways_2026",
  "is_test": false,
  "user_column_data": [
    { "column_id": "FULL_NAME", "string_value": "Dr. Usman Tariq" },
    { "column_id": "EMAIL", "string_value": "usman.tariq@gmail.com" },
    { "column_id": "PHONE_NUMBER", "string_value": "0321-8899001" },
    { "column_id": "COMPANY_NAME", "string_value": "Apex Logistics" }
  ]
}
```

### Safety Features Implemented in the CRM:
- **64-bit Integer Precision**: `lead_id` is processed strictly as a string to avoid IEEE 754 precision loss that causes duplicate lead IDs in JavaScript numbers.
- **Key Validation**: If `google_key` doesn't match, returns `401 Unauthorized`.
- **Test Lead Shield**: If `is_test: true` is delivered, the lead is stored with `is_test: true` and flagged so no real customer acknowledgement email is dispatched to fake test addresses.
- **Deduplication**: Deduplicated using `google_${lead_id}` as unique idempotency key.
