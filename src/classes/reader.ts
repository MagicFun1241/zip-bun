import { ptr, read } from "bun:ffi";
import type { FileData, ZipFileInfo } from "../interfaces/file.ts";
import type { ZipReader } from "../interfaces/reader.ts";
import { symbols } from "../symbols.ts";

const {
  open_zip,
  open_zip_from_memory,
  find_file,
  get_file_count,
  get_file_info,
  extract_file,
  extract_file_by_name,
  extract_file_to_buffer,
  free_extracted_data,
  close_zip,
} = symbols;

export class ZipArchiveReader implements ZipReader {
  private handleId: number;

  constructor(filenameOrData: string | FileData) {
    if (typeof filenameOrData === "string") {
      // File-based zip
      const filenameBuffer = Buffer.from(`${filenameOrData}\0`, "utf8");
      const filenamePtr = ptr(filenameBuffer);

      this.handleId = open_zip(filenamePtr);

      if (this.handleId < 0) {
        throw new Error(`Failed to open zip archive: ${filenameOrData}`);
      }
    } else {
      // Memory-based zip
      let dataLength = 0;
      let dataPtr: ReturnType<typeof ptr>;

      if (filenameOrData instanceof Uint8Array) {
        dataLength = filenameOrData.length;
        dataPtr = ptr(filenameOrData);
      } else if (filenameOrData instanceof ArrayBuffer) {
        dataLength = filenameOrData.byteLength;
        const buffer = new Uint8Array(filenameOrData);
        dataPtr = ptr(buffer);
      } else if (filenameOrData instanceof DataView) {
        dataLength = filenameOrData.byteLength;
        const buffer = new Uint8Array(
          filenameOrData.buffer,
          filenameOrData.byteOffset,
          filenameOrData.byteLength,
        );
        dataPtr = ptr(buffer);
      } else {
        throw new Error("Unsupported data type for memory-based zip archive");
      }

      this.handleId = open_zip_from_memory(dataPtr, dataLength);
      if (this.handleId < 0) {
        throw new Error("Failed to open memory-based zip archive");
      }
    }
  }

  getFileCount(): number {
    return get_file_count(this.handleId);
  }

  getFileInfo(index: number): ZipFileInfo {
    // Create a buffer for the file_info_t struct
    const infoBuffer = new ArrayBuffer(1024); // Size for file_info_t struct
    const infoPtr = ptr(infoBuffer);

    const success = get_file_info(this.handleId, index, infoPtr);
    if (!success) {
      throw new Error(`Failed to get file info for index ${index}`);
    }

    // Read the struct data
    const view = new DataView(infoBuffer);
    const decoder = new TextDecoder();

    // Read filename (first 256 bytes)
    const filenameBytes = new Uint8Array(infoBuffer, 0, 256);
    const filename = decoder.decode(filenameBytes).replace(/\0/g, "");

    // Read comment (next 256 bytes)
    const commentBytes = new Uint8Array(infoBuffer, 256, 256);
    const comment = decoder.decode(commentBytes).replace(/\0/g, "");

    // Read sizes (assuming size_t is 8 bytes on 64-bit systems)
    const uncompressedSize = Number(view.getBigUint64(512, true));
    const compressedSize = Number(view.getBigUint64(520, true));

    // Read flags
    const directory = Boolean(view.getInt32(528, true));
    const encrypted = Boolean(view.getInt32(532, true));

    return {
      filename,
      comment,
      uncompressedSize,
      compressedSize,
      directory,
      encrypted,
    };
  }

  extractFileByName(filename: string): Uint8Array {
    // First find the file index
    const filenameBuffer = Buffer.from(`${filename}\0`, "utf8");
    const filenamePtr = ptr(filenameBuffer);
    const fileIndex = find_file(this.handleId, filenamePtr);
    
    if (fileIndex < 0) {
      throw new Error(`File not found in archive: ${filename}`);
    }
    
    // Get file info to know the size
    const infoBuffer = new ArrayBuffer(1024);
    const infoPtr = ptr(infoBuffer);
    const success = get_file_info(this.handleId, fileIndex, infoPtr);
    
    if (!success) {
      throw new Error(`Failed to get file info for: ${filename}`);
    }
    
    // Read the uncompressed size from the struct
    const view = new DataView(infoBuffer);
    const size = Number(view.getBigUint64(512, true));
    
    // Create buffer and extract directly to it
    const data = new Uint8Array(size);
    const result = extract_file_to_buffer(
      this.handleId,
      fileIndex,
      ptr(data),
      size,
    );
    
    if (result < 0) {
      throw new Error(`Failed to extract file: ${filename}`);
    }
    
    return data;
  }

  extractFile(index: number): Uint8Array {
    // Get file info to know the size
    const infoBuffer = new ArrayBuffer(1024);
    const infoPtr = ptr(infoBuffer);
    const success = get_file_info(this.handleId, index, infoPtr);
    
    if (!success) {
      throw new Error(`Failed to get file info for index ${index}`);
    }
    
    // Read the uncompressed size from the struct
    const view = new DataView(infoBuffer);
    const size = Number(view.getBigUint64(512, true));
    
    // Create buffer and extract directly to it
    const data = new Uint8Array(size);
    const result = extract_file_to_buffer(
      this.handleId,
      index,
      ptr(data),
      size,
    );
    
    if (result < 0) {
      throw new Error(`Failed to extract file at index ${index}`);
    }
    
    return data;
  }

  findFile(filename: string): number {
    const filenameBuffer = Buffer.from(`${filename}\0`, "utf8");
    const filenamePtr = ptr(filenameBuffer);
    return find_file(this.handleId, filenamePtr);
  }

  close(): boolean {
    if (this.handleId === -1) {
      throw new Error("ZipArchiveReader has already been closed");
    }
    const result = close_zip(this.handleId);
    this.handleId = -1;
    return Boolean(result);
  }
}
