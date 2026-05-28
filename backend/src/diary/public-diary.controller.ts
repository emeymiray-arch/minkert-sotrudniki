import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { DiaryService } from './diary.service';
import { SavePublicDiaryDayDto } from './dto/save-public-diary-day.dto';
import { SubmitPublicDiaryDto } from './dto/submit-public-diary.dto';

@Controller('public/diary')
export class PublicDiaryController {
  constructor(private readonly diary: DiaryService) {}

  @Public()
  @Get(':token/meta')
  meta(@Param('token') token: string) {
    return this.diary.getMetaByToken(token);
  }

  @Public()
  @Get(':token/days/:date')
  getDay(@Param('token') token: string, @Param('date') date: string) {
    return this.diary.getPublicDay(token, date);
  }

  @Public()
  @Put(':token/days/:date')
  putDay(@Param('token') token: string, @Param('date') date: string, @Body() dto: SavePublicDiaryDayDto) {
    return this.diary.savePublicDay(token, date, dto.lines);
  }

  @Public()
  @Post(':token/submit')
  submit(@Param('token') token: string, @Body() dto: SubmitPublicDiaryDto) {
    return this.diary.submitPublicDay(token, dto.date);
  }
}
