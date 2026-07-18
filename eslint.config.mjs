import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // ແອັບມືຖື (Expo/React Native) — ມີກົດເກນ ແລະ tsconfig ຂອງຕົນເອງ
    "mobile/**",
    // Local agent worktrees are separate checkouts and must not be linted twice.
    ".claude/**",
  ]),
]);

export default eslintConfig;
