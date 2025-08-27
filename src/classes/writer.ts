import { ptr } from "bun:ffi";
import { bufferSizes } from "../buffering.ts";
import { CompressionLevel, type CompressionLevelType } from "../compression.ts";
import type { FileData } from "../interfaces/file.ts";
import type { ZipWriter } from "../interfaces/writer.ts";
import { symbols } from "../symbols.ts";

const {
  create_zip,
  create_zip_in_memory,
  finalize_zip,
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

    let resultSize = -2;
    let buffer: ArrayBuffer | null = null;
    let bufferPtr: ReturnType<typeof ptr> | null = null;

    for (const estimatedSize of bufferSizes) {
      buffer = new ArrayBuffer(estimatedSize);
      bufferPtr = ptr(buffer);

      resultSize = finalize_zip_in_memory_bytes(
        this.handleId,
        bufferPtr,
        estimatedSize,
      );

      if (resultSize > 0) {
        break; // Success
      } else if (resultSize === -2) {
        // Buffer too small, try next size
        // biome-ignore lint/complexity/noUselessContinue: should continue
        continue;
      } else {
        // Other error
        throw new Error("Failed to finalize memory-based zip archive");
      }
    }

    if (resultSize <= 0) {
      throw new Error(
        "Failed to finalize memory-based zip archive - buffer size exceeded 1GB",
      );
    }

    // Create a new buffer with the actual size
    const actualBuffer = new ArrayBuffer(resultSize);
    const actualView = new Uint8Array(actualBuffer);

    // biome-ignore lint/style/noNonNullAssertion: must be defined
    const originalView = new Uint8Array(buffer!, 0, resultSize);

    actualView.set(originalView);
    this.handleId = -1;

    return new Uint8Array(actualBuffer);
  }
}
