import { DynamicModule, Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CacheService, REDIS_CLIENT } from './cache.service';

@Module({})
export class RedisModule {
  static forRootAsync(): DynamicModule {
    return {
      module: RedisModule,
      imports: [ConfigModule],
      providers: [
        {
          provide: REDIS_CLIENT,
          useFactory: (configService: ConfigService) => {
            const logger = new Logger('RedisModule');

            const host = configService.get<string>('REDIS_HOST', 'localhost');
            const port = configService.get<number>('REDIS_PORT', 6379);
            const password = configService.get<string>('REDIS_PASSWORD', '');

            const client = new Redis({
              host,
              port,
              password: password || undefined,
              maxRetriesPerRequest: 3,
              retryStrategy(times: number) {
                if (times > 3) {
                  logger.warn('Redis connection retries exhausted, operating without cache');
                  return null;
                }
                return Math.min(times * 200, 2000);
              },
              lazyConnect: true,
            });

            client.on('connect', () => {
              logger.log(`Connected to Redis at ${host}:${port}`);
            });

            client.on('error', (err: Error) => {
              logger.warn(`Redis connection error: ${err.message}`);
            });

            // Attempt connection but don't block startup
            client.connect().catch((err: Error) => {
              logger.warn(`Redis initial connection failed: ${err.message}. Cache operations will silently fail.`);
            });

            return client;
          },
          inject: [ConfigService],
        },
        CacheService,
      ],
      exports: [REDIS_CLIENT, CacheService],
      global: true,
    };
  }
}
