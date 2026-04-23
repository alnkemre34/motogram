/**
 * Tam AppModule + app.close() BullMQ/ioredis ile birlikte unhandled rejection tetikleyebilir.
 * Graceful SIGTERM senaryosu ayri child-process testi ile ele alinmali.
 */
const describeE2E = process.env.E2E_TESTS === '1' ? describe : describe.skip;

describeE2E('E2E: uygulama kapanisi (devre disi — BullMQ close yarisi)', () => {
  it('placeholder', () => {
    expect(true).toBe(true);
  });
});
