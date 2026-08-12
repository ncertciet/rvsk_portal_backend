import * as winston from 'winston';

export interface WinstonLoggerOptions {
  serviceName?: string;
  level?: string;
  isDevelopment?: boolean;
}

/**
 * Creates a Winston logger configuration for a given service.
 * In production: structured JSON format with service name metadata.
 * In development: colorized simple format for readability.
 *
 * @param serviceName - The name of the service (e.g., 'auth-service', 'grievance-service')
 * @param options - Additional configuration options
 */
export function createWinstonConfig(
  serviceName?: string,
  options?: Omit<WinstonLoggerOptions, 'serviceName'>,
): winston.LoggerOptions {
  const resolvedServiceName = serviceName || process.env.SERVICE_NAME || 'rvsk-backend';
  const level = options?.level || process.env.LOG_LEVEL || 'info';
  const isDevelopment = options?.isDevelopment ?? process.env.NODE_ENV !== 'production';

  const formats: winston.Logform.Format[] = [
    winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    winston.format.errors({ stack: true }),
  ];

  const transports: winston.transport[] = [];

  if (isDevelopment) {
    formats.push(winston.format.colorize());
    formats.push(
      winston.format.printf(({ timestamp, level, message, context, correlationId, ...meta }) => {
        const ctx = context ? `[${context}]` : '';
        const corrId = correlationId ? `[${correlationId}]` : '';
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} ${level} [${resolvedServiceName}]${ctx}${corrId} ${message}${metaStr}`;
      }),
    );
    transports.push(new winston.transports.Console());
  } else {
    formats.push(winston.format.json());
    transports.push(new winston.transports.Console());
    transports.push(
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
      }),
    );
  }

  return {
    level,
    format: winston.format.combine(...formats),
    defaultMeta: { service: resolvedServiceName },
    transports,
  };
}

export const winstonConfig = createWinstonConfig();
