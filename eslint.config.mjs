import tseslint from "typescript-eslint";

export default [
  { ignores: ["dist/**", "node_modules/**", "*.mjs"] },
  ...tseslint.configs.recommended,
  {
    rules: {
      eqeqeq: "error",
      curly: ["error", "multi-line"],
      "no-throw-literal": "error",
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
];
