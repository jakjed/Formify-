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
import { OAuthModule } from './modules/oauth/oauth.module';
import { OpsModule } from './modules/ops/ops.module';
import { SearchModule } from './modules/search/search.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { PurchaseRequestsModule } from './modules/purchase-requests/purchase-requests.module';
import { PurchaseOrdersModule } from './modules/purchase-orders/purchase-orders.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { AuthGuard } from './common/auth.guard';
import { RateLimitGuard } from './common/rate-limit.guard';
import { ModuleLicenseGuard } from './common/module-license.guard';

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
    OAuthModule,
    OpsModule,
    SearchModule,
    ContractsModule,
    PurchaseRequestsModule,
    PurchaseOrdersModule,
    WebhooksModule,
  ],
  providers: [
    ModuleLicenseGuard,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
  ],
})
export class AppModule {}
