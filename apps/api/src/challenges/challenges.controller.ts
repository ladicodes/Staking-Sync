import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtUser } from '../auth/types/jwt-user.type';
import { ChallengesService } from './challenges.service';
import { CreateChallengeDto } from './dto/create-challenge.dto';
import { ListChallengesQuery } from './dto/list-challenges.query';
import { ChallengeDto } from './dto/challenge.dto';
import { ParticipantDto } from './dto/participant.dto';

@ApiTags('challenges')
@Controller('challenges')
export class ChallengesController {
  constructor(private readonly challengesService: ChallengesService) {}

  @Get()
  @ApiOkResponse({ type: [ChallengeDto] })
  list(@Query() query: ListChallengesQuery): Promise<ChallengeDto[]> {
    return this.challengesService.list(query);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getMyChallenges(@CurrentUser() user: JwtUser) {
    return this.challengesService.getMyChallenges(user.id);
  }

  @Get(':id')
  @ApiOkResponse({ type: ChallengeDto })
  getById(@Param('id', new ParseUUIDPipe()) id: string): Promise<ChallengeDto> {
    return this.challengesService.getById(id);
  }

  @Get(':id/participants')
  @ApiOkResponse({ type: [ParticipantDto] })
  getParticipants(@Param('id', new ParseUUIDPipe()) id: string): Promise<ParticipantDto[]> {
    return this.challengesService.getParticipants(id);
  }

  @Get(':id/participants/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: ParticipantDto })
  getMyParticipation(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtUser
  ): Promise<ParticipantDto | null> {
    return this.challengesService.getMyParticipation(id, user.id);
  }

  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: ParticipantDto })
  join(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: JwtUser): Promise<ParticipantDto> {
    return this.challengesService.join(id, user.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: ChallengeDto })
  create(@Body() dto: CreateChallengeDto, @CurrentUser() user: JwtUser): Promise<ChallengeDto> {
    return this.challengesService.create(dto, user.id);
  }
}
