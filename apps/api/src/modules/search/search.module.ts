import { Module } from '@nestjs/common';
import { SearchController } from './api/search.controller';

@Module({
  controllers: [SearchController],
})
export class SearchModule {}
