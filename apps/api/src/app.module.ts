import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
  ],
})
export class AppModule {}
