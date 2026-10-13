import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(
  root,
  "node_modules/@opennextjs/cloudflare/dist/cli/build/patches/plugins/load-manifest.js",
);

let source = readFileSync(target, "utf8");
const originalGlob =
  '"**/{*-manifest,required-server-files,prefetch-hints}.json"';
const patchedGlob =
  '"**/{*-manifest,required-server-files,prefetch-hints,preview-props}.json"';

if (source.includes(originalGlob)) {
  source = source.replace(originalGlob, patchedGlob);
}

const fallback = `        p.endsWith("prefetch-hints")) {
      return {};
    }
    if (p.endsWith("preview-props")) {
      return {
        previewModeId: "",
        previewModeSigningKey: "",
        previewModeEncryptionKey: "",
      };
    }`;

if (!source.includes('p.endsWith("preview-props")')) {
  const needle = `        p.endsWith("prefetch-hints")) {
      return {};
    }`;
  if (!source.includes(needle)) {
    throw new Error("OpenNext loadManifest patch point was not found.");
  }
  source = source.replace(needle, fallback);
}

writeFileSync(target, source);
console.log("Patched OpenNext loadManifest to allow preview-props.json");
