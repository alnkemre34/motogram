import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type UseFormProps } from 'react-hook-form';
import type { z, ZodTypeAny } from 'zod';

export function useZodForm<S extends ZodTypeAny>(
  schema: S,
  props?: Omit<UseFormProps<z.infer<S>>, 'resolver'>,
) {
  const { mode, ...rest } = props ?? {};
  return useForm<z.infer<S>>({
    mode: mode ?? 'onTouched',
    ...rest,
    resolver: zodResolver(schema),
  });
}
