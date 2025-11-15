/**
 * Represents a file within a ZIP archive.
 */
export interface ZipFile {
  /** The name/path of the file within the archive. */
  filename: string;
  /** Optional comment associated with the file. */
  comment: string;

  /** The size of the file after decompression in bytes. */
  uncompressedSize: number;
  /** The size of the file as stored in the archive in bytes. */
  compressedSize: number;

  /** Whether the entry represents a directory. */
  directory: boolean;
  /** Whether the file is encrypted. */
  encrypted: boolean;
}

/**
 * Supported data types for file content in ZIP operations.
 * Can be a Node.js typed array, ArrayBuffer, or DataView.
 */
export type FileData = NodeJS.TypedArray | ArrayBufferLike | DataView;
