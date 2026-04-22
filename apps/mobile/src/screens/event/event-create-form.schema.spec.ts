import { EventCreateFormSchema } from './event-create-form.schema';

describe('EventCreateFormSchema (R6)', () => {
  const base = {
    title: 'Pazar Turu',
    description: '',
    meetingPointName: 'Kadikoy',
    meetingPointLat: 41.0 as number | null,
    meetingPointLng: 29.0 as number | null,
    startTimeIso: new Date(Date.now() + 86400000).toISOString(),
    visibility: 'PUBLIC' as const,
    coHostIds: [] as string[],
  };

  it('accepts valid form', () => {
    expect(EventCreateFormSchema.safeParse(base).success).toBe(true);
  });

  it('rejects null meeting coordinates', () => {
    const r = EventCreateFormSchema.safeParse({
      ...base,
      meetingPointLat: null,
      meetingPointLng: null,
    });
    expect(r.success).toBe(false);
  });

  it('rejects short title', () => {
    const r = EventCreateFormSchema.safeParse({ ...base, title: 'ab' });
    expect(r.success).toBe(false);
  });

  it('rejects invalid start time string', () => {
    const r = EventCreateFormSchema.safeParse({ ...base, startTimeIso: 'not-a-date' });
    expect(r.success).toBe(false);
  });
});
