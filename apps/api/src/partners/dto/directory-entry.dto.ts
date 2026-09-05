import { ApiProperty } from '@nestjs/swagger';

export class PartnerDirectoryEntryDto {
  @ApiProperty() userId: string;
  @ApiProperty() userName: string;
  @ApiProperty({ nullable: true }) userAvatarUrl: string | null;
  @ApiProperty() currentStreak: number;
}
