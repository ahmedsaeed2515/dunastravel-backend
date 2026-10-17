// Global Test Setup for dunastravel-backend Jest test suite
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-32-chars-long-minimum';
process.env.DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5432/dunastravel_test';

// Global mocks or hooks can be added here
