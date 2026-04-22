import { CreateStorySchema } from '@motogram/shared';
import { Controller } from 'react-hook-form';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  finalizeMediaUpload,
  initiateMediaUpload,
  uploadToPresignedUrl,
} from '../../api/media.api';
import { useZodForm } from '../../hooks/useZodForm';
import { apiRequest, ApiClientError } from '../../lib/api-client';

import { StoryCreateFormSchema } from './story-create-form.schema';

// Spec 2.2 + 3.4.3 + 7.3.4 - Story olusturma:
// 1) initiateMediaUpload (MediaAsset kayit + presigned PUT)
// 2) MinIO'ya PUT
// 3) finalizeMediaUpload (Sharp kuyrugu tetikler)
// 4) Story kaydi olustur (24h TTL backend'de set edilir).

interface Asset {
  base64?: string;
  uri: string;
  mimeType: string;
  fileName: string;
  size: number;
}

export function StoryCreateScreen({ asset, onDone }: { asset: Asset; onDone?: () => void }) {
  const [progress, setProgress] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>(
    'idle',
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { control, handleSubmit, formState } = useZodForm(StoryCreateFormSchema, {
    defaultValues: { caption: '' },
  });
  const { errors } = formState;

  const runPublish = handleSubmit(async (form) => {
    setErrorMsg(null);
    try {
      setProgress('uploading');
      const isVideo = asset.mimeType.startsWith('video/');
      const init = await initiateMediaUpload({
        category: isVideo ? 'STORY_VIDEO' : 'STORY_IMAGE',
        filename: asset.fileName,
        mimeType: asset.mimeType,
        sizeBytes: asset.size,
      });

      const body = await fetch(asset.uri).then((r) => r.blob());
      await uploadToPresignedUrl(init.uploadUrl, body, asset.mimeType);

      setProgress('processing');
      const finalized = await finalizeMediaUpload(init.assetId);

      const mediaUrl = finalized.mediumUrl ?? finalized.thumbnailUrl ?? '';
      const storyBody = CreateStorySchema.parse({
        mediaUrl,
        mediaType: isVideo ? 'VIDEO' : 'IMAGE',
        caption: form.caption.trim() || undefined,
      });

      await apiRequest('/stories', {
        method: 'POST',
        body: storyBody,
      });

      setProgress('done');
      onDone?.();
    } catch (err) {
      setProgress('error');
      if (err instanceof ApiClientError) {
        setErrorMsg(err.body?.error ?? 'upload_failed');
      } else {
        setErrorMsg((err as Error).message);
      }
    }
  });

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Story olustur</Text>
      <View style={styles.preview}>
        <Text style={styles.previewText}>
          {asset.fileName} ({Math.round(asset.size / 1024)} KB)
        </Text>
      </View>
      <Controller
        control={control}
        name="caption"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={styles.caption}
            placeholder="Bir aciklama yaz (opsiyonel)"
            placeholderTextColor="#666"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            maxLength={200}
          />
        )}
      />
      {errors.caption?.message ? (
        <Text style={styles.fieldError}>{errors.caption.message}</Text>
      ) : null}

      <Pressable
        style={[styles.btn, progress === 'uploading' && styles.btnBusy]}
        onPress={() => void runPublish()}
        disabled={progress === 'uploading' || progress === 'processing'}
      >
        {progress === 'uploading' || progress === 'processing' ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>Yayinla</Text>
        )}
      </Pressable>
      <Text style={styles.status}>
        {progress === 'uploading'
          ? 'Dosya yukleniyor…'
          : progress === 'processing'
            ? 'Optimize ediliyor…'
            : progress === 'done'
              ? 'Yayinlandi'
              : progress === 'error'
                ? `Hata: ${errorMsg}`
                : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0b0b0d', padding: 16 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 16 },
  preview: {
    aspectRatio: 9 / 16,
    backgroundColor: '#1a1a1e',
    borderRadius: 16,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewText: { color: '#888' },
  caption: {
    backgroundColor: '#1a1a1e',
    color: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  fieldError: { color: '#ff5a5a', marginBottom: 12, fontSize: 12 },
  btn: {
    backgroundColor: '#ff6a00',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnBusy: { opacity: 0.8 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  status: { color: '#aaa', marginTop: 12, textAlign: 'center' },
});
