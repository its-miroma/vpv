import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import { jsdoc } from "eslint-plugin-jsdoc";
import { defineConfig } from "eslint/config";
import ts from "typescript-eslint";

export default defineConfig(
  { ignores: ["eslint.config.js"] },
  js.configs.recommended,
  ts.configs.strictTypeChecked,
  ts.configs.stylisticTypeChecked,
  jsdoc({
    config: "flat/recommended-typescript",
    rules: { "jsdoc/require-jsdoc": ["warn", { publicOnly: true }] },
  }),
  prettier,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "curly": "warn",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/require-await": "warn",
    },
  },
);
