import { db } from '@/lib/db';
import { EmailService } from '@/lib/services/email-service';
import { LeadProcessor } from '@/lib/services/lead-processor';

export async function runWorkerTick(workerId: string = 'worker_node_1'): Promise<{ processed: number; errors: number }> {
  const jobs = db.jobQueue.pollAndLockJobs(workerId, 10);
  let processed = 0;
  let errors = 0;

  for (const job of jobs) {
    try {
      if (job.job_type === 'send_email') {
        const payload = job.payload;
        const result = await EmailService.sendEmail({
          organizationId: job.organization_id,
          contactId: payload.contactId,
          recipientEmail: payload.recipientEmail,
          templateSlug: payload.templateSlug,
          customSubject: payload.subject,
          customBody: payload.body,
          agentName: payload.agentName,
        });

        if (result.status === 'failed') {
          throw new Error(result.error || 'Failed to dispatch email');
        }

        db.jobQueue.markComplete(job.id);
        processed++;

      } else if (job.job_type === 'process_lead') {
        await LeadProcessor.processLead(job.payload as any);
        db.jobQueue.markComplete(job.id);
        processed++;

      } else if (job.job_type === 'check_followups') {
        // Scan for overdue follow-up tasks and notify assigned agents
        const now = new Date().toISOString();
        const overdueTasks = db.tasks.findMany(job.organization_id).filter(
          t => t.status === 'pending' && t.due_date < now
        );

        for (const task of overdueTasks) {
          db.notifications.create({
            organization_id: job.organization_id,
            user_id: task.assigned_agent_id,
            title: '⚠️ Overdue Follow-up Task',
            message: `Task '${task.title}' is overdue.`,
            link: task.contact_id ? `/contacts/${task.contact_id}` : '/tasks',
            type: 'followup_due',
          });
        }

        db.jobQueue.markComplete(job.id);
        processed++;
      } else {
        // Unknown or custom job
        db.jobQueue.markComplete(job.id);
        processed++;
      }
    } catch (err: any) {
      errors++;
      console.error(`❌ Job ${job.id} failed (attempt ${job.attempts}/${job.max_attempts}):`, err.message);
      db.jobQueue.markFailed(job.id, err.message || 'Worker execution error');
    }
  }

  return { processed, errors };
}

// Background CLI Daemon Runner
async function startDaemon() {
  console.log('🚀 Practical Pathways Durable CRM Background Worker started.');
  console.log('🔄 Polling job_queue for pending tasks every 5 seconds...');

  const interval = setInterval(async () => {
    try {
      const stats = await runWorkerTick();
      if (stats.processed > 0 || stats.errors > 0) {
        console.log(`[Worker] Processed: ${stats.processed}, Errors: ${stats.errors}`);
      }
    } catch (err: any) {
      console.error('[Worker Error]:', err.message);
    }
  }, 5000);

  process.on('SIGINT', () => {
    clearInterval(interval);
    console.log('🛑 Background worker stopped.');
    process.exit(0);
  });
}

if (require.main === module || process.argv[1]?.includes('runner.ts')) {
  startDaemon();
}
