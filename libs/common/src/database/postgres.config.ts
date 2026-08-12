import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';

const logger = new Logger('PostgresConnector');

/**
 * Creates a TypeORM DataSource configuration for PostgreSQL.
 *
 * Environment variables:
 * - PG_HOST: PostgreSQL host
 * - PG_PORT: PostgreSQL port (default 5432)
 * - PG_USER: PostgreSQL username
 * - PG_PASSWORD: PostgreSQL password
 * - PG_DATABASE: PostgreSQL database name
 * - PG_SCHEMA: PostgreSQL schema name (default 'rvsk_portal')
 * - PG_POOL_SIZE: Connection pool size (1-50, default 10)
 * - PG_LOGGING: Enable TypeORM query logging (true/false)
 */
export function createPostgresDataSource(config: ConfigService): TypeOrmModuleOptions {
  const parsed = parseInt(config.get<string>('PG_POOL_SIZE', '10'), 10);
  const poolSize = Math.min(50, Math.max(1, isNaN(parsed) ? 10 : parsed));

  return {
    type: 'postgres',
    host: config.get<string>('PG_HOST'),
    port: parseInt(config.get<string>('PG_PORT', '5432'), 10),
    username: config.get<string>('PG_USER'),
    password: config.get<string>('PG_PASSWORD'),
    database: config.get<string>('PG_DATABASE'),
    schema: config.get<string>('PG_SCHEMA', 'rvsk_portal'),
    synchronize: false,
    autoLoadEntities: true,
    logging: config.get<string>('PG_LOGGING', 'false') === 'true',
    poolSize,
    retryAttempts: 3,
    retryDelay: 5000,
    logger: {
      logQuery: () => {},
      logQueryError: (error: string) => {
        logger.error(`Query error: ${error}`);
      },
      logQuerySlow: () => {},
      logSchemaBuild: () => {},
      logMigration: () => {},
      log: (level: string, message: string) => {
        if (level === 'warn') {
          logger.warn(message);
        } else if (level === 'info') {
          logger.log(message);
        }
      },
    } as any,
  };
}
