import { Module } from '@nestjs/common';
import { DiaryService } from './diary.service';
import { PublicDiaryController } from './public-diary.controller';

@Module({
  controllers: [PublicDiaryController],
  providers: [DiaryService],
  exports: [DiaryService],
})
export class DiaryModule {}
