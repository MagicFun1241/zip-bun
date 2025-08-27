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

export class ZipArchiveWriter implements ZipWriter {
  private handleId: number;
  private isMemoryBased: boolean;

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
