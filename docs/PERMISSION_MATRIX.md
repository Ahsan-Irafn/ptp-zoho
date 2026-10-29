# Practical Pathways CRM — Role-Based Permission Matrix

This CRM enforces strict multi-tenant organization scoping and role-based access control (RBAC).
There are two system roles: **Business Owners** and **Calling Agents**.

| Capability / Resource | Business Owners<br>*(Muhammad Jawad & Sohail Sadiq)* | Calling Agents<br>*(Ayesha Sohail & Maryam Touqeer)* | Enforcement Layer |
| :--- | :--- | :--- | :--- |
| **View Organization Contacts** | **All Contacts** across the organization | **My Contacts only** (records assigned to the agent) | PostgreSQL RLS, Server-side filtering, UI Tables |
| **Access Record by Direct ID / URL** | Can view any contact in their organization | **Forbidden (403)** if record is unassigned or assigned to another agent | Server Component + API Route Check |
| **Create Manual Leads** | Permitted | Permitted | API Route & UI |
| **Assign / Reassign Leads** | Full control across team members | **Cannot reassign** contacts | Server Action validation & RLS |
| **Log Human Calls** | Permitted | Permitted for assigned contacts | Database trigger & API |
| **Schedule Follow-ups & Tasks** | Permitted | Permitted for assigned contacts | Database trigger & API |
| **Send Approved Emails** | Permitted (checks suppression list) | Permitted (checks suppression list) | Email Service & Suppression Check |
| **Manage Email Templates** | Create, edit, activate system templates | View and select only | API Route `403` for agents |
| **Export Database to CSV** | **Permitted** (with formula injection protection) | **Forbidden (403)** | Export API Route |
| **Merge Duplicate Contacts** | **Permitted** (atomic merge with audit log) | **Forbidden (403)** | Merge API Route |
| **Delete Contacts Permanently** | Permitted | **Forbidden (403)** | Database RLS policy |
| **View Executive Reports** | Full organization reports and revenue metrics | **Forbidden (403)** | Server Component route guard |
| **View Security Audit Logs** | Full append-only audit trail | **Forbidden (403)** | Server Component route guard |
| **Manage Team & Invitations** | Invite members, configure roles | **Forbidden (403)** | Team Route Guard |
| **Self Role Elevation** | Protected | **Blocked** by RLS and API validation | Database Invariant |
| **Disable Last Active Owner** | **Blocked** (requires at least 1 active owner) | **Forbidden** | Database Trigger `protect_last_owner` |
| **Manage Integration Credentials** | View, edit Meta, Google, Webhook secrets | **Forbidden (403)** | API Route & RLS |

## Key Invariants
1. **No Shared Owner Login**: Muhammad Jawad and Sohail Sadiq have separate individual accounts (`muhammad.jawad@pracpathways.com.au` and `sohail.sadiq@pracpathways.com.au`).
2. **Last Owner Protection**: The database trigger `protect_last_owner` blocks any update or deletion that would result in 0 active owners.
3. **Agent Isolation**: If Calling Agent Ayesha attempts to view `http://localhost:3000/contacts/contact_002` (assigned to Maryam), the system immediately returns a `403 Access Denied` response and logs an unauthorized access attempt.
