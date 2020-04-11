// For a detailed explanation regarding each configuration property, visit:
// https://jestjs.io/docs/en/configuration.html

module.exports = {
  modulePaths: ["<rootDir>/src", "<rootDir>/tests"],

  moduleNameMapper: {
    "^jest$": "<rootDir>/tests/jest.js",
    "^index.js$": "<rootDir>/src/index.js",
  },

  // Automatically clear mock calls and instances between every test
  clearMocks: true,

  // The directory where Jest should output its coverage files
  coverageDirectory: "coverage",

  globalSetup: "<rootDir>/tests/globalsetup.js",

  // A list of paths to directories that Jest should use to search for files in
  roots: ["<rootDir>"],

  runner: "jest-serial-runner",

  // The test environment that will be used for testing
  testEnvironment: "node",

  // The glob patterns Jest uses to detect test files
  testMatch: [
    "**/__tests__/**/*.[jt]s?(x)",
    "**/?(*.)+(spec|test).[tj]s?(x)",
    "**/?(*.)+(ispec|test).[tj]s?(x)",
  ],
};
