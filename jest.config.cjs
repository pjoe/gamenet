/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/src/gamenet/test/setup_node_webrtc.ts"],
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.spec.ts"],
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "<rootDir>/tsconfig.test.json",
      },
    ],
  },
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
};
