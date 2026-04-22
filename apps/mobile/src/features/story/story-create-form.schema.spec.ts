import { StoryCreateFormSchema } from './story-create-form.schema';

describe('StoryCreateFormSchema (R6)', () => {
  it('allows empty caption', () => {
    expect(StoryCreateFormSchema.safeParse({ caption: '' }).success).toBe(true);
  });

  it('rejects caption over 200 chars', () => {
    const r = StoryCreateFormSchema.safeParse({ caption: 'x'.repeat(201) });
    expect(r.success).toBe(false);
  });

  it('accepts max length caption', () => {
    const r = StoryCreateFormSchema.safeParse({ caption: 'x'.repeat(200) });
    expect(r.success).toBe(true);
  });
});
