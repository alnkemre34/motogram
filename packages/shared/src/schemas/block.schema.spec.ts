import {
  BlockDtoSchema,
  BlockListItemSchema,
  BlocksListResponseSchema,
  BlockUserParamSchema,
} from './block.schema';

describe('block.schema (B-10)', () => {
  it('BlockUserParamSchema parses uuid', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000';
    expect(BlockUserParamSchema.parse({ userId: id }).userId).toBe(id);
  });

  it('BlockDtoSchema accepts DateLike createdAt', () => {
    const parsed = BlockDtoSchema.parse({
      targetId: '550e8400-e29b-41d4-a716-446655440001',
      createdAt: '2026-04-01T12:00:00.000Z',
    });
    expect(parsed.targetId).toBeTruthy();
  });

  it('BlocksListResponseSchema parses items', () => {
    const row = {
      id: '550e8400-e29b-41d4-a716-446655440002',
      targetId: '550e8400-e29b-41d4-a716-446655440003',
      createdAt: '2026-04-01T00:00:00.000Z',
    };
    BlockListItemSchema.parse(row);
    const page = BlocksListResponseSchema.parse({ items: [row] });
    expect(page.items).toHaveLength(1);
  });
});
