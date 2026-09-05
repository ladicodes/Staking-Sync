import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtUser } from '../auth/types/jwt-user.type';
import { UsersService } from './users.service';
import { PublicUser } from './dto/public-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: PublicUser })
  updateProfile(@Body() dto: UpdateProfileDto, @CurrentUser() user: JwtUser): Promise<PublicUser> {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Get(':id')
  @ApiOkResponse({ type: PublicUser })
  findOne(@Param('id', new ParseUUIDPipe()) id: string): Promise<PublicUser> {
    return this.usersService.findPublicById(id);
  }
}
