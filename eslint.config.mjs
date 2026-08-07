import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  globalIgnores([
    ".next/**",
    ".expo/**",
    ".tools/**",
    "out/**",
    "build/**",
    "dist-test/**",
    "dist-test-sdk54/**",
    "src/generated/prisma/**",
    "next-env.d.ts",
  ]),
]);
