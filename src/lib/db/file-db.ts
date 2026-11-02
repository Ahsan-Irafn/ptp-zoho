import fs from 'fs';
import path from 'path';
import os from 'os';
import defaultDbData from './initial-db.json';
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

function resolveDbPaths(): { dir: string; file: string; isReadOnly: boolean } {
  const localDir = path.join(process.cwd(), '.crm_data');
  const localFile = path.join(localDir, 'db.json');

  // Test if local directory is writable
  try {
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    const testFile = path.join(localDir, `.test_${Date.now()}`);
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    return { dir: localDir, file: localFile, isReadOnly: false };
  } catch {
    // Local directory is read-only (e.g. Netlify/Lambda serverless)
    const tmpDir = path.join(os.tmpdir(), '.crm_data');
    const tmpFile = path.join(tmpDir, 'db.json');
    try {
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
    } catch {}
    return { dir: tmpDir, file: tmpFile, isReadOnly: true };
  }
}

export class FileDatabaseClient {
  private inMemoryCache: CRMDatabase | null = null;
  private dbPaths: { dir: string; file: string; isReadOnly: boolean };

  constructor() {
    this.dbPaths = resolveDbPaths();
    this.ensureInitialized();
  }

  private getDefaultDatabase(): CRMDatabase {
    return JSON.parse(JSON.stringify(defaultDbData)) as CRMDatabase;
  }

  private ensureInitialized() {
    try {
      // If target file doesn't exist, try copying from local .crm_data/db.json or default seed
      if (!fs.existsSync(this.dbPaths.file)) {
        const localFile = path.join(process.cwd(), '.crm_data', 'db.json');
        if (fs.existsSync(localFile)) {
          try {
            const content = fs.readFileSync(localFile, 'utf8');
            fs.writeFileSync(this.dbPaths.file, content, 'utf8');
            this.inMemoryCache = JSON.parse(content);
            return;
          } catch {}
        }
        const defaultData = this.getDefaultDatabase();
        try {
          fs.writeFileSync(this.dbPaths.file, JSON.stringify(defaultData, null, 2), 'utf8');
        } catch {}
        this.inMemoryCache = defaultData;
      }
    } catch {
      this.inMemoryCache = this.getDefaultDatabase();
    }
  }

  public read(): CRMDatabase {
    if (this.inMemoryCache && Array.isArray(this.inMemoryCache.profiles) && this.inMemoryCache.profiles.length > 0) {
      return this.inMemoryCache;
    }

    try {
      if (fs.existsSync(this.dbPaths.file)) {
        const data = fs.readFileSync(this.dbPaths.file, 'utf8');
        const parsed = JSON.parse(data) as CRMDatabase;
        if (Array.isArray(parsed.profiles) && parsed.profiles.length > 0) {
          if (!parsed.courses) parsed.courses = [];
          if (!parsed.user_credentials) parsed.user_credentials = [];
          if (!parsed.sessions) parsed.sessions = [];
          if (!parsed.module_definitions) parsed.module_definitions = [];
          if (!parsed.field_definitions) parsed.field_definitions = [];
          if (!parsed.custom_records) parsed.custom_records = [];
          this.inMemoryCache = parsed;
          return parsed;
        }
      }

      // Check process.cwd() fallback
      const localFile = path.join(process.cwd(), '.crm_data', 'db.json');
      if (fs.existsSync(localFile)) {
        const data = fs.readFileSync(localFile, 'utf8');
        const parsed = JSON.parse(data) as CRMDatabase;
        if (Array.isArray(parsed.profiles) && parsed.profiles.length > 0) {
          this.inMemoryCache = parsed;
          return parsed;
        }
      }
    } catch (err) {
      console.warn('Database file read warning, using bundled dataset:', err);
    }

    const fallback = this.getDefaultDatabase();
    this.inMemoryCache = fallback;
    return fallback;
  }

  public write(data: CRMDatabase): void {
    this.inMemoryCache = data;
    const content = JSON.stringify(data, null, 2);

    try {
      if (!fs.existsSync(this.dbPaths.dir)) {
        fs.mkdirSync(this.dbPaths.dir, { recursive: true });
      }

      const tempFile = path.join(
        this.dbPaths.dir,
        `temp_${Date.now()}_${Math.random().toString(36).substring(7)}.json`
      );

      try {
        fs.writeFileSync(tempFile, content, 'utf8');
        fs.renameSync(tempFile, this.dbPaths.file);
      } catch {
        fs.writeFileSync(this.dbPaths.file, content, 'utf8');
        try { fs.unlinkSync(tempFile); } catch {}
      }
    } catch (err) {
      // In serverless environments, file write failure is non-fatal
      console.warn('Persistent disk write warning (in-memory state preserved):', err);
    }
  }

  public mutate<T>(fn: (db: CRMDatabase) => T): T {
    const current = this.read();
    const result = fn(current);
    this.write(current);
    return result;
  }
}

export const fileDb = new FileDatabaseClient();
