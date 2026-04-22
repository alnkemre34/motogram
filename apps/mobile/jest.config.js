/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts', '**/*.spec.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@sentry/react-native$': '<rootDir>/src/__mocks__/sentry.ts',
    '^expo-linking$': '<rootDir>/src/__mocks__/expo-linking.ts',
    '^expo-haptics$': '<rootDir>/src/__mocks__/expo-haptics.ts',
  },
};
