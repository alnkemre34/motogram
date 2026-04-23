import { P7_OVERLAY_MAX, capOverlayQueue } from './p7-overlay-queue';

describe('capOverlayQueue', () => {
  it('appends under max', () => {
    const a = [1, 2];
    expect(capOverlayQueue(a, 3, P7_OVERLAY_MAX)).toEqual([1, 2, 3]);
  });

  it('drops oldest when over max', () => {
    const base = [1, 2, 3, 4, 5];
    expect(capOverlayQueue(base, 6, 5)).toEqual([2, 3, 4, 5, 6]);
  });
});
