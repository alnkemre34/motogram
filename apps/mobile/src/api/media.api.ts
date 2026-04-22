import type { InitiateMediaUploadDto } from '@motogram/shared';
import {
  InitiateMediaUploadResponseSchema,
  MediaAssetDtoSchema,
} from '@motogram/shared';

import { apiRequest } from '../lib/api-client';

// Spec 3.4 + 7.3.4 - Medya pipeline API.

export async function initiateMediaUpload(dto: InitiateMediaUploadDto) {
  return apiRequest('/media/uploads', InitiateMediaUploadResponseSchema, { method: 'POST', body: dto });
}

export async function finalizeMediaUpload(assetId: string) {
  return apiRequest('/media/uploads/finalize', MediaAssetDtoSchema, {
    method: 'POST',
    body: { assetId },
  });
}

export async function getMediaAsset(id: string) {
  return apiRequest(`/media/${id}`, MediaAssetDtoSchema);
}

export async function deleteMediaAsset(id: string): Promise<void> {
  await apiRequest<void>(`/media/${id}`, { method: 'DELETE' });
}

// Spec 3.4.3 - Direkt MinIO'ya presigned PUT ile yukle.
export async function uploadToPresignedUrl(
  url: string,
  body: Blob | ArrayBuffer | Uint8Array,
  contentType: string,
): Promise<void> {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: body as BodyInit,
  });
  if (!res.ok) {
    throw new Error(`upload_failed status=${res.status}`);
  }
}
