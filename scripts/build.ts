import { $, build } from "bun";

const files = ["zip_wrapper.c", "miniz.c", "miniz.h"];

for (const file of files) {
  await $`cp src/${file} .`;
  console.log(`Copied ${file} to root`);
}

// bun build src/index.ts --outdir dist --target node --format esm --sourcemap=linked
await build({
  entrypoints: ["src/index.ts"],
  outdir: "dist",
  target: "node",
  format: "esm",
  sourcemap: "linked",
});

console.log("Build complete");


for (const file of files) {
  await $`cp src/${file} dist`;
  console.log(`Copied ${file} to dist`);
}

await $`cp src/zip_wrapper.c dist`;
console.log("Copied zip_wrapper.c to dist");
