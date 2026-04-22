import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ErrorCodes,
  type CreateCommentDto,
  type UpdateCommentDto,
} from '@motogram/shared';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateCommentDto) {
    const post = await this.prisma.post.findFirst({
      where: { id: dto.postId, deletedAt: null },
      select: { id: true },
    });
    if (!post) {
      throw new NotFoundException({ error: 'post_not_found', code: ErrorCodes.NOT_FOUND });
    }

    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.comment.create({
        data: {
          postId: dto.postId,
          userId,
          content: dto.content,
          mentionedUserIds: dto.mentionedUserIds,
        },
      });
      await tx.post.update({
        where: { id: dto.postId },
        data: { commentsCount: { increment: 1 } },
      });
      return comment;
    });
  }

  async listForPost(postId: string, cursor?: string, limit = 20) {
    const include = {
      user: {
        select: { id: true, username: true, avatarUrl: true, isVerified: true },
      },
    } as const;
    const comments = cursor
      ? await this.prisma.comment.findMany({
          where: { postId, deletedAt: null },
          orderBy: { createdAt: 'asc' },
          take: limit,
          cursor: { id: cursor },
          skip: 1,
          include,
        })
      : await this.prisma.comment.findMany({
          where: { postId, deletedAt: null },
          orderBy: { createdAt: 'asc' },
          take: limit,
          include,
        });
    return {
      items: comments,
      nextCursor: comments.length === limit ? comments[comments.length - 1]!.id : null,
    };
  }

  async update(userId: string, id: string, dto: UpdateCommentDto) {
    const c = await this.prisma.comment.findUnique({ where: { id } });
    if (!c || c.deletedAt) {
      throw new NotFoundException({ error: 'comment_not_found', code: ErrorCodes.NOT_FOUND });
    }
    if (c.userId !== userId) {
      throw new ForbiddenException({ error: 'forbidden', code: ErrorCodes.FORBIDDEN });
    }
    return this.prisma.comment.update({ where: { id }, data: { content: dto.content } });
  }

  async remove(userId: string, id: string): Promise<void> {
    const c = await this.prisma.comment.findUnique({ where: { id } });
    if (!c || c.deletedAt) {
      throw new NotFoundException({ error: 'comment_not_found', code: ErrorCodes.NOT_FOUND });
    }
    if (c.userId !== userId) {
      throw new ForbiddenException({ error: 'forbidden', code: ErrorCodes.FORBIDDEN });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.comment.update({ where: { id }, data: { deletedAt: new Date() } });
      await tx.post.update({
        where: { id: c.postId },
        data: { commentsCount: { decrement: 1 } },
      });
    });
  }
}
