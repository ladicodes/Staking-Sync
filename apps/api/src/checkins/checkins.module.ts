import { Module } from '@nestjs/common';
import { VerificationModule } from '../verification/verification.module';
import { CheckInsController } from './checkins.controller';
import { CheckInsService } from './checkins.service';

@Module({
  imports: [VerificationModule],
  controllers: [CheckInsController],
  providers: [CheckInsService],
  exports: [CheckInsService]
})
export class CheckInsModule {}
