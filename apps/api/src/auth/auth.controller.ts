import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiResponse } from '../common/interfaces/api-response.interface';
import { PublicUser } from '../users/dto/public-user.dto';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthResponse } from './types/auth-response.type';
import { JwtUser } from './types/jwt-user.type';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiBody({ type: RegisterDto })
  @ApiCreatedResponse({ description: 'User registered successfully' })
  async register(@Body() dto: RegisterDto): Promise<ApiResponse<AuthResponse>> {
    return {
      success: true,
      message: 'User registered successfully',
      data: await this.authService.register(dto)
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ description: 'User logged in successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  async login(@Body() dto: LoginDto): Promise<ApiResponse<AuthResponse>> {
    return {
      success: true,
      message: 'User logged in successfully',
      data: await this.authService.login(dto)
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiBody({ type: RefreshTokenDto })
  @ApiOkResponse({ description: 'Tokens refreshed successfully' })
  async refresh(@Body() dto: RefreshTokenDto): Promise<ApiResponse<AuthResponse>> {
    return {
      success: true,
      message: 'Tokens refreshed successfully',
      data: await this.authService.refresh(dto.refreshToken)
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: LogoutDto })
  @ApiOkResponse({ description: 'User logged out successfully' })
  async logout(@Body() dto: LogoutDto): Promise<ApiResponse<{ loggedOut: boolean }>> {
    return {
      success: true,
      message: 'User logged out successfully',
      data: await this.authService.logout(dto.refreshToken)
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: PublicUser })
  async me(@CurrentUser() user: JwtUser): Promise<ApiResponse<PublicUser>> {
    return {
      success: true,
      message: 'Current user retrieved successfully',
      data: await this.authService.getMe(user)
    };
  }
}
