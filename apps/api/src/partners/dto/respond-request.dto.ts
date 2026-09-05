import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class RespondRequestDto {
  @ApiProperty()
  @IsBoolean()
  accept: boolean;
}
