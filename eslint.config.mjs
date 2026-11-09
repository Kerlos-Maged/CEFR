import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Disable ESLint rules that conflict with Prettier formatting.
  prettier,
  {
    rules: {
      // Enforce the no-comments-by-default convention is not lintable;
      // keep a small set of catch-all quality rules here as the project grows.
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    // Media components build Supabase responsive `srcset` URLs by hand, so the
    // next/image optimizer is intentionally not used.
    files: ["components/media/**/*.tsx"],
    rules: { "@next/next/no-img-element": "off" },
  },
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Project artifacts:
    "coverage/**",
    "node_modules/**",
    "supabase/**",
  ]),
]);

export default eslintConfig;
