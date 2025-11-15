import { ptr } from "bun:ffi";
import type { FileData, ZipFile } from "../interfaces/file.ts";
import type { ZipReader } from "../interfaces/reader.ts";
import { symbols } from "../symbols.ts";

const {
  open_zip,
  open_zip_from_memory,
  find_file,
  get_file_count,
  get_file_info,
  extract_file_to_buffer,
  close_zip,
} = symbols;

/**
 * Implementation of {@link ZipReader} for reading and extracting files from ZIP archives.
 * Supports both file-based archives (from disk) and memory-based archives (from buffers).
 *
 * @example
 * ```typescript
 * // Reading from a file
 * const reader = new ZipArchiveReader('archive.zip');
 * const fileCount = reader.getFileCount();
 * const content = reader.extractFile(0);
 * reader.close();
 * ```
 *
 * @example
 * ```typescript
 * // Reading from memory
 * const zipData = new Uint8Array([...]);
 * const reader = new ZipArchiveReader(zipData);
 * const file = reader.extractFileByName('document.txt');
 * ```
 */
export class ZipArchiveReader implements ZipReader {
  /** Internal handle ID for the native zip archive. */
  private handleId: number;

  /**
   * Creates a new ZIP archive reader.
   * @param filenameOrData - Either a file path (string) or binary data (Uint8Array, ArrayBuffer, or DataView)
   * @throws Error if the archive cannot be opened or is invalid.
   */
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

  /**
   * Gets all files in the archive as an array.
   * @returns An array of all files in the archive.
   */
  files(): ZipFile[] {
    const fileCount = this.getFileCount();
    const files: ZipFile[] = [];

    for (let i = 0; i < fileCount; i++) {
      const fileInfo = this.getFileByIndex(i);
      files.push(fileInfo);
    }

    return files;
  }

  /**
   * Gets an iterator over all files in the archive.
   * Useful for processing large archives without loading all files into memory at once.
   * @returns An iterator over the files in the archive.
   */
  filesIterator(): IterableIterator<ZipFile> {
    const fileCount = this.getFileCount();
    let index = 0;

    return {
      [Symbol.iterator]() {
        return this;
      },
      next: (): IteratorResult<ZipFile> => {
        if (index < fileCount) {
          const fileInfo = this.getFileByIndex(index);
          index++;
          return { value: fileInfo, done: false };
        } else {
          return { value: null, done: true };
        }
      },
    };
  }

  /**
   * Gets the total number of files in the archive.
   * @returns The number of files in the archive.
   */
  getFileCount(): number {
    return get_file_count(this.handleId);
  }

  /**
   * Gets file information by its index in the archive.
   * @param index - The zero-based index of the file.
   * @returns Information about the file at the specified index.
   * @throws Error if the file info cannot be retrieved.
   */
  getFileByIndex(index: number): ZipFile {
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

  /**
   * Reads a file from the archive by index as a Uint8Array.
   * Alias for {@link extractFile}.
   * @param index - The zero-based index of the file to read.
   * @returns The decompressed file content as Uint8Array.
   */
  readFile(index: number): Uint8Array {
    return this.extractFile(index);
  }

  /**
   * Reads a file from the archive by its filename as a Uint8Array.
   * Alias for {@link extractFileByName}.
   * @param filename - The name/path of the file within the archive.
   * @returns The decompressed file content as Uint8Array.
   * @throws Error if the file is not found in the archive.
   */
  readFileByName(filename: string): Uint8Array {
    return this.extractFileByName(filename);
  }

  /**
   * Reads a file from the archive by index as an ArrayBuffer.
   * Alias for {@link extractFileArrayBuffer}.
   * @param index - The zero-based index of the file to read.
   * @returns The decompressed file content as ArrayBuffer.
   */
  readFileArrayBuffer(index: number): ArrayBuffer {
    return this.extractFileArrayBuffer(index);
  }

  /**
   * Reads a file from the archive by index as a Node.js Buffer.
   * Alias for {@link extractFileBuffer}.
   * @param index - The zero-based index of the file to read.
   * @returns The decompressed file content as Buffer.
   */
  readFileBuffer(index: number): Buffer {
    return this.extractFileBuffer(index);
  }

  /**
   * Extracts a file from the archive by its filename as a Uint8Array.
   * @param filename - The name/path of the file within the archive.
   * @returns The decompressed file content as Uint8Array.
   * @throws Error if the file is not found in the archive or extraction fails.
   */
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

  /**
   * Extracts a file from the archive by index as a Uint8Array.
   * @param index - The zero-based index of the file to extract.
   * @returns The decompressed file content as Uint8Array.
   * @throws Error if the file info cannot be retrieved or extraction fails.
   */
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

  /**
   * Extracts a file from the archive by index as a Node.js Buffer.
   * @param index - The zero-based index of the file to extract.
   * @returns The decompressed file content as Buffer.
   */
  extractFileBuffer(index: number): Buffer {
    const data = this.extractFile(index);
    return Buffer.from(data);
  }

  /**
   * Extracts a file from the archive by index as an ArrayBuffer.
   * @param index - The zero-based index of the file to extract.
   * @returns The decompressed file content as ArrayBuffer.
   */
  extractFileArrayBuffer(index: number): ArrayBuffer {
    const data = this.extractFile(index);

    return data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength,
    ) as ArrayBuffer;
  }

  /**
   * Finds a file in the archive by its filename.
   * @param filename - The name/path of the file to find.
   * @returns The zero-based index of the file, or -1 if not found.
   */
  findFile(filename: string): number {
    const filenameBuffer = Buffer.from(`${filename}\0`, "utf8");
    const filenamePtr = ptr(filenameBuffer);
    return find_file(this.handleId, filenamePtr);
  }

  /**
   * Closes the archive and releases associated resources.
   * After closing, the reader instance should not be used.
   * @returns True if the archive was successfully closed.
   * @throws Error if the archive has already been closed.
   */
  close(): boolean {
    if (this.handleId === -1) {
      throw new Error("ZipArchiveReader has already been closed");
    }
    const result = close_zip(this.handleId);
    this.handleId = -1;
    return Boolean(result);
  }
}
