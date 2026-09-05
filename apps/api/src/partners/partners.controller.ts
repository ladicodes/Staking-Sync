import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtUser } from '../auth/types/jwt-user.type';
import { PartnersService } from './partners.service';
import { SendRequestDto } from './dto/send-request.dto';
import { RespondRequestDto } from './dto/respond-request.dto';
import { PartnerDirectoryEntryDto } from './dto/directory-entry.dto';
import { MyPartnershipDto } from './dto/my-partnership.dto';
import { PartnershipDto } from './dto/partnership.dto';

@ApiTags('partners')
@Controller('partners')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  @Get('directory')
  @ApiOkResponse({ type: [PartnerDirectoryEntryDto] })
  listDirectory(@CurrentUser() user: JwtUser): Promise<PartnerDirectoryEntryDto[]> {
    return this.partnersService.listDirectory(user.id);
  }

  @Get('me')
  @ApiOkResponse({ type: MyPartnershipDto })
  getMyPartnership(@CurrentUser() user: JwtUser): Promise<MyPartnershipDto | null> {
    return this.partnersService.getMyPartnership(user.id);
  }

  @Post('request')
  @ApiOkResponse({ type: PartnershipDto })
  sendRequest(@Body() dto: SendRequestDto, @CurrentUser() user: JwtUser) {
    return this.partnersService.sendRequest(user.id, dto.toUserId, dto.stakeAmount);
  }

  @Post(':id/respond')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: PartnershipDto })
  respondToRequest(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RespondRequestDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.partnersService.respondToRequest(id, user.id, dto.accept);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancelRequest(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: JwtUser): Promise<void> {
    return this.partnersService.cancelRequest(id, user.id);
  }

  @Post(':id/checkin')
  @HttpCode(HttpStatus.OK)
  submitCheckIn(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: JwtUser): Promise<void> {
    return this.partnersService.submitCheckIn(id, user.id);
  }

  @Get(':id/checkin/today')
  getTodayCheckIn(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: JwtUser) {
    return this.partnersService.getTodayCheckIn(id, user.id);
  }

  @Post(':id/end')
  @HttpCode(HttpStatus.OK)
  endPartnership(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: JwtUser): Promise<void> {
    return this.partnersService.endPartnership(id, user.id);
  }
}
