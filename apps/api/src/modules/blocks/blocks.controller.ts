import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { BlockDtoSchema, BlocksListResponseSchema } from '@motogram/shared';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { ZodResponse } from '../../common/interceptors/zod-serializer.interceptor';

import { BlocksService } from './blocks.service';

@Controller('blocks')
export class BlocksController {
  constructor(private readonly blocks: BlocksService) {}

  @Get()
  @ZodResponse(BlocksListResponseSchema)
  async list(@CurrentUser() user: AuthenticatedUser) {
    return this.blocks.listInitiated(user.userId);
  }

  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Post(':userId')
  @ZodResponse(BlockDtoSchema)
  async block(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) targetId: string,
  ) {
    return this.blocks.blockUser(user.userId, targetId);
  }

  @Delete(':userId')
  @HttpCode(204)
  async unblock(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) targetId: string,
  ) {
    await this.blocks.unblockUser(user.userId, targetId);
  }
}
