import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ErrorCodes,
  GamificationTriggerPayloadSchema,
  type CreateMotorcycleDto,
  type UpdateMotorcycleDto,
} from '@motogram/shared';

import { ZodEventBus } from '../../common/events/zod-event-bus.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MotorcyclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: ZodEventBus,
  ) {}

  async listForUser(userId: string) {
    return this.prisma.motorcycle.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(userId: string, dto: CreateMotorcycleDto) {
    // Eger isPrimary true ise onceki primary'yi dusur
    if (dto.isPrimary) {
      await this.prisma.motorcycle.updateMany({
        where: { userId, isPrimary: true, deletedAt: null },
        data: { isPrimary: false },
      });
    }
    const bike = await this.prisma.motorcycle.create({
      data: { ...dto, userId },
    });
    // Spec 3.6 - BIKE_ADDED trigger
    this.events.emit('gamification.trigger', GamificationTriggerPayloadSchema, {
      userId,
      trigger: 'BIKE_ADDED',
      increment: 1,
      metadata: { motorcycleId: bike.id },
    });
    return bike;
  }

  async update(userId: string, id: string, dto: UpdateMotorcycleDto) {
    const bike = await this.prisma.motorcycle.findUnique({ where: { id } });
    if (!bike || bike.deletedAt) {
      throw new NotFoundException({ error: 'motorcycle_not_found', code: ErrorCodes.NOT_FOUND });
    }
    if (bike.userId !== userId) {
      throw new ForbiddenException({ error: 'forbidden', code: ErrorCodes.FORBIDDEN });
    }

    if (dto.isPrimary) {
      await this.prisma.motorcycle.updateMany({
        where: { userId, isPrimary: true, deletedAt: null, NOT: { id } },
        data: { isPrimary: false },
      });
    }

    return this.prisma.motorcycle.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string): Promise<void> {
    const bike = await this.prisma.motorcycle.findUnique({ where: { id } });
    if (!bike || bike.deletedAt) {
      throw new NotFoundException({ error: 'motorcycle_not_found', code: ErrorCodes.NOT_FOUND });
    }
    if (bike.userId !== userId) {
      throw new ForbiddenException({ error: 'forbidden', code: ErrorCodes.FORBIDDEN });
    }
    // Spec 8.11.4 - Soft delete
    await this.prisma.motorcycle.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
