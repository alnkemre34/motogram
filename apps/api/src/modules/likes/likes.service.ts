import { Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCodes } from '@motogram/shared';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LikesService {
  constructor(private readonly prisma: PrismaService) {}

  // Spec 8.7.1 - Begeni: dakikada 60 (controller @Throttle)
  // Spec 7.1.1 - Optimistik UI, backend idempotent calismali (ayni post +ayni user = noop)
  async like(userId: string, postId: string): Promise<{ liked: true; likesCount: number }> {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, deletedAt: null },
      select: { id: true },
    });
    if (!post) {
      throw new NotFoundException({ error: 'post_not_found', code: ErrorCodes.NOT_FOUND });
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.like.findUnique({
        where: { postId_userId: { postId, userId } },
      });
      if (existing) {
        const current = await tx.post.findUnique({
          where: { id: postId },
          select: { likesCount: true },
        });
        return { likesCount: current?.likesCount ?? 0 };
      }
      await tx.like.create({ data: { postId, userId } });
      const updated = await tx.post.update({
        where: { id: postId },
        data: { likesCount: { increment: 1 } },
        select: { likesCount: true },
      });
      return { likesCount: updated.likesCount };
    });

    return { liked: true, likesCount: result.likesCount };
  }

  async unlike(userId: string, postId: string): Promise<{ liked: false; likesCount: number }> {
    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.like.findUnique({
        where: { postId_userId: { postId, userId } },
      });
      if (!existing) {
        const current = await tx.post.findUnique({
          where: { id: postId },
          select: { likesCount: true },
        });
        return { likesCount: current?.likesCount ?? 0 };
      }
      await tx.like.delete({ where: { postId_userId: { postId, userId } } });
      const updated = await tx.post.update({
        where: { id: postId },
        data: { likesCount: { decrement: 1 } },
        select: { likesCount: true },
      });
      return { likesCount: updated.likesCount };
    });

    return { liked: false, likesCount: result.likesCount };
  }
}
