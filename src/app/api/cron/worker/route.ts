import { NextResponse } from 'next/server';
import { runWorkerTick } from '@/workers/runner';

export async function GET() {
  const result = await runWorkerTick('cron_worker_tick');
  return NextResponse.json({
    status: 'ok',
    processed: result.processed,
    errors: result.errors,
    timestamp: new Date().toISOString(),
  });
}

export async function POST() {
  return GET();
}
