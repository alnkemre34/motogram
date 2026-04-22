import { Body, Controller, Delete, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import {
  AccountDeletionStatusSchema,
  RequestAccountDeletionSchema,
  type RequestAccountDeletionDto,
} from '@motogram/shared';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { ZodResponse } from '../../common/interceptors/zod-serializer.interceptor';
import { ZodBody } from '../../common/pipes/zod-body.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccountService } from './account.service';

// Spec 5.2 + 8.11.4 - Hesap silme istek endpointleri.

@Controller('account')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(private readonly service: AccountService) {}

  @Get('deletion')
  @ZodResponse(AccountDeletionStatusSchema)
  async status(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getStatus(user.userId);
  }

  @Post('deletion')
  @HttpCode(200)
  @ZodResponse(AccountDeletionStatusSchema)
  async request(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBody(RequestAccountDeletionSchema)) dto: RequestAccountDeletionDto,
  ) {
    return this.service.requestDeletion(user.userId, dto);
  }

  @Delete('deletion')
  @HttpCode(200)
  @ZodResponse(AccountDeletionStatusSchema)
  async cancel(@CurrentUser() user: AuthenticatedUser) {
    return this.service.cancelDeletion(user.userId);
  }
}
