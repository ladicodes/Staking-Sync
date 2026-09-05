import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsUUID } from 'class-validator';

export class SendRequestDto {
  @ApiProperty()
  @IsUUID()
  toUserId: string;

  @ApiProperty({ example: 15 })
  @IsNumber()
  @IsPositive()
  stakeAmount: number;
}
