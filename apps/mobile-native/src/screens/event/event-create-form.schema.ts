import { CreateEventSchema, EventVisibilityEnum } from '@motogram/shared';
import { z } from 'zod';

/** Etkinlik olustur ekrani — `CreateEventDto` icin `CreateEventSchema.parse` oncesi UI alanlari. */
export const EventCreateFormSchema = z
  .object({
    title: CreateEventSchema.shape.title,
    description: z.string().max(5000),
    meetingPointName: z.string(),
    meetingPointLat: z.union([z.number(), z.null()]),
    meetingPointLng: z.union([z.number(), z.null()]),
    startTimeIso: z.string().refine((s) => !Number.isNaN(Date.parse(s)), { message: 'invalid_datetime' }),
    visibility: EventVisibilityEnum,
    coHostIds: z.array(z.string().uuid()).default([]),
  })
  .superRefine((val, ctx) => {
    if (val.meetingPointLat === null || val.meetingPointLng === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'meeting_point_required', path: ['meetingPointLat'] });
    }
  });

export type EventCreateFormValues = z.infer<typeof EventCreateFormSchema>;

