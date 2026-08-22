describe('config/env — CORS resolution', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    // Required regardless of NODE_ENV for this suite — unrelated to what's under test here.
    process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/env-test-placeholder';
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  function loadEnv() {
    // eslint-disable-next-line global-require
    return require('../src/config/env');
  }

  it('defaults to permissive (true) in development when CORS_ORIGIN is unset', () => {
    process.env.NODE_ENV = 'development';
    // Empty string, not delete: dotenv.config() (called inside config/env.js)
    // only fills in keys that are entirely absent from process.env, and a
    // real backend/.env may exist locally for dev — deleting the key would
    // let dotenv silently refill it from that file, defeating this test.
    process.env.CORS_ORIGIN = '';
    expect(loadEnv().corsOrigin).toBe(true);
  });

  it('fails closed (false) in production when CORS_ORIGIN is unset, rather than allowing all origins', () => {
    process.env.NODE_ENV = 'production';
    // Empty string, not delete: dotenv.config() (called inside config/env.js)
    // only fills in keys that are entirely absent from process.env, and a
    // real backend/.env may exist locally for dev — deleting the key would
    // let dotenv silently refill it from that file, defeating this test.
    process.env.CORS_ORIGIN = '';
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    expect(loadEnv().corsOrigin).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/CORS_ORIGIN is not set in production/));

    warnSpy.mockRestore();
  });

  it('honors an explicit CORS_ORIGIN allowlist in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGIN = 'https://app.example.com, https://admin.example.com';
    expect(loadEnv().corsOrigin).toEqual(['https://app.example.com', 'https://admin.example.com']);
  });
});
