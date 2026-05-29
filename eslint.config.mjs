import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";

export default tseslint.config(
  {
    ignores: ["main.js", "dist/**", "node_modules/**", "*.config.*"],
  },
  ...tseslint.configs.recommendedTypeChecked,
  ...obsidianmd.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Disabled per eslint-plugin-obsidianmd guidance: rule is not working as
      // intended and produces false positives on brand names / CJK text.
      "obsidianmd/ui/sentence-case": "off",
      // React fully supports async event handlers; don't flag them in JSX attrs.
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
    },
  }
);
