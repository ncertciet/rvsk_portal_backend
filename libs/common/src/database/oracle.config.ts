import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';

const logger = new Logger('OracleConnector');

/**
 * Creates a TypeORM DataSource configuration for Oracle ADW using oracledb Thin mode
 * with wallet-based authentication.
 *
 * Environment variables:
 * - DB_USER: Oracle database username
 * - DB_PASSWORD: Oracle database password
 * - DB_CONNECT_STRING: Oracle connection string (e.g., TNS alias or host:port/service)
 * - TNS_ADMIN: Path to wallet/TNS admin directory
 * - DB_POOL_SIZE: Connection pool size (1-50, default 10)
 * - DB_LOGGING: Enable TypeORM query logging (true/false)
 * - DB_SCHEMA: Schema name (default RTIWARI)
 */
export function createOracleDataSource(config: ConfigService): TypeOrmModuleOptions {
  const parsed = parseInt(config.get<string>('DB_POOL_SIZE', '10'), 10);
  const poolSize = Math.min(50, Math.max(1, isNaN(parsed) ? 10 : parsed));

  return {
    type: 'oracle',
    username: config.get<string>('DB_USER'),
    password: config.get<string>('DB_PASSWORD'),
    connectString: config.get<string>('DB_CONNECT_STRING'),
    schema: config.get<string>('DB_SCHEMA', 'RTIWARI'),
    synchronize: false,
    logging: config.get<string>('DB_LOGGING', 'false') === 'true',
    extra: {
      configDir: config.get<string>('TNS_ADMIN'),
    },
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
