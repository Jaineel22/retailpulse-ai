module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/env.setup.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['**/tests/**/*.test.js'],
  verbose: true,
  clearMocks: true,
  testTimeout: 30000,
  forceExit: true,
};
