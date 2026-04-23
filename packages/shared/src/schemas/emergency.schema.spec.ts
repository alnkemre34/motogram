import {
  CreateEmergencyContactSchema,
  EmergencyContactsListResponseSchema,
} from './emergency.schema';

describe('emergency.schema (B-15 contacts)', () => {
  it('CreateEmergencyContactSchema accepts E.164 phone', () => {
    const v = CreateEmergencyContactSchema.parse({
      name: 'Ali',
      phone: '+905551234567',
      relationship: 'friend',
    });
    expect(v.phone).toBe('+905551234567');
  });

  it('EmergencyContactsListResponseSchema parses list', () => {
    const row = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'A',
      phone: '+905551111111',
      relationship: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const p = EmergencyContactsListResponseSchema.parse({ contacts: [row] });
    expect(p.contacts).toHaveLength(1);
  });
});
