import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { randomUUID } from 'crypto';

import { AttendanceQueryService } from './attendance-query.service';
import { AttendancePopulatorService } from './attendance-populator.service';

/**
 * Attendance nightly refresh scheduler (design.md §17).
 *
 * Config-driven (no admin UI yet): reads a cron expression from `ATTENDANCE_CRON`
 * (standard 5/6-field cron, server local time). On each tick it:
 *   1. acquires a Redis lock so the job runs ONCE across horizontally-scaled
 *      instances (whichever instance wins the lock runs it; others skip);
 *   2. runs Oracle REFRESH_ATTENDANCE_VIEWS (rebuild the MVs);
 *   3. runs the populator (page1 + series + geo + student-breakdown → Redis).
 *
 * If ATTENDANCE_CRON is empty/unset, no job is scheduled (e.g. local dev where
 * you run the populator CLI manually). An admin UI to edit the schedule is a
 * later addition; the trigger logic here is what it would drive.
 */
@Injectable()
export class AttendanceSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(AttendanceSchedulerService.name);
  private static readonly JOB_NAME = 'attendance-nightly';
  private static readonly LOCK_KEY = 'att:v1:lock:nightly';

  constructor(
    private readonly config: ConfigService,
    private readonly registry: SchedulerRegistry,
    private readonly q: AttendanceQueryService,
    private readonly populator: AttendancePopulatorService,
  ) {}

  onModuleInit(): void {
    // The populate CLI boots the same AppModule; it sets this flag so the cron
    // isn't registered in that short-lived process (it only populates + exits).
    if (String(this.config.get('ATT_DISABLE_SCHEDULER') ?? '').toLowerCase() === 'true') {
      return;
    }
    const cron = (this.config.get<string>('ATTENDANCE_CRON') ?? '').trim();
    if (!cron) {
      this.logger.log('ATTENDANCE_CRON not set — nightly refresh scheduler disabled.');
      return;
    }
    try {
      const job = new CronJob(cron, () => {
        void this.runGuarded();
      });
      this.registry.addCronJob(AttendanceSchedulerService.JOB_NAME, job as any);
      job.start();
      this.logger.log(`Attendance nightly scheduler registered: "${cron}".`);
    } catch (e: any) {
      this.logger.error(`Invalid ATTENDANCE_CRON "${cron}": ${e?.message || e}`);
    }
  }

  /**
   * Lock-guarded run (single instance across the cluster). The lock TTL is sized
   * generously (1h) so a crashed instance's lock expires and the next night can
   * run; it is released on normal completion.
   */
  async runGuarded(): Promise<void> {
    const token = randomUUID();
    const got = await this.q.acquireLock(AttendanceSchedulerService.LOCK_KEY, token, 3600);
    if (!got) {
      this.logger.log('Nightly refresh skipped — another instance holds the lock.');
      return;
    }
    const started = Date.now();
    try {
      this.logger.log('Nightly refresh: refreshing Oracle MVs…');
      await this.q.refreshViews();
      this.logger.log('Nightly refresh: MVs refreshed, running populator…');
      const r = await this.populator.runNightly();
      this.logger.log(
        `Nightly refresh done in ${((Date.now() - started) / 1000).toFixed(1)}s — ` +
          `date=${r.date} page1=${r.page1Nodes} series=${r.seriesNodes} geo=${r.geoNodes} breakdown=${r.breakdownNodes}`,
      );
    } catch (e: any) {
      this.logger.error(`Nightly refresh FAILED: ${e?.message || e}`, e?.stack);
      // Leave Redis as-is (stale-but-consistent until TTL); do not throw.
    } finally {
      await this.q.releaseLock(AttendanceSchedulerService.LOCK_KEY, token);
    }
  }
}
