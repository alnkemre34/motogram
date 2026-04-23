import { CreateReportSchema, ReportDtoSchema } from './report.schema';

describe('report.schema (B-11)', () => {
  const valid = {
    targetType: 'USER' as const,
    targetId: '550e8400-e29b-41d4-a716-446655440000',
    reason: 'abuse',
  };

  it('CreateReportSchema parses happy path', () => {
    expect(CreateReportSchema.parse(valid)).toEqual(valid);
  });

  it('CreateReportSchema rejects short reason', () => {
    expect(() =>
      CreateReportSchema.parse({ ...valid, reason: 'x' }),
    ).toThrow();
  });

  it('ReportDtoSchema parses response shape', () => {
    const row = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      reporterId: '550e8400-e29b-41d4-a716-446655440002',
      targetType: 'POST' as const,
      targetId: '550e8400-e29b-41d4-a716-446655440003',
      reason: 'spam',
      description: null,
      status: 'PENDING' as const,
      createdAt: '2026-04-01T12:00:00.000Z',
    };
    ReportDtoSchema.parse(row);
  });
});
