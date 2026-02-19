import { Body, Controller, Post, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { IsEmail, IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsEnum(['PASSENGER', 'DRIVER', 'ADMIN'] as const)
  role!: 'PASSENGER' | 'DRIVER' | 'ADMIN';

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  city?: string;

  // Admin-only
  @IsOptional()
  @IsString()
  adminSecretKey?: string;

  // Driver-only
  @IsOptional()
  @IsString()
  busType?: string;

  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  experience?: number;

  @IsOptional()
  @IsString()
  depotLocation?: string;
}

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsEnum(['PASSENGER', 'DRIVER', 'ADMIN'] as const)
  role!: 'PASSENGER' | 'DRIVER' | 'ADMIN';
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly jwt: JwtService) {}

  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.auth.register(body);
  }

  @Post('login')
  login(@Body() body: LoginDto) {
    return this.auth.login(body);
  }

  @Post('refresh')
  async refresh(@Body() body: { refreshToken: string }) {
    const refreshJwt = new JwtService({ secret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret' });
    const decoded = await refreshJwt.verifyAsync(body.refreshToken).catch(() => null) as any;
    if (!decoded?.sub) {
      throw new Error('Invalid token');
    }
    return this.auth.refresh(decoded.sub, body.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: any, @Body() body: { refreshToken?: string }) {
    return this.auth.logout(req.user.userId, body.refreshToken);
  }
}
