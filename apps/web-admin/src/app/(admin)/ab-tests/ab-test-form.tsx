'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { UpsertAbTestSchema, type UpsertAbTestDto } from '@motogram/shared';
import { useRouter } from 'next/navigation';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import type { z } from 'zod';

import { adminApi } from '@/lib/api-client';

type AbTestFormInput = z.input<typeof UpsertAbTestSchema>;

const defaultVariants: AbTestFormInput['variants'] = [
  { id: 'A', weight: 50 },
  { id: 'B', weight: 50 },
];

const defaultForm: AbTestFormInput = {
  key: '',
  description: '',
  enabled: true,
  variants: defaultVariants,
};

export function AbTestForm() {
  const router = useRouter();
  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<AbTestFormInput>({
    resolver: zodResolver(UpsertAbTestSchema),
    defaultValues: defaultForm,
    mode: 'onTouched',
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'variants',
  });

  const variants = watch('variants');
  const totalWeight = variants.reduce((a, v) => a + (typeof v.weight === 'number' ? v.weight : 0), 0);

  const upsert = useMutation({
    mutationFn: async (data: UpsertAbTestDto) => adminApi.upsertAbTest(data),
    onSuccess: () => {
      reset(defaultForm);
      router.refresh();
    },
  });

  return (
    <form
      onSubmit={handleSubmit((data) => upsert.mutate(UpsertAbTestSchema.parse(data)))}
      className="card space-y-3"
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs text-textMuted">Test Key (snake_case)</label>
          <input className="input" placeholder="nav_new_home_v2" {...register('key')} />
          {errors.key && (
            <p className="mt-1 text-xs text-accentDanger">{errors.key.message}</p>
          )}
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs text-textMuted">Aciklama</label>
          <input className="input" {...register('description')} />
          {errors.description && (
            <p className="mt-1 text-xs text-accentDanger">{errors.description.message}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input type="checkbox" id="ab-enabled" {...register('enabled')} />
        <label htmlFor="ab-enabled" className="text-sm">
          Aktif
        </label>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs uppercase text-textMuted">Varyantlar (ID: UPPER_SNAKE_CASE)</span>
          <span className="text-xs text-textMuted">
            Toplam:{' '}
            <span className={totalWeight === 100 ? 'text-accentSuccess' : 'text-accentDanger'}>
              {totalWeight}
            </span>
            /100
          </span>
        </div>
        {errors.variants && !Array.isArray(errors.variants) && errors.variants.message && (
          <p className="mb-2 text-xs text-accentDanger">{errors.variants.message}</p>
        )}
        <div className="space-y-2">
          {fields.map((field, i) => {
            const rowErr = errors.variants?.[i];
            const rowMsg = rowErr?.id?.message ?? rowErr?.weight?.message;
            return (
              <div key={field.id}>
                <div className="flex gap-2">
                  <Controller
                    control={control}
                    name={`variants.${i}.id`}
                    render={({ field: f }) => (
                      <input
                        className="input flex-1"
                        placeholder="Variant id (A, B, CONTROL, VARIANT_X)"
                        {...f}
                        onChange={(e) => f.onChange(e.target.value.toUpperCase())}
                      />
                    )}
                  />
                  <input
                    type="number"
                    min={1}
                    max={100}
                    className="input w-28"
                    {...register(`variants.${i}.weight`, { valueAsNumber: true })}
                  />
                  <button
                    type="button"
                    className="rounded bg-accentDanger/20 px-3 text-xs text-accentDanger hover:bg-accentDanger/30"
                    onClick={() => remove(i)}
                    disabled={fields.length <= 2}
                  >
                    Sil
                  </button>
                </div>
                {rowMsg && (
                  <p className="mt-1 text-xs text-accentDanger">
                    Varyant {i + 1}: {rowMsg}
                  </p>
                )}
              </div>
            );
          })}
          <button
            type="button"
            className="rounded border border-border px-3 py-1 text-xs text-textMuted hover:bg-surfaceHover"
            onClick={() => append({ id: '', weight: 1 })}
            disabled={fields.length >= 6}
          >
            + Varyant Ekle
          </button>
        </div>
      </div>

      <button type="submit" className="btn-primary" disabled={upsert.isPending}>
        {upsert.isPending ? 'Kaydediliyor...' : 'Kaydet / Guncelle'}
      </button>
    </form>
  );
}
