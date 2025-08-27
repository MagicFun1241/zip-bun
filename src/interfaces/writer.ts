import type { CompressionLevelType } from "../compression.ts";
import type { FileData } from "./file.ts";

export interface ZipWriter {
  addFile(
    filename: string,
    data: FileData,
    compressionLevel?: CompressionLevelType,
  ): boolean;
  finalize(): boolean;
}
