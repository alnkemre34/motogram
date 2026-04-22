import { z } from 'zod';

/**
 * Gecici: tum HTTP JSON cevaplari kabul eder (runtime'da kisitlamaz).
 * Faz I sonrasi endpoint bazli sikı semalara daraltin.
 */
export const AnyHttpResponseSchema = z.unknown();
