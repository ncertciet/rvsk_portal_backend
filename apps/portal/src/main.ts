import { NestFactory, Reflector } from '@nestjs/core';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const apiPrefix = config.get<string>('API_PREFIX')?.trim();
  if (!apiPrefix) {
    throw new Error('Missing required configuration: API_PREFIX');
  }
  app.setGlobalPrefix(apiPrefix);

  // Security middleware. crossOriginResourcePolicy is relaxed so that images
  // served from /uploads can be embedded by the frontend on a different origin.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  // ─── Static hosting for uploaded files ──────────────────────────────────────
  // Serves everything under the upload base directory (gallery, vsk, events, …)
  // at `/<API_PREFIX>/uploads/...`. Local filesystem now; swap the base path for
  // object storage mounts in prod/test via UPLOAD_BASE_PATH.
  const uploadBase = path.resolve(config.get<string>('UPLOAD_BASE_PATH', './uploads'));
  if (!fs.existsSync(uploadBase)) {
    fs.mkdirSync(uploadBase, { recursive: true });
  }
  app.useStaticAssets(uploadBase, {
    prefix: `/${apiPrefix}/uploads/`,
    index: false,
    fallthrough: false,
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    },
  });

  // CORS configuration
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim())
    : ['http://localhost:3000'];
  app.enableCors({ origin: corsOrigins, credentials: true });

  // Global validation pipe (whitelist strips unknown fields, transform enables auto type coercion)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Global serialization interceptor — ensures @Exclude/@Expose decorators work
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  const port = process.env.AUTH_PORT || 8091;
  await app.listen(port);
  console.log(`RVSK Portal running on port ${port}`);
}
bootstrap();
