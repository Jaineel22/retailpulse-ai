const geminiClient = require('../src/utils/geminiClient');

describe('geminiClient', () => {
  it('fails gracefully with a 503 ApiError when GEMINI_API_KEY is not configured', async () => {
    // tests/env.setup.js never sets GEMINI_API_KEY, so env.geminiApiKey is ''
    // here — exactly the "missing configuration" case this must not crash on.
    await expect(geminiClient.askGemini('any prompt')).rejects.toMatchObject({
      statusCode: 503,
      message: expect.stringMatching(/not configured/i),
    });
  });
});
