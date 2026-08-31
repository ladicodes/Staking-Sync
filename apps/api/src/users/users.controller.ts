import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { PublicUser } from './dto/public-user.dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  @ApiOkResponse({ type: PublicUser })
  findOne(@Param('id', new ParseUUIDPipe()) id: string): Promise<PublicUser> {
    return this.usersService.findPublicById(id);
  }
}
