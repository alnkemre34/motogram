import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as MinioClient } from 'minio';

// Spec 3.4.1 + 3.4.3 - MinIO baglantisi + bucket bootstrap.
// Testlerde mocklanabilmesi icin ince bir wrapper olarak yazilmistir.

export interface MinioWrapper {
  ensureBucket(bucket: string): Promise<void>;
  presignedPutObject(bucket: string, objectKey: string, expiresSeconds: number): Promise<string>;
  presignedGetObject(bucket: string, objectKey: string, expiresSeconds: number): Promise<string>;
  putObject(bucket: string, objectKey: string, buffer: Buffer, mimeType: string): Promise<void>;
  getObject(bucket: string, objectKey: string): Promise<Buffer>;
  removeObject(bucket: string, objectKey: string): Promise<void>;
  removeObjects(bucket: string, objectKeys: string[]): Promise<void>;
  removePrefix(bucket: string, prefix: string): Promise<number>;
}

@Injectable()
export class MinioService implements MinioWrapper, OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private readonly client: MinioClient;
  readonly defaultBucket: string;
  readonly publicEndpoint: string;

  constructor(config: ConfigService) {
    const endpoint = config.get<string>('MINIO_ENDPOINT', 'localhost');
    const portRaw = config.get<string>('MINIO_PORT', '9000');
    const useSSL = config.get<string>('MINIO_USE_SSL', 'false') === 'true';
    const accessKey = config.get<string>('MINIO_ACCESS_KEY', 'minioadmin');
    const secretKey = config.get<string>('MINIO_SECRET_KEY', 'minioadmin');

    this.defaultBucket = config.get<string>('MINIO_BUCKET', 'motogram-media');
    this.publicEndpoint = config.get<string>(
      'MINIO_PUBLIC_ENDPOINT',
      `${useSSL ? 'https' : 'http'}://${endpoint}:${portRaw}`,
    );

    this.client = new MinioClient({
      endPoint: endpoint,
      port: Number(portRaw),
      useSSL,
      accessKey,
      secretKey,
    });
  }

  async onModuleInit(): Promise<void> {
    // Spec 3.4.3 - Bucket private + klasor hiyerarsisi Sharp servisinde tutulur.
    try {
      await this.ensureBucket(this.defaultBucket);
    } catch (err) {
      // MinIO baglantisi dev ortaminda olmayabilir. Log + devam (unit testler icin sorun degil).
      this.logger.warn(
        `minio_bootstrap_skipped bucket=${this.defaultBucket} err=${(err as Error).message}`,
      );
    }
  }

  async ensureBucket(bucket: string): Promise<void> {
    const exists = await this.client.bucketExists(bucket).catch(() => false);
    if (!exists) {
      await this.client.makeBucket(bucket, 'us-east-1');
      this.logger.log(`minio_bucket_created bucket=${bucket}`);
    }
  }

  async presignedPutObject(
    bucket: string,
    objectKey: string,
    expiresSeconds: number,
  ): Promise<string> {
    return this.client.presignedPutObject(bucket, objectKey, expiresSeconds);
  }

  async presignedGetObject(
    bucket: string,
    objectKey: string,
    expiresSeconds: number,
  ): Promise<string> {
    return this.client.presignedGetObject(bucket, objectKey, expiresSeconds);
  }

  async putObject(
    bucket: string,
    objectKey: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<void> {
    await this.client.putObject(bucket, objectKey, buffer, buffer.length, {
      'Content-Type': mimeType,
    });
  }

  async getObject(bucket: string, objectKey: string): Promise<Buffer> {
    const stream = await this.client.getObject(bucket, objectKey);
    const chunks: Buffer[] = [];
    for await (const chunk of stream as AsyncIterable<Buffer>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async removeObject(bucket: string, objectKey: string): Promise<void> {
    await this.client.removeObject(bucket, objectKey);
  }

  async removeObjects(bucket: string, objectKeys: string[]): Promise<void> {
    if (objectKeys.length === 0) return;
    await this.client.removeObjects(bucket, objectKeys);
  }

  async removePrefix(bucket: string, prefix: string): Promise<number> {
    const keys: string[] = [];
    const stream = this.client.listObjectsV2(bucket, prefix, true);
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (obj) => {
        if (obj.name) keys.push(obj.name);
      });
      stream.on('end', () => resolve());
      stream.on('error', (err) => reject(err));
    });
    if (keys.length === 0) return 0;
    await this.client.removeObjects(bucket, keys);
    return keys.length;
  }
}
