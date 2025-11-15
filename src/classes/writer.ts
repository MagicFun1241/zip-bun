import { ptr } from "bun:ffi";
import { CompressionLevel, type CompressionLevelType } from "../compression.ts";
import type { FileData } from "../interfaces/file.ts";
import type { ZipWriter } from "../interfaces/writer.ts";
import { symbols } from "../symbols.ts";

const {
  create_zip,
  create_zip_in_memory,
  finalize_zip,
  get_zip_final_size,
  finalize_zip_in_memory_bytes,
  add_file_to_zip,
} = symbols;

/**
 * Implementation of {@link ZipWriter} for creating and writing files to ZIP archives.
 * Supports both file-based archives (written to disk) and memory-based archives (stored in memory).
 *
 * @example
 * ```typescript
 * // Creating a file-based archive
 * const writer = new ZipArchiveWriter('output.zip');
 * writer.addFile('file.txt', new TextEncoder().encode('Hello World'));
 * writer.finalize();
 * ```
 *
 * @example
 * ```typescript
 * // Creating a memory-based archive
 * const writer = new ZipArchiveWriter();
 * writer.addFile('document.txt', buffer1);
 * writer.addFile('image.png', buffer2, 6); // Compression level 6
 * const zipData = writer.finalizeToMemory();
 * ```
 */
export class ZipArchiveWriter implements ZipWriter {
  /** Internal handle ID for the native zip archive. */
  private handleId: number;
  /** Flag indicating whether this is a memory-based or file-based archive. */
  private isMemoryBased: boolean;

  /**
   * Creates a new ZIP archive writer.
   * @param filename - Optional filename for file-based archives. If omitted, creates a memory-based archive.
   * @throws Error if the archive cannot be created.
   */
  constructor(filename?: string) {
    if (filename) {
      // File-based zip
      const filenameBuffer = Buffer.from(`${filename}\0`, "utf8");
      const filenamePtr = ptr(filenameBuffer);

      this.handleId = create_zip(filenamePtr);
      this.isMemoryBased = false;

      if (this.handleId < 0) {
        throw new Error(`Failed to create zip archive: ${filename}`);
      }
    } else {
      // Memory-based zip
      this.handleId = create_zip_in_memory();
      this.isMemoryBased = true;

      if (this.handleId < 0) {
        throw new Error("Failed to create memory-based zip archive");
      }
    }
  }

  /**
   * Adds a file to the ZIP archive.
   * @param filename - The name/path for the file within the archive.
   * @param data - The file content to add (Uint8Array, ArrayBuffer, Buffer, or DataView).
   * @param compressionLevel - Optional compression level (0-9). Defaults to no compression if not specified.
   * @returns True if the file was successfully added, false otherwise.
   * @throws Error if the archive has already been finalized.
   */
  addFile(
    filename: string,
    data: FileData,
    compressionLevel?: CompressionLevelType,
  ): boolean {
    if (this.handleId === -1) {
      throw new Error("ZipArchiveWriter has already been finalized");
    }
    const dataPtr = ptr(data);
    const filenameBuffer = Buffer.from(`${filename}\0`, "utf8");
    const filenamePtr = ptr(filenameBuffer);

    let dataLength = 0;

    if ("length" in data) {
      dataLength = data.length;
    } else if ("byteLength" in data) {
      dataLength = data.byteLength;
    }

    // Use NO_COMPRESSION if no compression level is specified
    const actualCompressionLevel =
      compressionLevel ?? CompressionLevel.NO_COMPRESSION;

    return Boolean(
      add_file_to_zip(
        this.handleId,
        filenamePtr,
        dataPtr,
        dataLength,
        actualCompressionLevel,
      ),
    );
  }

  /**
   * Finalizes a file-based ZIP archive and writes it to disk.
   * Must only be called for archives created with a filename.
   * @returns True if finalization was successful.
   * @throws Error if the archive has already been finalized or for memory-based archives.
   */
  finalize(): boolean {
    if (this.handleId === -1) {
      throw new Error("ZipArchiveWriter has already been finalized");
    }

    if (this.isMemoryBased) {
      throw new Error("Use finalizeToMemory() for memory-based zip archives");
    }

    const result = finalize_zip(this.handleId);
    this.handleId = -1;
    return Boolean(result);
  }

  /**
   * Finalizes a memory-based ZIP archive and returns the compressed data.
   * Must only be called for archives created without a filename.
   * @returns The complete ZIP archive as a Uint8Array.
   * @throws Error if the archive has already been finalized or for file-based archives.
   */
  finalizeToMemory(): Uint8Array {
    if (this.handleId === -1) {
      throw new Error("ZipArchiveWriter has already been finalized");
    }

    if (!this.isMemoryBased) {
      throw new Error("Use finalize() for file-based zip archives");
    }

    // First, estimate the final size
    const estimatedSize = get_zip_final_size(this.handleId);
    if (estimatedSize <= 0) {
      throw new Error("Failed to estimate final archive size");
    }

    // Allocate a buffer that's large enough (add some padding for safety)
    const bufferSize = Math.max(estimatedSize * 1.2, 1024 * 1024); // 20% padding, minimum 1MB
    
    const buffer = new ArrayBuffer(bufferSize);
    const bufferPtr = ptr(buffer);

    const resultSize = finalize_zip_in_memory_bytes(
      this.handleId,
      bufferPtr,
      bufferSize,
    );

    if (resultSize <= 0) {
      if (resultSize === -2) {
        throw new Error(`Failed to finalize memory-based zip archive - buffer too small. Estimated: ${estimatedSize}, allocated: ${bufferSize}`);
      } else {
        throw new Error("Failed to finalize memory-based zip archive - archive error");
      }
    }

    // Create a new buffer with the actual size
    const actualBuffer = new ArrayBuffer(resultSize);
    const actualView = new Uint8Array(actualBuffer);
    const originalView = new Uint8Array(buffer, 0, resultSize);

    actualView.set(originalView);
    this.handleId = -1;

    return new Uint8Array(actualBuffer);
  }
}
