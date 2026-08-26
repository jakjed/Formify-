import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { IdentityService } from '../application/identity.service';
import { LoginDto, RegisterUserDto } from './identity.dto';

@Controller('auth')
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Get('providers')
  providers(@Query('tenantId') tenantId?: string) {
    return this.identity.getAuthProviders(tenantId);
  }

  @Post('register')
  register(@Body() dto: RegisterUserDto) {
    return this.identity.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.identity.login(dto);
  }
}
