import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  FinalizeMediaUploadSchema,
  InitiateMediaUploadResponseSchema,
  InitiateMediaUploadSchema,
  MediaAssetDtoSchema,
  type FinalizeMediaUploadDto,
  type InitiateMediaUploadDto,
} from '@motogram/shared';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { ZodResponse } from '../../common/interceptors/zod-serializer.interceptor';
import { ZodBody } from '../../common/pipes/zod-body.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MediaService } from './media.service';

// Spec 3.4.2 + 7.3.4 - Medya upload flow.
// 1) POST /v1/media/uploads -> presigned PUT URL
// 2) Client MinIO'ya direkt upload
// 3) POST /v1/media/uploads/:id/finalize -> Sharp kuyrugu tetikler
// 4) GET /v1/media/:id -> durumu/urls (Presigned 1 saat).

@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly service: MediaService) {}

  @Post('uploads')
  @ZodResponse(InitiateMediaUploadResponseSchema)
  async initiate(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBody(InitiateMediaUploadSchema)) dto: InitiateMediaUploadDto,
  ) {
    return this.service.initiateUpload(user.userId, dto);
  }

  @Post('uploads/finalize')
  @HttpCode(200)
  @ZodResponse(MediaAssetDtoSchema)
  async finalize(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBody(FinalizeMediaUploadSchema)) dto: FinalizeMediaUploadDto,
  ) {
    return this.service.finalizeUpload(user.userId, dto.assetId);
  }

  @Get(':id')
  @ZodResponse(MediaAssetDtoSchema)
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.getAsset(user.userId, id);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.service.softDelete(user.userId, id);
  }
}
