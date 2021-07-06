module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  transformIgnorePatterns: ["^.+\\.js$"],
  globalSetup: "./tests/globalsetup.ts",
  globalTeardown: "./tests/globalteardown.ts"
};
