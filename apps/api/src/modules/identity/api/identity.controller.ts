import { Body, Controller, Get, Post } from '@nestjs/common';
import { IdentityService } from '../application/identity.service';
import { LoginDto, RegisterUserDto } from './identity.dto';
import { Public } from '../../../common/public.decorator';
import { CurrentUser } from '../../../common/current-user.decorator';
import type { RequestUser } from '../domain/identity.types';

@Controller('auth')
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Public()
  @Get('providers')
  providers() {
    return this.identity.getAuthProviders();
  }

  @Public()
  @Post('register')
  register(@Body() dto: RegisterUserDto) {
    return this.identity.register(dto);
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.identity.login(dto);
  }

  @Get('me')
  me(@CurrentUser() user: RequestUser) {
    return user;
  }
}
