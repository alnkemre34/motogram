import {
  NotificationPreferencesSchema,
  UpdateNotificationPreferencesSchema,
} from './notification.schema';

describe('notification.schema (B-14)', () => {
  it('NotificationPreferencesSchema parses full object', () => {
    const v = NotificationPreferencesSchema.parse({
      pushFollow: true,
      pushLike: false,
      pushComment: true,
      pushMention: true,
      pushParty: true,
      pushEmergency: true,
      pushCommunity: true,
      pushEvent: true,
      emailDigest: false,
    });
    expect(v.pushLike).toBe(false);
  });

  it('UpdateNotificationPreferencesSchema allows partial', () => {
    const v = UpdateNotificationPreferencesSchema.parse({ pushLike: false });
    expect(v.pushLike).toBe(false);
  });
});
