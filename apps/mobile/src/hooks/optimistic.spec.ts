import { applyOptimisticLike, type FeedLikeShape } from './optimistic';

// Spec 7.1.1 - Optimistik UI cache guncellemesi spec'e uygun davranmalidir:
// 1) Begenme: count +1 (varsayilan basarili)
// 2) Begeniyi kaldirma: count -1 (min 0)
// 3) Diger post'lar etkilenmez
// 4) Orijinal veri mutasyona ugramaz (referans degisir)

describe('applyOptimisticLike (Spec 7.1.1)', () => {
  const base: FeedLikeShape = {
    nextCursor: null,
    items: [
      { id: 'p1', likesCount: 3, likedByMe: false },
      { id: 'p2', likesCount: 10, likedByMe: true },
      { id: 'p3', likesCount: 0, likedByMe: false },
    ],
  };

  it('increments likesCount by 1 on like (currentlyLiked=false)', () => {
    const updated = applyOptimisticLike(base, 'p1', false);
    const p1 = updated.items.find((p) => p.id === 'p1')!;
    expect(p1.likesCount).toBe(4);
    expect(p1.likedByMe).toBe(true);
  });

  it('decrements likesCount by 1 on unlike (currentlyLiked=true)', () => {
    const updated = applyOptimisticLike(base, 'p2', true);
    const p2 = updated.items.find((p) => p.id === 'p2')!;
    expect(p2.likesCount).toBe(9);
    expect(p2.likedByMe).toBe(false);
  });

  it('never goes below 0 on unlike', () => {
    const updated = applyOptimisticLike(base, 'p3', true);
    expect(updated.items.find((p) => p.id === 'p3')!.likesCount).toBe(0);
  });

  it('does not mutate other posts', () => {
    const updated = applyOptimisticLike(base, 'p1', false);
    expect(updated.items.find((p) => p.id === 'p2')!.likesCount).toBe(10);
    expect(updated.items.find((p) => p.id === 'p3')!.likesCount).toBe(0);
  });

  it('does not mutate original (referential immutability)', () => {
    const updated = applyOptimisticLike(base, 'p1', false);
    expect(updated).not.toBe(base);
    expect(updated.items).not.toBe(base.items);
    expect(base.items[0]!.likesCount).toBe(3);
  });

  it('no-op for unknown postId (feed unchanged in values)', () => {
    const updated = applyOptimisticLike(base, 'missing', false);
    expect(updated.items.map((p) => p.likesCount)).toEqual([3, 10, 0]);
  });
});
