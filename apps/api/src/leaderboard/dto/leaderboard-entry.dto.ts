import { ApiProperty } from '@nestjs/swagger';

export class LeaderboardEntryDto {
  @ApiProperty() rank: number;
  @ApiProperty() userId: string;
  @ApiProperty() userName: string;
  @ApiProperty({ nullable: true }) userAvatarUrl: string | null;
  @ApiProperty() totalEarned: number;
  @ApiProperty() currentStreak: number;
  @ApiProperty() challengesCompleted: number;
}
