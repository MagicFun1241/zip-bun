import { readFileSync } from "fs";

export function content() {
  return readFileSync("./src/zip_wrapper.c", "utf8");
}