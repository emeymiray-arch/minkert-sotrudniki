import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { DiaryService } from './diary.service';
import { SavePublicDiaryDayDto } from './dto/save-public-diary-day.dto';

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
}
