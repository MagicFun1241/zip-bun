import type { ZipFile } from "./file.ts";

/**
 * Interface for reading and extracting files from ZIP archives.
 * Provides methods to access archive contents by index or filename,
 * and extract data in various formats.
 */
export interface ZipReader {
  /**
   * Gets the total number of files in the archive.
   * @returns The number of files in the archive.
   */
  getFileCount(): number;

  /**
   * Gets file information by its index in the archive.
   * @param index - The zero-based index of the file.
   * @returns Information about the file at the specified index.
   */
  getFileByIndex(index: number): ZipFile;

  /**
   * Extracts a file from the archive by index as a Uint8Array.
   * @param index - The zero-based index of the file to extract.
   * @returns The decompressed file content as Uint8Array.
   */
  extractFile(index: number): Uint8Array;

  /**
   * Reads a file from the archive by index as a Uint8Array.
   * Alias for {@link extractFile}.
   * @param index - The zero-based index of the file to read.
   * @returns The decompressed file content as Uint8Array.
   */
  readFile(index: number): Uint8Array;

  /**
   * Extracts a file from the archive by index as an ArrayBuffer.
   * @param index - The zero-based index of the file to extract.
   * @returns The decompressed file content as ArrayBuffer.
   */
  extractFileArrayBuffer(index: number): ArrayBuffer;

  /**
   * Extracts a file from the archive by index as a Node.js Buffer.
   * @param index - The zero-based index of the file to extract.
   * @returns The decompressed file content as Buffer.
   */
  extractFileBuffer(index: number): Buffer;

  /**
   * Reads a file from the archive by index as an ArrayBuffer.
   * Alias for {@link extractFileArrayBuffer}.
   * @param index - The zero-based index of the file to read.
   * @returns The decompressed file content as ArrayBuffer.
   */
  readFileArrayBuffer(index: number): ArrayBuffer;

  /**
   * Reads a file from the archive by index as a Node.js Buffer.
   * Alias for {@link extractFileBuffer}.
   * @param index - The zero-based index of the file to read.
   * @returns The decompressed file content as Buffer.
   */
  readFileBuffer(index: number): Buffer;

  /**
   * Extracts a file from the archive by its filename as a Uint8Array.
   * @param filename - The name/path of the file within the archive.
   * @returns The decompressed file content as Uint8Array.
   * @throws Error if the file is not found in the archive.
   */
  extractFileByName(filename: string): Uint8Array;

  /**
   * Reads a file from the archive by its filename as a Uint8Array.
   * Alias for {@link extractFileByName}.
   * @param filename - The name/path of the file within the archive.
   * @returns The decompressed file content as Uint8Array.
   * @throws Error if the file is not found in the archive.
   */
  readFileByName(filename: string): Uint8Array;

  /**
   * Finds a file in the archive by its filename.
   * @param filename - The name/path of the file to find.
   * @returns The zero-based index of the file, or -1 if not found.
   */
  findFile(filename: string): number;

  /**
   * Closes the archive and releases associated resources.
   * @returns True if the archive was successfully closed, false otherwise.
   */
  close(): boolean;
}
