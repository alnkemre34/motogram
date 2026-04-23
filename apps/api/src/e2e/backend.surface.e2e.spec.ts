/**
 * Tam yuzey HTTP E2E: ikinci kullanici + sosyal / icerik / topluluk / etkinlik / mesaj / konum / RBAC.
 * Postgres + Redis + migrate (docker-compose.e2e.yml). `E2E_TESTS=1` + `pnpm run test:e2e`.
 *
 * Admin / internal fanout: backend.ops.e2e.spec.ts.
 */
import { randomUUID } from 'node:crypto';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  AbTestAssignmentClientResponseSchema,
  AccountDeletionStatusSchema,
  ApiErrorSchema,
  CommentListPageResponseSchema,
  CommentRowResponseSchema,
  CommunitiesMineResponseSchema,
  CommunityDetailSchema,
  CommunityJoinHttpResponseSchema,
  ConversationDetailSchema,
  ConversationsListResponseSchema,
  DeviceTokenDtoResponseSchema,
  DevicesListResponseSchema,
  EventDetailSchema,
  EventParticipantsResponseSchema,
  EventRsvpResponseSchema,
  EventsMineResponseSchema,
  FeatureFlagEvaluationSchema,
  FollowActionResponseSchema,
  FollowListPageResponseSchema,
  FollowUnfollowResponseSchema,
  LikeToggleResponseSchema,
  LiveLocationSessionResponseSchema,
  LocationSharingUserResponseSchema,
  MessageListPageResponseSchema,
  MessageSendResponseSchema,
  MotorcycleApiResponseSchema,
  MotorcycleListResponseSchema,
  NearbyCommunitiesResponseSchema,
  NearbyEventsResponseSchema,
  NotificationListPageResponseSchema,
  NotificationUnreadCountResponseSchema,
  PostFeedPageSchema,
  StoryFeedResponseSchema,
  StoryRowResponseSchema,
  SuccessTrueSchema,
  UpdateLocationHttpResponseSchema,
  UserBadgeDtoSchema,
  UserBadgesListResponseSchema,
  UserMeResponseSchema,
  UserPublicApiResponseSchema,
  UserQuestsListResponseSchema,
} from '@motogram/shared';

import { AppModule } from '../app.module';

const describeE2E = process.env.E2E_TESTS === '1' ? describe : describe.skip;

async function bootstrapApp(): Promise<INestApplication> {
  try {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const nest = moduleRef.createNestApplication();
    nest.setGlobalPrefix('v1');
    await nest.init();
    return nest;
  } catch (e: unknown) {
    const text = e instanceof Error ? `${e.name} ${e.message}` : String(e);
    if (text.includes("Can't reach database server") || text.includes('PrismaClientInitializationError')) {
      throw new Error(
        [
          'E2E (surface): PostgreSQL ulasilamiyor.',
          '  pnpm run e2e:stack:up  (repo koku)',
          '  cd apps/api && pnpm run test:e2e:migrate',
        ].join('\n'),
        { cause: e },
      );
    }
    throw e;
  }
}

describeE2E('E2E: HTTP surface (USER rolleri + RBAC)', () => {
  let app: INestApplication;
  let tokenA: string;
  let tokenB: string;
  let userIdA: string;
  let userIdB: string;
  let usernameA: string;
  let usernameB: string;
  const passwordA = 'SurfaceA1!zz';
  const passwordB = 'SurfaceB1!zz';

  let postId: string;
  let commentId: string;
  let storyId: string;
  let motorcycleId: string;
  let communityId: string;
  let eventId: string;
  let conversationId: string;
  const deviceToken = `e2e_device_${randomUUID().replace(/-/g, '')}`;

  beforeAll(async () => {
    app = await bootstrapApp();
    const s1 = Date.now().toString(36);
    const s2 = (Date.now() + 1).toString(36);
    usernameA = `sf_a_${s1}`.slice(0, 30);
    usernameB = `sf_b_${s2}`.slice(0, 30);

    const regA = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email: `sf-a-${s1}@example.com`,
        username: usernameA,
        password: passwordA,
        eulaAccepted: true,
        preferredLanguage: 'tr',
      })
      .expect(201);
    userIdA = regA.body.userId;
    tokenA = regA.body.tokens.accessToken;

    const regB = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email: `sf-b-${s2}@example.com`,
        username: usernameB,
        password: passwordB,
        eulaAccepted: true,
        preferredLanguage: 'tr',
      })
      .expect(201);
    userIdB = regB.body.userId;
    tokenB = regB.body.tokens.accessToken;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it('GET /v1/users/me — UserMeResponseSchema', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/users/me')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    UserMeResponseSchema.parse(res.body);
    expect(res.body.id).toBe(userIdA);
  });

  it('PATCH /v1/users/me — UserPublicApiResponseSchema', async () => {
    const res = await request(app.getHttpServer())
      .patch('/v1/users/me')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'E2E Surface', city: 'Istanbul' })
      .expect(200);
    UserPublicApiResponseSchema.parse(res.body);
    expect(res.body.name).toBe('E2E Surface');
  });

  it('GET /v1/users/:username — UserPublicApiResponseSchema (JWT ile)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/users/${usernameA}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    UserPublicApiResponseSchema.parse(res.body);
    expect(res.body.username).toBe(usernameA);
  });

  it('GET /v1/account/deletion — AccountDeletionStatusSchema', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/account/deletion')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    AccountDeletionStatusSchema.parse(res.body);
  });

  it('POST/GET/DELETE /v1/devices — push cihaz kaydi', async () => {
    const postRes = await request(app.getHttpServer())
      .post('/v1/devices')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ token: deviceToken, platform: 'EXPO', appVersion: '1.0.0-e2e' })
      .expect(200);
    DeviceTokenDtoResponseSchema.parse(postRes.body);

    const listRes = await request(app.getHttpServer())
      .get('/v1/devices')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    DevicesListResponseSchema.parse(listRes.body);

    await request(app.getHttpServer())
      .delete(`/v1/devices/${encodeURIComponent(deviceToken)}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(204);
  });

  it('motorcycles — CRUD + MotorcycleListResponseSchema', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/v1/motorcycles')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        brand: 'Yamaha',
        model: 'MT-07',
        year: 2020,
        photos: ['https://example.com/bike.jpg'],
        isPrimary: true,
      })
      .expect(201);
    const bike = MotorcycleApiResponseSchema.parse(createRes.body);
    motorcycleId = bike.id;

    const listRes = await request(app.getHttpServer())
      .get('/v1/motorcycles/me')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    MotorcycleListResponseSchema.parse(listRes.body);

    const patchRes = await request(app.getHttpServer())
      .patch(`/v1/motorcycles/${motorcycleId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nickname: 'E2E' })
      .expect(200);
    MotorcycleApiResponseSchema.parse(patchRes.body);

    const delRes = await request(app.getHttpServer())
      .delete(`/v1/motorcycles/${motorcycleId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    SuccessTrueSchema.parse(delRes.body);
  });

  it('posts + comments + likes — sema zinciri', async () => {
    const postRes = await request(app.getHttpServer())
      .post('/v1/posts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        caption: 'surface',
        mediaUrls: ['https://example.com/surface.jpg'],
        mediaType: 'IMAGE',
        hashtags: [],
        mentionedUserIds: [],
      })
      .expect(201);
    postId = postRes.body.id;

    const userPosts = await request(app.getHttpServer())
      .get(`/v1/posts/user/${userIdA}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    PostFeedPageSchema.parse(userPosts.body);

    const likeRes = await request(app.getHttpServer())
      .post(`/v1/likes/${postId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(201);
    LikeToggleResponseSchema.parse(likeRes.body);

    const commentRes = await request(app.getHttpServer())
      .post('/v1/comments')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ postId, content: 'selam', mentionedUserIds: [] })
      .expect(201);
    const row = CommentRowResponseSchema.parse(commentRes.body);
    commentId = row.id;

    const listRes = await request(app.getHttpServer())
      .get(`/v1/comments/post/${postId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    CommentListPageResponseSchema.parse(listRes.body);

    const patchComment = await request(app.getHttpServer())
      .patch(`/v1/comments/${commentId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ content: 'selam guncel' })
      .expect(200);
    CommentRowResponseSchema.parse(patchComment.body);

    const unlikeRes = await request(app.getHttpServer())
      .delete(`/v1/likes/${postId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    LikeToggleResponseSchema.parse(unlikeRes.body);

    const delComment = await request(app.getHttpServer())
      .delete(`/v1/comments/${commentId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    SuccessTrueSchema.parse(delComment.body);
  });

  it('stories — olustur, feed, view', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/v1/stories')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        mediaUrl: 'https://example.com/story.jpg',
        mediaType: 'IMAGE',
        caption: 'e2e',
      })
      .expect(201);
    const story = StoryRowResponseSchema.parse(createRes.body);
    storyId = story.id;

    const feedRes = await request(app.getHttpServer())
      .get('/v1/stories/feed')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    StoryFeedResponseSchema.parse(feedRes.body);

    const viewRes = await request(app.getHttpServer())
      .post(`/v1/stories/${storyId}/views`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(201);
    SuccessTrueSchema.parse(viewRes.body);
  });

  it('notifications — liste + unread', async () => {
    const listRes = await request(app.getHttpServer())
      .get('/v1/notifications')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const page = NotificationListPageResponseSchema.parse(listRes.body);

    const unreadRes = await request(app.getHttpServer())
      .get('/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    NotificationUnreadCountResponseSchema.parse(unreadRes.body);

    if (page.items.length > 0) {
      const markRes = await request(app.getHttpServer())
        .post('/v1/notifications/mark-read')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ notificationIds: [page.items[0]!.id] })
        .expect(201);
      SuccessTrueSchema.parse(markRes.body);
    }
  });

  it('gamification — rozetler + gorevler', async () => {
    const badgesRes = await request(app.getHttpServer())
      .get('/v1/gamification/badges')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const badges = UserBadgesListResponseSchema.parse(badgesRes.body);

    const questsRes = await request(app.getHttpServer())
      .get('/v1/gamification/quests')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    UserQuestsListResponseSchema.parse(questsRes.body);

    if (badges.badges.length > 0) {
      const bid = badges.badges[0]!.badge.id;
      const showRes = await request(app.getHttpServer())
        .post('/v1/gamification/badges/showcase')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ badgeId: bid, showcased: true })
        .expect(200);
      UserBadgeDtoSchema.parse(showRes.body);
    }
  });

  it('GET /v1/feature-flags/evaluate — FeatureFlagEvaluationSchema', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/feature-flags/evaluate')
      .query({ key: 'map_clustering_enabled' })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    FeatureFlagEvaluationSchema.parse(res.body);
  });

  it('RBAC — USER ile admin uclari 403 + ApiErrorSchema', async () => {
    const ab = await request(app.getHttpServer())
      .get('/v1/ab-tests')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(403);
    ApiErrorSchema.parse(ab.body);

    const flags = await request(app.getHttpServer())
      .get('/v1/feature-flags')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(403);
    ApiErrorSchema.parse(flags.body);
  });

  it('GET /v1/ab-tests/:key/assignment — yoksa 404 (Redis konfig yok)', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/ab-tests/e2e_missing_key/assignment')
      .set('Authorization', `Bearer ${tokenA}`);
    if (res.status === 200) {
      AbTestAssignmentClientResponseSchema.parse(res.body);
    } else {
      expect(res.status).toBe(404);
      ApiErrorSchema.parse(res.body);
    }
  });

  it('communities — olustur, mine, nearby, detay, B katilir, B ayrilir', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/v1/communities')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: `E2E Comm ${Date.now()}`,
        description: 'surface',
        visibility: 'PUBLIC',
      })
      .expect(201);
    const detail = CommunityDetailSchema.parse(createRes.body);
    communityId = detail.id;

    const mineRes = await request(app.getHttpServer())
      .get('/v1/communities/me')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    CommunitiesMineResponseSchema.parse(mineRes.body);

    const nearbyRes = await request(app.getHttpServer())
      .get('/v1/communities/nearby')
      .query({ lat: '41.0082', lng: '28.9784', limit: '20' })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    NearbyCommunitiesResponseSchema.parse(nearbyRes.body);

    const getRes = await request(app.getHttpServer())
      .get(`/v1/communities/${communityId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    CommunityDetailSchema.parse(getRes.body);

    const joinRes = await request(app.getHttpServer())
      .post(`/v1/communities/${communityId}/join`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({})
      .expect(200);
    CommunityJoinHttpResponseSchema.parse(joinRes.body);

    await request(app.getHttpServer())
      .delete(`/v1/communities/${communityId}/leave`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(204);
  });

  it('events — olustur, mine, nearby, detay, katilimci, RSVP, sil', async () => {
    const start = new Date(Date.now() + 86_400_000).toISOString();
    const createRes = await request(app.getHttpServer())
      .post('/v1/events')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'E2E Ride',
        meetingPointLat: 41.0082,
        meetingPointLng: 28.9784,
        meetingPointName: 'Sultanahmet',
        startTime: start,
        visibility: 'PUBLIC',
      })
      .expect(201);
    const ev = EventDetailSchema.parse(createRes.body);
    eventId = ev.id;

    const mineRes = await request(app.getHttpServer())
      .get('/v1/events/me')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    EventsMineResponseSchema.parse(mineRes.body);

    const nearbyRes = await request(app.getHttpServer())
      .get('/v1/events/nearby')
      .query({ lat: '41.0082', lng: '28.9784', limit: '10' })
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    NearbyEventsResponseSchema.parse(nearbyRes.body);

    const detailRes = await request(app.getHttpServer())
      .get(`/v1/events/${eventId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    EventDetailSchema.parse(detailRes.body);

    const partRes = await request(app.getHttpServer())
      .get(`/v1/events/${eventId}/participants`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    EventParticipantsResponseSchema.parse(partRes.body);

    const rsvpRes = await request(app.getHttpServer())
      .post(`/v1/events/${eventId}/rsvp`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ status: 'GOING' })
      .expect(200);
    EventRsvpResponseSchema.parse(rsvpRes.body);

    await request(app.getHttpServer())
      .delete(`/v1/events/${eventId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(204);
  });

  it('messaging — DM olustur, mesaj gonder, listele', async () => {
    const convRes = await request(app.getHttpServer())
      .post('/v1/conversations')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ type: 'DIRECT', userIds: [userIdB] })
      .expect(200);
    const conv = ConversationDetailSchema.parse(convRes.body);
    conversationId = conv.id;

    const listA = await request(app.getHttpServer())
      .get('/v1/conversations')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    ConversationsListResponseSchema.parse(listA.body);

    const clientId = randomUUID();
    const sendRes = await request(app.getHttpServer())
      .post(`/v1/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ clientId, messageType: 'TEXT', content: 'merhaba e2e' })
      .expect(201);
    MessageSendResponseSchema.parse(sendRes.body);

    const msgs = await request(app.getHttpServer())
      .get(`/v1/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    MessageListPageResponseSchema.parse(msgs.body);
  });

  it('follows — A, B yi takip et / takipten cik', async () => {
    const followRes = await request(app.getHttpServer())
      .post(`/v1/follows/${userIdB}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(201);
    FollowActionResponseSchema.parse(followRes.body);

    const unfollowRes = await request(app.getHttpServer())
      .delete(`/v1/follows/${userIdB}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    FollowUnfollowResponseSchema.parse(unfollowRes.body);
  });

  it('B-09 — GET users/me/following ve :userId/followers (FollowListPageResponseSchema)', async () => {
    await request(app.getHttpServer())
      .post(`/v1/follows/${userIdB}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(201);

    const mineFollowing = await request(app.getHttpServer())
      .get('/v1/users/me/following')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    FollowListPageResponseSchema.parse(mineFollowing.body);
    const bRow = mineFollowing.body.items.find((u: { id: string }) => u.id === userIdB);
    expect(bRow).toBeDefined();
    expect(bRow.isFollowedByMe).toBe(true);

    const bFollowers = await request(app.getHttpServer())
      .get(`/v1/users/${userIdB}/followers`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    FollowListPageResponseSchema.parse(bFollowers.body);
    expect(bFollowers.body.items.some((u: { id: string }) => u.id === userIdA)).toBe(true);

    await request(app.getHttpServer())
      .delete(`/v1/follows/${userIdB}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
  });

  it('location — session start/stop, sharing, tek konum pingi', async () => {
    const sessionRes = await request(app.getHttpServer())
      .post('/v1/location/session/start')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({})
      .expect(200);
    LiveLocationSessionResponseSchema.parse(sessionRes.body);

    const locRes = await request(app.getHttpServer())
      .put('/v1/location/update')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        lat: 41.0082,
        lng: 28.9784,
        clientTimestamp: Date.now(),
        city: 'Istanbul',
      })
      .expect(200);
    UpdateLocationHttpResponseSchema.parse(locRes.body);

    const shareRes = await request(app.getHttpServer())
      .put('/v1/location/sharing')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ mode: 'FOLLOWERS_ONLY' })
      .expect(200);
    LocationSharingUserResponseSchema.parse(shareRes.body);

    await request(app.getHttpServer())
      .post('/v1/location/session/stop')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(204);
  });

  it('temizlik — post sil', async () => {
    await request(app.getHttpServer())
      .delete(`/v1/posts/${postId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
  });
});
