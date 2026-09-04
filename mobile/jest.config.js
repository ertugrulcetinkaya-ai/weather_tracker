module.exports = {
  preset: 'jest-expo',
  clearMocks: true,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts?(x)'],
  collectCoverageFrom: [
    'src/api/**/*.ts',
    'src/hooks/**/*.ts',
    'src/storage/**/*.ts',
    'src/components/**/*.ts',
    'src/components/**/*.tsx',
    'src/weather/**/*.ts',
    '!src/api/config.ts',
    '!src/**/__tests__/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
};
