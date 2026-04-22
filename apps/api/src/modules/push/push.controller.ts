import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import {
  DeviceTokenDtoResponseSchema,
  DevicesListResponseSchema,
  RegisterDeviceTokenSchema,
  type RegisterDeviceTokenDto,
} from '@motogram/shared';

import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ZodResponse } from '../../common/interceptors/zod-serializer.interceptor';
import { ZodBody } from '../../common/pipes/zod-body.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PushService } from './push.service';

// Spec 9.3 - Push Notification token kayit ve yonetim.
// Mobile tarafinda soft prompt (Faz 1 Adim 24) sonrasi bu endpoint cagrilir.

@Controller('devices')
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(private readonly push: PushService) {}

  @Post()
  @HttpCode(200)
  @ZodResponse(DeviceTokenDtoResponseSchema)
  async register(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBody(RegisterDeviceTokenSchema)) dto: RegisterDeviceTokenDto,
  ) {
    return this.push.registerToken(user.userId, dto);
  }

  @Get()
  @ZodResponse(DevicesListResponseSchema)
  async list(@CurrentUser() user: AuthenticatedUser) {
    return { devices: await this.push.listUserDevices(user.userId) };
  }

  @Delete(':token')
  @HttpCode(204)
  async revoke(
    @CurrentUser() user: AuthenticatedUser,
    @Param('token') token: string,
  ) {
    await this.push.revokeToken(user.userId, token);
  }
}
