import { ApiProperty } from '@nestjs/swagger';
import { ChallengeCategory, ChallengeVisibility, ProofType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength
} from 'class-validator';

export class CreateChallengeDto {
  @ApiProperty({ example: '30-Day LeetCode Streak', maxLength: 160 })
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title: string;

  @ApiProperty({ required: false, example: 'One problem a day, every day, for 30 days.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ enum: ChallengeCategory })
  @IsEnum(ChallengeCategory)
  category: ChallengeCategory;

  @ApiProperty({ enum: ProofType, default: ProofType.MANUAL })
  @IsEnum(ProofType)
  proofType: ProofType;

  @ApiProperty({ enum: ChallengeVisibility, default: ChallengeVisibility.PUBLIC })
  @IsEnum(ChallengeVisibility)
  visibility: ChallengeVisibility;

  @ApiProperty({ example: 30, minimum: 1, maximum: 365 })
  @IsInt()
  @Min(1)
  @Max(365)
  durationDays: number;

  @ApiProperty({ example: 2, minimum: 0, maximum: 30, required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  graceDays?: number;

  @ApiProperty({ example: 0, minimum: 0, maximum: 100, required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  dailyPenaltyPercentage?: number;

  @ApiProperty({ example: 50 })
  @IsNumber()
  @IsPositive()
  stakeAmount: number;

  @ApiProperty({ example: '2026-09-10T00:00:00.000Z' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ required: false, minimum: 2 })
  @IsOptional()
  @IsInt()
  @Min(2)
  maximumParticipants?: number;
}
