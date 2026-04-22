import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ErrorCodes } from '@motogram/shared';
import { ZodError, ZodSchema } from 'zod';

// Spec 7.3.6 - Zod validation pipe (NestJS DTO yerine Zod sema)
// Spec 9.4 - Standart hata formati: { error, code, details }

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const schema = this.extractSchema(metadata);
    if (!schema) {
      return value;
    }

    try {
      return schema.parse(value);
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

  private extractSchema(metadata: ArgumentMetadata): ZodSchema | null {
    const metatype = metadata.metatype as unknown as { zodSchema?: ZodSchema } | undefined;
    return metatype?.zodSchema ?? null;
  }
}
