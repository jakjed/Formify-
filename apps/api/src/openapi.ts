import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function buildOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Procure Ledger API')
    .setDescription(
      'Phase 1 modular monolith — auth session, master data, invoices, capture/files, integration jobs. Authenticate with a session bearer token or a `pl_…` API key (legacy `aptora_…` keys still accepted).',
    )
    .setVersion('0.1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT / session / pl_ API key',
        description:
          'Session token from POST /api/auth/login (or invite accept), or an API key starting with pl_ (legacy aptora_ accepted)',
      },
      'bearer',
    )
    .addTag('auth', 'Login, session, invites, password reset')
    .addTag('vendors', 'Vendor master data')
    .addTag('masterdata', 'GL, cost centers, tax codes, payment terms')
    .addTag('invoices', 'Invoice list, workspace, comments, validation')
    .addTag('capture', 'Upload / email ingest (file assets)')
    .addTag('integration', 'Templates, import/export jobs')
    .addTag('search', 'Global search')
    .addTag('health', 'Liveness')
    .build();

  return SwaggerModule.createDocument(app, config, {
    operationIdFactory: (_controllerKey: string, methodKey: string) => methodKey,
  });
}

export function setupOpenApi(app: INestApplication) {
  const document = buildOpenApiDocument(app);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
    yamlDocumentUrl: 'api/docs-yaml',
    customSiteTitle: 'Procure Ledger API',
  });

  const outPath =
    process.env.OPENAPI_OUT ??
    resolve(__dirname, '../../../packages/api-client/openapi.json');
  try {
    writeFileSync(outPath, JSON.stringify(document, null, 2));
    // eslint-disable-next-line no-console
    console.log(`Wrote OpenAPI document to ${outPath}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Could not write openapi.json:', err);
  }

  return document;
}
