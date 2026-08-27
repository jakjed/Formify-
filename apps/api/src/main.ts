import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { setupOpenApi } from './openapi';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.WEB_ORIGIN?.split(',') ?? [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ],
    credentials: true,
  });
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
