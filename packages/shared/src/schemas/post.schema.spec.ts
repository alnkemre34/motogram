import { CreatePostSchema, PostFeedQuerySchema } from './post.schema';

// Spec 7.3.6 - Post zod semasi validate edilir

describe('CreatePostSchema (Spec 7.3.6)', () => {
  const base = {
    mediaUrls: ['https://cdn.motogram.test/a.jpg'],
    mediaType: 'IMAGE' as const,
  };

  it('accepts a minimal valid post', () => {
    expect(CreatePostSchema.safeParse(base).success).toBe(true);
  });

  it('requires at least one media url', () => {
    const res = CreatePostSchema.safeParse({ ...base, mediaUrls: [] });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0]!.message).toBe('media_required');
    }
  });

  it('caps media at 10', () => {
    const urls = Array.from({ length: 11 }, (_, i) => `https://cdn.test/${i}.jpg`);
    const res = CreatePostSchema.safeParse({ ...base, mediaUrls: urls });
    expect(res.success).toBe(false);
  });

  it('rejects invalid latitude/longitude bounds', () => {
    expect(
      CreatePostSchema.safeParse({ ...base, latitude: 91, longitude: 0 }).success,
    ).toBe(false);
    expect(
      CreatePostSchema.safeParse({ ...base, latitude: 0, longitude: 181 }).success,
    ).toBe(false);
  });

  it('caps caption at 2200 chars', () => {
    const res = CreatePostSchema.safeParse({ ...base, caption: 'x'.repeat(2201) });
    expect(res.success).toBe(false);
  });
});

describe('PostFeedQuerySchema', () => {
  it('defaults limit to 20 when absent', () => {
    const res = PostFeedQuerySchema.safeParse({});
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.limit).toBe(20);
    }
  });

  it('caps limit at 50', () => {
    expect(PostFeedQuerySchema.safeParse({ limit: 51 }).success).toBe(false);
  });

  it('coerces string query param to number', () => {
    const res = PostFeedQuerySchema.safeParse({ limit: '10' });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.limit).toBe(10);
    }
  });
});
