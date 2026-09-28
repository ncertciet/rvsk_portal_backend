import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { AttendancePopulatorService } from './attendance/attendance-populator.service';

/**
 * Attendance Redis populator CLI (design.md §14 / §17).
 *
 * The nightly cron runs this AFTER Oracle's REFRESH_ATTENDANCE_VIEWS. It reads
 * the pre-aggregated MVs and writes the ready-to-serve JSON blobs into Redis
 * (Page-1 per-node snapshots + per-school keys, and the 6-month trend series
 * per node per dimension). In dev it lets you fill Redis on demand so the
 * dashboard works with REDIS_ONLY=true without waiting for the cron.
 *
 * Usage (from rvsk_portal_backend):
 *   # build first: npm run build:6a
 *   node dist/apps/rvsk6a/apps/rvsk6a/src/populate.js            # latest data date
 *   node dist/apps/rvsk6a/apps/rvsk6a/src/populate.js 2026-09-23 # specific date
 *   (the nested path is the nest monorepo build layout.)
 *
 * Production cron (example — 02:30 nightly, after ETL + MV refresh):
 *   30 2 * * *  cd /app && node dist/apps/rvsk6a/apps/rvsk6a/src/populate.js \
 *               >> /var/log/rvsk/att-populate.log 2>&1
 */
async function main() {
  const logger = new Logger('AttendancePopulateCLI');
  const dateArg = process.argv[2]; // optional YYYY-MM-DD

  // Application context = full DI graph, no HTTP listener.
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const populator = app.get(AttendancePopulatorService);
    const result = await populator.runNightly(dateArg);
    logger.log(
      `Populate OK: date=${result.date} page1Nodes=${result.page1Nodes} seriesNodes=${result.seriesNodes}`,
    );
    await app.close();
    process.exit(0);
  } catch (err) {
    logger.error(`Populate FAILED: ${(err as Error).message}`, (err as Error).stack);
    await app.close();
    process.exit(1);
  }
}

void main();
