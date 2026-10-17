import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

/** Test unitari della logica dell'app (niente database né browser) */
export default createJestConfig({
  testEnvironment: "node",
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
  testMatch: ["<rootDir>/src/**/*.test.ts"],
});
