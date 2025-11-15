import type { CompressionLevelType } from "../compression.ts";
import type { FileData } from "./file.ts";

/**
 * Interface for creating and writing files to ZIP archives.
 * Supports both file-based and memory-based archive creation.
 */
export interface ZipWriter {
  /**
   * Adds a file to the ZIP archive.
   * @param filename - The name/path for the file within the archive.
   * @param data - The file content to add (Uint8Array, ArrayBuffer, or DataView).
   * @param compressionLevel - Optional compression level (0-9). Defaults to no compression.
   * @returns True if the file was successfully added, false otherwise.
   */
  addFile(
    filename: string,
    data: FileData,
    compressionLevel?: CompressionLevelType,
  ): boolean;

  /**
   * Finalizes the ZIP archive and writes it to disk.
   * Must only be called for file-based archives created with a filename.
   * @returns True if finalization was successful, false otherwise.
   * @throws Error if the archive has already been finalized or for memory-based archives.
   */
  finalize(): boolean;
}
