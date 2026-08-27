import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
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

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Aptora API listening on http://localhost:${port}/api`);
  // eslint-disable-next-line no-console
  console.log(`OpenAPI UI: http://localhost:${port}/api/docs`);
}

void bootstrap();
