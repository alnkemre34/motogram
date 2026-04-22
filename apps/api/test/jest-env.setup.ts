/**
 * Ensures fail-fast env validation passes when running Jest locally without a full .env.
 * CI sets these explicitly; this file is a safety net.
 */
const J32 = '0123456789abcdef0123456789abcdef0123456789'; // 42 chars

if (!process.env.NODE_ENV) process.env.NODE_ENV = 'test';
/** E2E tam yigin: BullMQ media worker test ortaminda acilir (MinIO + Redis). */
if (process.env.E2E_TESTS === '1') {
  process.env.E2E_MEDIA_WORKER = '1';
}
if (!process.env.JWT_ACCESS_SECRET) process.env.JWT_ACCESS_SECRET = J32;
if (!process.env.JWT_REFRESH_SECRET) process.env.JWT_REFRESH_SECRET = J32;
if (!process.env.INTERNAL_API_SHARED_SECRET) process.env.INTERNAL_API_SHARED_SECRET = J32;
if (!process.env.SERVER_HOSTNAME) process.env.SERVER_HOSTNAME = 'api-test-local';
if (!process.env.CORS_ALLOWED_ORIGINS) process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:3000';
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    'postgresql://motogram:motogram_test_password@localhost:5432/motogram_test?schema=public';
}
if (!process.env.REDIS_URL) process.env.REDIS_URL = 'redis://localhost:6379/0';
if (!process.env.MINIO_ENDPOINT) process.env.MINIO_ENDPOINT = 'localhost';
if (!process.env.MINIO_PORT) process.env.MINIO_PORT = '9000';
if (!process.env.MINIO_ACCESS_KEY) process.env.MINIO_ACCESS_KEY = 'minioadmin';
if (!process.env.MINIO_SECRET_KEY) process.env.MINIO_SECRET_KEY = 'minioadmin';
if (!process.env.MINIO_BUCKET) process.env.MINIO_BUCKET = 'motogram-media';
if (process.env.MINIO_USE_SSL === undefined) process.env.MINIO_USE_SSL = 'false';
