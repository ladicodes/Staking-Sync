import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtUser } from '../auth/types/jwt-user.type';
import { WalletService } from './wallet.service';
import { AmountDto } from './dto/amount.dto';
import { WalletDto } from './dto/wallet.dto';
import { TransactionDto } from './dto/transaction.dto';

@ApiTags('wallet')
@Controller('wallet')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @ApiOkResponse({ type: WalletDto })
  getWallet(@CurrentUser() user: JwtUser): Promise<WalletDto> {
    return this.walletService.getWallet(user.id);
  }

  @Get('transactions')
  @ApiOkResponse({ type: [TransactionDto] })
  listTransactions(@CurrentUser() user: JwtUser): Promise<TransactionDto[]> {
    return this.walletService.listTransactions(user.id);
  }

  @Post('deposit')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: WalletDto })
  deposit(@Body() dto: AmountDto, @CurrentUser() user: JwtUser): Promise<WalletDto> {
    return this.walletService.deposit(user.id, dto.amount);
  }

  @Post('withdraw')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: WalletDto })
  withdraw(@Body() dto: AmountDto, @CurrentUser() user: JwtUser): Promise<WalletDto> {
    return this.walletService.withdraw(user.id, dto.amount);
  }
}
