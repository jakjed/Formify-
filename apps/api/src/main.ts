import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from './app.module';
import { setupOpenApi } from './openapi';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.WEB_ORIGIN?.split(',') ?? [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ],
    credentials: true,
  });
  // Accept SCIM content-type used by IdPs (Entra/Okta)
  app.useBodyParser('json', {
    type: ['application/json', 'application/scim+json'],
    limit: '2mb',
  });
  app.useBodyParser('urlencoded', { extended: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  setupOpenApi(app);

  const webDist = join(__dirname, '../../web/dist');
  if (process.env.SERVE_WEB === '1' && existsSync(webDist)) {
    app.useStaticAssets(webDist, { index: false });
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (req.path.startsWith('/api')) return next();
      res.sendFile(join(webDist, 'index.html'), (err) => {
        if (err) next(err);
      });
    });
  }

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Procure Ledger API listening on http://localhost:${port}/api`);
  // eslint-disable-next-line no-console
  console.log(`OpenAPI UI: http://localhost:${port}/api/docs`);
}

void bootstrap();
