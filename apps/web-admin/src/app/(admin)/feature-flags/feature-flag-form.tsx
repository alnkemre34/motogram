'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import {
  FeatureFlagKeySchema,
  FeatureFlagStrategyEnum,
  type UpsertFeatureFlagDto,
} from '@motogram/shared';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { adminApi } from '@/lib/api-client';

const FeatureFlagFormSchema = z
  .object({
    key: FeatureFlagKeySchema,
    strategy: FeatureFlagStrategyEnum,
    percentage: z.coerce.number().int().min(0).max(100).optional(),
    userIdsCsv: z.string().optional(),
    description: z.union([z.string().max(500), z.literal('')]).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.strategy === 'PERCENTAGE') {
      if (val.percentage === undefined || Number.isNaN(val.percentage)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'PERCENTAGE icin yuzde (0-100) girin',
          path: ['percentage'],
        });
      }
    }
    if (val.strategy === 'USER_LIST') {
      const ids =
        val.userIdsCsv?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
      if (ids.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'En az bir kullanici UUID girin (virgulle ayirin)',
          path: ['userIdsCsv'],
        });
        return;
      }
      if (ids.length > 1000) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'En fazla 1000 kullanici',
          path: ['userIdsCsv'],
        });
        return;
      }
      const parsed = z.array(z.string().uuid()).safeParse(ids);
      if (!parsed.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Tum degerler gecerli UUID olmali',
          path: ['userIdsCsv'],
        });
      }
    }
  });

type FeatureFlagFormValues = z.infer<typeof FeatureFlagFormSchema>;

function toUpsertDto(values: FeatureFlagFormValues): UpsertFeatureFlagDto {
  const userIds =
    values.strategy === 'USER_LIST'
      ? (values.userIdsCsv ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
  return {
    key: values.key,
    strategy: values.strategy,
    percentage: values.strategy === 'PERCENTAGE' ? values.percentage : undefined,
    userIds,
    description: values.description?.trim() ? values.description.trim() : undefined,
  };
}

export function FeatureFlagForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FeatureFlagFormValues>({
    resolver: zodResolver(FeatureFlagFormSchema),
    defaultValues: {
      key: '',
      strategy: 'OFF',
      percentage: 0,
      userIdsCsv: '',
      description: '',
    },
    mode: 'onTouched',
  });

  const strategy = watch('strategy');

  const upsert = useMutation({
    mutationFn: async (dto: UpsertFeatureFlagDto) => adminApi.upsertFeatureFlag(dto),
    onSuccess: () => {
      reset();
      router.refresh();
    },
  });

  return (
    <form
      onSubmit={handleSubmit((values) => upsert.mutate(toUpsertDto(values)))}
      className="card grid grid-cols-1 gap-3 md:grid-cols-6"
    >
      <div className="md:col-span-2">
        <label className="mb-1 block text-xs text-textMuted">Flag Key</label>
        <input className="input" placeholder="story_sharing_enabled" {...register('key')} />
        {errors.key && (
          <p className="mt-1 text-xs text-accentDanger">{errors.key.message}</p>
        )}
      </div>
      <div>
        <label className="mb-1 block text-xs text-textMuted">Strateji</label>
        <select className="input" {...register('strategy')}>
          <option value="OFF">OFF</option>
          <option value="ON">ON</option>
          <option value="PERCENTAGE">PERCENTAGE</option>
          <option value="USER_LIST">USER_LIST</option>
        </select>
      </div>
      {strategy === 'PERCENTAGE' && (
        <div>
          <label className="mb-1 block text-xs text-textMuted">Yuzde (0-100)</label>
          <input className="input" type="number" min={0} max={100} {...register('percentage')} />
          {errors.percentage && (
            <p className="mt-1 text-xs text-accentDanger">{errors.percentage.message}</p>
          )}
        </div>
      )}
      {strategy === 'USER_LIST' && (
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs text-textMuted">User ID&apos;ler (virgul ile)</label>
          <input className="input" {...register('userIdsCsv')} />
          {errors.userIdsCsv && (
            <p className="mt-1 text-xs text-accentDanger">{errors.userIdsCsv.message}</p>
          )}
        </div>
      )}
      <div className="md:col-span-2">
        <label className="mb-1 block text-xs text-textMuted">Aciklama</label>
        <input className="input" {...register('description')} />
        {errors.description && (
          <p className="mt-1 text-xs text-accentDanger">{errors.description.message}</p>
        )}
      </div>
      <div className="flex items-end">
        <button type="submit" className="btn-primary w-full" disabled={upsert.isPending}>
          {upsert.isPending ? 'Kaydediliyor...' : 'Kaydet / Guncelle'}
        </button>
      </div>
    </form>
  );
}
