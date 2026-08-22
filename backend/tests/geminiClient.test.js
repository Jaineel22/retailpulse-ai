describe('geminiClient', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('fails gracefully with a 503 ApiError when GEMINI_API_KEY is not configured', async () => {
    // Empty string, not delete: dotenv.config() (called inside config/env.js)
    // only fills in keys entirely absent from process.env, and a real
    // backend/.env with a real key may exist locally for dev — deleting the
    // key would let dotenv silently refill it from that file, which would
    // make this test fire an actual network request against the real Gemini
    // API instead of exercising the missing-key path it's meant to test.
    process.env.GEMINI_API_KEY = '';

    // eslint-disable-next-line global-require
    const geminiClient = require('../src/utils/geminiClient');

    await expect(geminiClient.askGemini('any prompt')).rejects.toMatchObject({
      statusCode: 503,
      message: expect.stringMatching(/not configured/i),
    });
  });
});
