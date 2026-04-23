import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ErrorCodes,
  type CreateEmergencyContactDto,
  type EmergencyContactRowDto,
} from '@motogram/shared';

import { PrismaService } from '../prisma/prisma.service';

const MAX_CONTACTS = 5;

@Injectable()
export class EmergencyContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<{ contacts: EmergencyContactRowDto[] }> {
    const rows = await this.prisma.emergencyContact.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return {
      contacts: rows.map((r) => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
        relationship: r.relationship ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  async create(userId: string, dto: CreateEmergencyContactDto): Promise<EmergencyContactRowDto> {
    const count = await this.prisma.emergencyContact.count({ where: { userId } });
    if (count >= MAX_CONTACTS) {
      throw new BadRequestException({
        error: 'emergency_contacts_limit',
        code: ErrorCodes.VALIDATION_FAILED,
      });
    }
    const row = await this.prisma.emergencyContact.create({
      data: {
        userId,
        name: dto.name.trim(),
        phone: dto.phone.trim(),
        relationship: dto.relationship?.trim() ?? null,
      },
    });
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      relationship: row.relationship ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async remove(userId: string, contactId: string): Promise<void> {
    const row = await this.prisma.emergencyContact.findFirst({
      where: { id: contactId, userId },
    });
    if (!row) {
      throw new NotFoundException({ error: 'contact_not_found', code: ErrorCodes.NOT_FOUND });
    }
    await this.prisma.emergencyContact.delete({ where: { id: contactId } });
  }
}
