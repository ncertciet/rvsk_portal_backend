import { DataSource } from 'typeorm';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local' });

const pgPort = parseInt(process.env.PG_PORT ?? '5432', 10);

export default new DataSource({
  type: 'postgres',
  host: process.env.PG_HOST,
  port: Number.isNaN(pgPort) ? 5432 : pgPort,
  username: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
  schema: process.env.PG_SCHEMA ?? 'rvsk_portal',
  synchronize: false,
  logging: process.env.PG_LOGGING === 'true',
  entities: [
    'apps/portal/src/**/*.entity.ts',
    'dist/apps/portal/**/*.entity.js',
  ],
  migrations: [
    'apps/portal/src/migrations/*{.ts,.js}',
    'dist/apps/portal/migrations/*{.ts,.js}',
  ],
});