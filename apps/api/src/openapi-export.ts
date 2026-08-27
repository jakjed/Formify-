/**
 * Boot Nest long enough to emit OpenAPI JSON, then exit.
 * Usage: pnpm --filter @aptora/api openapi:export
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupOpenApi } from './openapi';

async function main() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.setGlobalPrefix('api');
  setupOpenApi(app);
  await app.close();
}

void main();
