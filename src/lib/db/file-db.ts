import fs from 'fs';
import path from 'path';
import {
  Organization,
  Profile,
  Invitation,
  Contact,
  LeadSubmission,
  Deal,
  Task,
  CallLog,
  Note,
  EmailTemplate,
  EmailMessage,
  JobQueueItem,
  AuditEvent,
  Notification,
  IntegrationConnection,
  WebhookEvent,
  SuppressionRecord,
  Course,
  UserCredential,
  SessionRecord,
  ModuleDefinition,
  FieldDefinition,
  CustomRecord,
} from '@/types/crm';

export interface CRMDatabase {
  organizations: Organization[];
  profiles: Profile[];
  invitations: Invitation[];
  courses: Course[];
  contacts: Contact[];
  lead_submissions: LeadSubmission[];
  deals: Deal[];
  tasks: Task[];
  call_logs: CallLog[];
  notes: Note[];
  email_templates: EmailTemplate[];
  email_messages: EmailMessage[];
  job_queue: JobQueueItem[];
  audit_events: AuditEvent[];
  notifications: Notification[];
  integration_connections: IntegrationConnection[];
  webhook_events: WebhookEvent[];
  suppression_records: SuppressionRecord[];
  user_credentials: UserCredential[];
  sessions: SessionRecord[];
  module_definitions: ModuleDefinition[];
  field_definitions: FieldDefinition[];
  custom_records: CustomRecord[];
}

const DATA_DIR = path.join(process.cwd(), '.crm_data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function getEmptyDB(): CRMDatabase {
  return {
    organizations: [],
    profiles: [],
    invitations: [],
    courses: [],
    contacts: [],
    lead_submissions: [],
    deals: [],
    tasks: [],
    call_logs: [],
    notes: [],
    email_templates: [],
    email_messages: [],
    job_queue: [],
    audit_events: [],
    notifications: [],
    integration_connections: [],
    webhook_events: [],
    suppression_records: [],
    user_credentials: [],
    sessions: [],
    module_definitions: [],
    field_definitions: [],
    custom_records: [],
  };
}

export class FileDatabaseClient {
  private inMemoryCache: CRMDatabase | null = null;

  constructor() {
    this.ensureDataDirectory();
  }

  private ensureDataDirectory() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const empty = getEmptyDB();
      fs.writeFileSync(DB_FILE, JSON.stringify(empty, null, 2), 'utf8');
      this.inMemoryCache = empty;
    }
  }

  public read(): CRMDatabase {
    try {
      if (!fs.existsSync(DB_FILE)) {
        this.ensureDataDirectory();
      }
      const data = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(data) as CRMDatabase;
      if (!parsed.courses) parsed.courses = [];
      if (!parsed.user_credentials) parsed.user_credentials = [];
      if (!parsed.sessions) parsed.sessions = [];
      if (!parsed.module_definitions) parsed.module_definitions = [];
      if (!parsed.field_definitions) parsed.field_definitions = [];
      if (!parsed.custom_records) parsed.custom_records = [];
      this.inMemoryCache = parsed;
      return parsed;
    } catch (err) {
      if (this.inMemoryCache) return this.inMemoryCache;
      const empty = getEmptyDB();
      this.write(empty);
      return empty;
    }
  }

  public write(data: CRMDatabase): void {
    this.ensureDataDirectory();
    const content = JSON.stringify(data, null, 2);
    try {
      const tempFile = path.join(DATA_DIR, `temp_${Date.now()}_${Math.random().toString(36).substring(7)}.json`);
      fs.writeFileSync(tempFile, content, 'utf8');
      try {
        fs.renameSync(tempFile, DB_FILE);
      } catch (renameErr) {
        // Fallback on Windows if rename is locked
        fs.writeFileSync(DB_FILE, content, 'utf8');
        try { fs.unlinkSync(tempFile); } catch (e) {}
      }
    } catch (err) {
      fs.writeFileSync(DB_FILE, content, 'utf8');
    }
    this.inMemoryCache = data;
  }

  public mutate<T>(fn: (db: CRMDatabase) => T): T {
    const current = this.read();
    const result = fn(current);
    this.write(current);
    return result;
  }
}

export const fileDb = new FileDatabaseClient();
