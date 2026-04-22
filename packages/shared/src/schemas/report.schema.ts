import { z } from 'zod';

import { ReportStatusEnum, ReportTargetTypeEnum } from '../enums';

// Spec 7.2.2 - Icerik Raporlama (USER / POST / COMMENT / MESSAGE / GROUP / EVENT)

export const CreateReportSchema = z.object({
  targetType: ReportTargetTypeEnum,
  targetId: z.string().min(1),
  reason: z.string().trim().min(2).max(100),
  description: z.string().max(2000).optional(),
});
export type CreateReportDto = z.infer<typeof CreateReportSchema>;

export const ReportDtoSchema = z.object({
  id: z.string().uuid(),
  reporterId: z.string().uuid(),
  targetType: ReportTargetTypeEnum,
  targetId: z.string(),
  reason: z.string(),
  description: z.string().nullable().optional(),
  status: ReportStatusEnum,
  createdAt: z.string(),
});
export type ReportDto = z.infer<typeof ReportDtoSchema>;
