module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  transformIgnorePatterns: ["^.+\\.js$"],
  testPathIgnorePatterns: ["<rootDir>/dist"],
  globalSetup: "./tests/globalsetup.ts",
  globalTeardown: "./tests/globalteardown.ts",
};
