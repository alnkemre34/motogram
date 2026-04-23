import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCodes } from '@motogram/shared';

import { FollowsService } from '../follows/follows.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BlocksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly follows: FollowsService,
  ) {}

  async listInitiated(initiatorId: string) {
    const rows = await this.prisma.block.findMany({
      where: { initiatorId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, targetId: true, createdAt: true },
    });
    return { items: rows };
  }

  /**
   * Viewer ile blok ilişkisi olan tüm karşı kullanıcı id’leri (feed / profil postları için).
   * Spec 7.2.2 — iki yön.
   */
  async peersBlockedEitherWay(viewerId: string): Promise<string[]> {
    const rows = await this.prisma.block.findMany({
      where: { OR: [{ initiatorId: viewerId }, { targetId: viewerId }] },
      select: { initiatorId: true, targetId: true },
    });
    const ids = new Set<string>();
    for (const r of rows) {
      ids.add(r.initiatorId === viewerId ? r.targetId : r.initiatorId);
    }
    return [...ids];
  }

  async blockUser(initiatorId: string, targetId: string) {
    if (initiatorId === targetId) {
      throw new BadRequestException({
        error: 'cannot_block_self',
        code: ErrorCodes.VALIDATION_FAILED,
      });
    }

    const target = await this.prisma.user.findFirst({
      where: { id: targetId, deletedAt: null, isBanned: false },
      select: { id: true },
    });
    if (!target) {
      throw new NotFoundException({ error: 'user_not_found', code: ErrorCodes.NOT_FOUND });
    }

    await this.follows.unfollow(initiatorId, targetId);
    await this.follows.unfollow(targetId, initiatorId);

    const row = await this.prisma.block.upsert({
      where: { initiatorId_targetId: { initiatorId, targetId } },
      create: { initiatorId, targetId },
      update: {},
      select: { targetId: true, createdAt: true },
    });
    return { targetId: row.targetId, createdAt: row.createdAt };
  }

  async unblockUser(initiatorId: string, targetId: string): Promise<void> {
    await this.prisma.block.deleteMany({
      where: { initiatorId, targetId },
    });
  }
}
