import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";
import { execSync } from "child_process";

const prod = process.argv[2] === "production";

// Build Tailwind CSS first
try {
  execSync("npx tailwindcss -i ./src/styles/tailwind.css -o ./styles.css --minify", {
    stdio: "inherit",
  });
} catch (e) {
  console.error("Tailwind build failed:", e);
}

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    ...builtins,
  ],
  format: "cjs",
  target: "es2020",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
  minify: prod,
  define: {
    "process.env.NODE_ENV": JSON.stringify(prod ? "production" : "development"),
  },
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
