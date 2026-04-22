// Spec 7.1.1 - Optimistik UI icin saf guncelleme fonksiyonu
// Test edilebilirlik icin React/native bagimlilikla ayrilmistir.

// Yerel tip tanimi - native bagimli importlari tetiklememek icin.
export interface FeedLikeShape {
  items: Array<{ id: string; likesCount: number } & Record<string, unknown>>;
  nextCursor: string | null;
}

export function applyOptimisticLike<T extends FeedLikeShape>(
  feed: T,
  postId: string,
  currentlyLiked: boolean,
): T {
  return {
    ...feed,
    items: feed.items.map((p) =>
      p.id === postId
        ? {
            ...p,
            likesCount: currentlyLiked
              ? Math.max(0, p.likesCount - 1)
              : p.likesCount + 1,
          }
        : p,
    ),
  } as T;
}
