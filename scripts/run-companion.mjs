import { build } from "esbuild";
import { pathToFileURL,fileURLToPath } from "node:url";
import { dirname,resolve } from "node:path";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const entry=resolve(root,".sites-runtime/companion/main.mjs");
await build({absWorkingDir:root,entryPoints:["companion/main.ts"],outfile:entry,bundle:true,platform:"node",format:"esm",target:"node22",packages:"external"});
await import(pathToFileURL(entry).href);
