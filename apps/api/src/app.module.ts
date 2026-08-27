import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { TenancyModule } from './modules/tenancy/tenancy.module';
import { IdentityModule } from './modules/identity/identity.module';
import { MasterdataModule } from './modules/masterdata/masterdata.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { CaptureModule } from './modules/capture/capture.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { IntegrationModule } from './modules/integration/integration.module';
import { UsageModule } from './modules/usage/usage.module';
import { AuditModule } from './modules/audit/audit.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ApiKeysModule } from './modules/apikeys/apikeys.module';
import { OpsModule } from './modules/ops/ops.module';
import { AuthGuard } from './common/auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    DatabaseModule,
    HealthModule,
    TenancyModule,
    IdentityModule,
    MasterdataModule,
    InvoicesModule,
    CaptureModule,
    WorkflowModule,
    IntegrationModule,
    UsageModule,
    AuditModule,
    NotificationsModule,
    ApiKeysModule,
    OpsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
