import { cp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const publicDir = path.join(root, "public");

const popupTs = await readFile(path.join(root, "src", "popup.ts"), "utf8");
const { code: popupJs } = await esbuild.transform(popupTs, {
  loader: "ts",
  target: "chrome110",
  format: "esm",
});

async function writeExtensionBundle(targetDir) {
  await mkdir(path.join(targetDir, "icons"), { recursive: true });
  await cp(path.join(publicDir, "popup.html"), path.join(targetDir, "popup.html"));
  await cp(path.join(publicDir, "popup.css"), path.join(targetDir, "popup.css"));
  await cp(path.join(publicDir, "manifest.json"), path.join(targetDir, "manifest.json"));
  await writeFile(path.join(targetDir, "popup.js"), popupJs);
  for (const size of [16, 48, 128]) {
    const name = `icon${size}.png`;
    await cp(path.join(publicDir, "icons", name), path.join(targetDir, "icons", name));
  }
}

// Wipe and rebuild dist so it stays a clean loadable package.
await rm(dist, { recursive: true, force: true });
await writeExtensionBundle(dist);

// Also write runtime files to the package root so Load unpacked on
// apps/chrome-extension works (common user selection).
await writeExtensionBundle(root);

console.log(`Chrome extension built.`);
console.log(`Load either:`);
console.log(`  ${dist}`);
console.log(`  ${root}`);
