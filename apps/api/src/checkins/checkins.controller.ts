import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtUser } from '../auth/types/jwt-user.type';
import { CheckInsService } from './checkins.service';
import { SubmitCheckInDto } from './dto/submit-checkin.dto';
import { CheckInDto } from './dto/checkin.dto';

@ApiTags('checkins')
@Controller('checkins')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CheckInsController {
  constructor(private readonly checkInsService: CheckInsService) {}

  @Get('participant/:participantId')
  @ApiOkResponse({ type: [CheckInDto] })
  listForParticipant(@Param('participantId', new ParseUUIDPipe()) participantId: string): Promise<CheckInDto[]> {
    return this.checkInsService.listForParticipant(participantId);
  }

  @Get('participant/:participantId/today')
  @ApiOkResponse({ type: CheckInDto })
  getToday(@Param('participantId', new ParseUUIDPipe()) participantId: string): Promise<CheckInDto | null> {
    return this.checkInsService.getToday(participantId);
  }

  @Post()
  @ApiOkResponse({ type: CheckInDto })
  submit(@Body() dto: SubmitCheckInDto, @CurrentUser() user: JwtUser) {
    return this.checkInsService.submit(dto, user.id);
  }
}
