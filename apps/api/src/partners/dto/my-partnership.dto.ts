import { ApiProperty } from '@nestjs/swagger';
import { PartnershipDto } from './partnership.dto';

export class MyPartnershipDto {
  @ApiProperty({ type: PartnershipDto }) partnership: PartnershipDto;
  @ApiProperty() otherUserId: string;
  @ApiProperty() otherUserName: string;
  @ApiProperty({ nullable: true }) otherUserAvatarUrl: string | null;
  @ApiProperty({ enum: ['A', 'B'] }) mySide: 'A' | 'B';
  @ApiProperty() myStakeRemaining: number;
  @ApiProperty() otherStakeRemaining: number;
  @ApiProperty() isRequester: boolean;
  @ApiProperty() myCheckedInToday: boolean;
  @ApiProperty() otherCheckedInToday: boolean;
}
