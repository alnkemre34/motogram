import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ErrorCodes } from '@motogram/shared';
import { ZodError, ZodSchema } from 'zod';

// Body-specific Zod validation. Controller'da:
//   @Body(new ZodBody(CreatePostSchema)) dto: CreatePostDto

@Injectable()
export class ZodBody<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    try {
      return this.schema.parse(value);
    } catch (err) {
      if (err instanceof ZodError) {
        throw new BadRequestException({
          error: 'validation_failed',
          code: ErrorCodes.VALIDATION_FAILED,
          details: err.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
            code: i.code,
          })),
        });
      }
      throw err;
    }
  }
}
