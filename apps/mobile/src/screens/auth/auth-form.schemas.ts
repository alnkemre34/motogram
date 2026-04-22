import { PasswordSchema, UsernameSchema } from '@motogram/shared';
import { z } from 'zod';

/** Login ekrani — identifier trim; backend `LoginSchema` ile ayni kurallar. */
export const LoginFormSchema = z.object({
  identifier: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() : v),
    z.string().min(3, 'identifier_required'),
  ),
  password: z.string().min(1, 'password_required'),
});

/** Register ekrani — EULA boolean + `RegisterSchema.parse` ile DTO. */
export const RegisterScreenFormSchema = z
  .object({
    email: z.preprocess(
      (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
      z.string().email('email_invalid'),
    ),
    username: z.preprocess(
      (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
      UsernameSchema,
    ),
    password: PasswordSchema,
    name: z.preprocess(
      (v) => (typeof v === 'string' ? v.trim() : v),
      z.string().max(80),
    ),
    eulaAccepted: z.boolean(),
    preferredLanguage: z.enum(['tr', 'en']),
  })
  .superRefine((val, ctx) => {
    if (!val.eulaAccepted) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'eula_required',
        path: ['eulaAccepted'],
      });
    }
  });

export type LoginFormValues = z.infer<typeof LoginFormSchema>;
export type RegisterScreenFormValues = z.infer<typeof RegisterScreenFormSchema>;
