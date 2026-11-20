import cloudflare from "@cloudflare/oxlint-config";
import { defineConfig } from "oxlint";

// Cloudflare's preset (built on @nkzw/oxlint-config) turns rules on one by one instead of by
// category, so oxlint upgrades cannot switch on new rules. The additions below are the rules this
// project had on before and the preset does not cover: Next.js, accessibility and stricter types.
const nextjs = [
  "google-font-display",
  "google-font-preconnect",
  "inline-script-id",
  "next-script-for-ga",
  "no-assign-module-variable",
  "no-async-client-component",
  "no-before-interactive-script-outside-document",
  "no-css-tags",
  "no-document-import-in-page",
  "no-duplicate-head",
  "no-head-element",
  "no-head-import-in-document",
  "no-html-link-for-pages",
  "no-img-element",
  "no-page-custom-font",
  "no-script-component-in-head",
  "no-styled-jsx-in-document",
  "no-sync-scripts",
  "no-title-in-document-head",
  "no-typos",
  "no-unwanted-polyfillio",
];

const a11y = [
  "anchor-has-content",
  "anchor-is-valid",
  "aria-activedescendant-has-tabindex",
  "aria-props",
  "aria-proptypes",
  "aria-role",
  "aria-unsupported-elements",
  "autocomplete-valid",
  "click-events-have-key-events",
  "heading-has-content",
  "html-has-lang",
  "iframe-has-title",
  "img-redundant-alt",
  "interactive-supports-focus",
  "label-has-associated-control",
  "media-has-caption",
  "mouse-events-have-key-events",
  "no-access-key",
  "no-autofocus",
  "no-distracting-elements",
  "no-interactive-element-to-noninteractive-role",
  "no-noninteractive-element-interactions",
  "no-noninteractive-element-to-interactive-role",
  "no-noninteractive-tabindex",
  "no-redundant-roles",
  "no-static-element-interactions",
  "role-has-required-aria-props",
  "role-supports-aria-props",
  "scope",
  "tabindex-no-positive",
];

const vitest = [
  "expect-expect",
  "no-commented-out-tests",
  "no-conditional-expect",
  "no-disabled-tests",
  "no-focused-tests",
  "no-identical-title",
  "no-import-node-test",
  "no-interpolation-in-snapshots",
  "no-mocks-import",
  "no-standalone-expect",
  "valid-describe-callback",
  "valid-expect",
  "valid-title",
];

const on = (prefix: string, names: Array<string>) =>
  Object.fromEntries(names.map((name) => [`${prefix}/${name}`, "error" as const]));

export default defineConfig({
  ...cloudflare,
  plugins: [...(cloudflare.plugins ?? []), "nextjs"],
  ignorePatterns: [
    ...(cloudflare.ignorePatterns ?? []),
    "**/.next/**",
    "**/.netlify/**",
    "**/next-env.d.ts",
    "**/database.types.ts",
    "**/playwright-report/**",
    "**/test-results/**",
  ],
  rules: {
    ...cloudflare.rules,
    ...on("nextjs", nextjs),
    ...on("jsx-a11y", a11y),
    // The preset allows mixed arrays of promises and values in Promise.all; bun lint's rule has no
    // options, so it reports those too (stricter).
    "@typescript-eslint/await-thenable": "error",
    "typescript/no-base-to-string": "error",
    "typescript/no-unnecessary-condition": "error",
    "typescript/prefer-nullish-coalescing": "error",
    "typescript/require-await": "error",
    "typescript/restrict-template-expressions": "error",
  },
  overrides: [
    ...(cloudflare.overrides ?? []),
    {
      // Server-only entry points, where logging goes to the function or terminal log.
      files: [
        "apps/web/netlify/functions/**",
        "apps/web/app/**/actions.ts",
        "packages/*/src/cli.ts",
      ],
      rules: { "no-console": "off" },
    },
    {
      files: ["**/*.test.{ts,tsx}"],
      rules: on("vitest", vitest),
    },
  ],
  settings: {
    ...cloudflare.settings,
    next: { rootDir: "apps/web" },
  },
  options: {
    ...cloudflare.options,
    // Lint also reports type errors in every package, in the same pass.
    typeCheck: true,
  },
});
