import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { FxRatesController } from './api/fx-rates.controller';
import { FxConvertService } from './application/fx-convert.service';
import { FxRatesService } from './application/fx-rates.service';

@Module({
  imports: [AuditModule],
  controllers: [FxRatesController],
  providers: [FxRatesService, FxConvertService],
  exports: [FxRatesService, FxConvertService],
})
export class FxRatesModule {}
