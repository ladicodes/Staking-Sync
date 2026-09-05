import { Module } from '@nestjs/common';
import { LeetCodeChecker } from './checkers/leetcode.checker';
import { VerificationService } from './verification.service';

@Module({
  providers: [LeetCodeChecker, VerificationService],
  exports: [VerificationService]
})
export class VerificationModule {}
