import { useMutation, useQueryClient } from '@tanstack/react-query';

import { likePost, unlikePost } from '../api/likes.api';
import type { FeedPage } from '../api/posts.api';
import { captureException } from '../lib/sentry';

import { applyOptimisticLike } from './optimistic';

// Spec 7.1.1 / .cursorrules madde 5 - OPTIMISTIK UI ZORUNLU
// Network istegi gonderilmeden UI guncellenir; hata olursa geri alinir.

interface LikeVariables {
  postId: string;
  currentlyLiked: boolean;
}

interface Snapshot {
  previous: FeedPage | undefined;
}

export function useLikePost() {
  const queryClient = useQueryClient();

  return useMutation<{ liked: boolean; likesCount: number }, Error, LikeVariables, Snapshot>({
    mutationFn: async ({ postId, currentlyLiked }) => {
      return currentlyLiked ? unlikePost(postId) : likePost(postId);
    },
    onMutate: async ({ postId, currentlyLiked }) => {
      await queryClient.cancelQueries({ queryKey: ['feed'] });

      const previous = queryClient.getQueryData<FeedPage>(['feed']);

      if (previous) {
        queryClient.setQueryData<FeedPage>(
          ['feed'],
          applyOptimisticLike(previous, postId, currentlyLiked),
        );
      }

      return { previous };
    },
    onError: (err, _vars, snapshot) => {
      if (snapshot?.previous) {
        queryClient.setQueryData(['feed'], snapshot.previous);
      }
      captureException(err);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}
