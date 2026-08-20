process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret-key-for-jest-suite';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
