import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardEntryDto } from './dto/leaderboard-entry.dto';

@ApiTags('leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  @ApiOkResponse({ type: [LeaderboardEntryDto] })
  getLeaderboard(): Promise<LeaderboardEntryDto[]> {
    return this.leaderboardService.getLeaderboard();
  }
}
