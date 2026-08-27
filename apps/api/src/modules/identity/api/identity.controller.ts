import { Body, Controller, Get, Post } from '@nestjs/common';
import { IdentityService } from '../application/identity.service';
import { LoginDto, RegisterUserDto } from './identity.dto';

@Controller('auth')
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Get('providers')
  providers() {
    return this.identity.getAuthProviders();
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
