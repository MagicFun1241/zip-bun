import { cc, ptr, read } from "bun:ffi";

import { join } from "node:path";

const includePath = import.meta.dir;
const wrapperPath = join(includePath, "zip_wrapper.c");

// Compile the C code with all the zip functions
const {
  symbols: {
    create_zip,
    add_file_to_zip,
    finalize_zip,
    open_zip,
    get_file_count,
    get_file_info,
    extract_file,
    close_zip,
    find_file,
    extract_file_by_name,
    free_extracted_data,
  },
} = cc({
  source: wrapperPath,
  include: [includePath],
  symbols: {
    create_zip: {
      args: ["cstring"],
      returns: "i32",
    },
    add_file_to_zip: {
      args: ["i32", "cstring", "ptr", "u64", "i32"],
      returns: "i32",
    },
    finalize_zip: {
      args: ["i32"],
      returns: "i32",
    },
    open_zip: {
      args: ["cstring"],
      returns: "i32",
    },
    get_file_count: {
      args: ["i32"],
      returns: "i32",
    },
    get_file_info: {
      args: ["i32", "i32", "ptr"],
      returns: "i32",
    },
    extract_file: {
      args: ["i32", "i32", "ptr"],
      returns: "ptr",
    },
    close_zip: {
      args: ["i32"],
      returns: "i32",
    },
    find_file: {
      args: ["i32", "cstring"],
      returns: "i32",
    },
    extract_file_by_name: {
      args: ["i32", "cstring", "ptr"],
      returns: "ptr",
    },
    free_extracted_data: {
      args: ["ptr"],
      returns: "void",
    },
  },
});

// TypeScript interfaces
export interface ZipFileInfo {
  filename: string;
  comment: string;

  uncompressedSize: number;
  compressedSize: number;

  directory: boolean;
  encrypted: boolean;
}

export interface ZipWriter {
  addFile(
    filename: string,
    data: Uint8Array,
    compressionLevel?: number,
  ): boolean;
  finalize(): boolean;
}

export interface ZipReader {
  getFileCount(): number;
  getFileInfo(index: number): ZipFileInfo;
  extractFile(index: number): Uint8Array;
  extractFileByName(filename: string): Uint8Array;
  findFile(filename: string): number;
  close(): boolean;
}

// Compression levels
export const CompressionLevel = {
  NO_COMPRESSION: 0,
  BEST_SPEED: 1,
  BEST_COMPRESSION: 9,
  DEFAULT: 6,
} as const;

export type CompressionLevelType =
  (typeof CompressionLevel)[keyof typeof CompressionLevel];

// ZipWriter class
export class ZipArchiveWriter implements ZipWriter {
  private handleId: number;

  constructor(filename: string) {
    const filenameBuffer = Buffer.from(`${filename}\0`, "utf8");
    const filenamePtr = ptr(filenameBuffer);
    this.handleId = create_zip(filenamePtr);
    if (this.handleId < 0) {
      throw new Error(`Failed to create zip archive: ${filename}`);
    }
  }

  addFile(
    filename: string,
    data: Uint8Array,
    compressionLevel: CompressionLevelType = CompressionLevel.DEFAULT,
  ): boolean {
    if (this.handleId === -1) {
      throw new Error("ZipArchiveWriter has already been finalized");
    }
    const dataPtr = ptr(data);
    const filenameBuffer = Buffer.from(`${filename}\0`, "utf8");
    const filenamePtr = ptr(filenameBuffer);
    return Boolean(
      add_file_to_zip(
        this.handleId,
        filenamePtr,
        dataPtr,
        data.length,
        compressionLevel,
      ),
    );
  }

  finalize(): boolean {
    if (this.handleId === -1) {
      throw new Error("ZipArchiveWriter has already been finalized");
    }
    const result = finalize_zip(this.handleId);
    this.handleId = -1;
    return Boolean(result);
  }
}

// ZipReader class
export class ZipArchiveReader implements ZipReader {
  private handleId: number;

  constructor(filename: string) {
    const filenameBuffer = Buffer.from(`${filename}\0`, "utf8");
    const filenamePtr = ptr(filenameBuffer);
    this.handleId = open_zip(filenamePtr);
    if (this.handleId < 0) {
      throw new Error(`Failed to open zip archive: ${filename}`);
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

  extractFile(index: number): Uint8Array {
    const sizeBuffer = new ArrayBuffer(8);
    const sizePtr = ptr(sizeBuffer);
    const dataPtr = extract_file(this.handleId, index, sizePtr);

    if (!dataPtr) {
      throw new Error(`Failed to extract file at index ${index}`);
    }

    // Read the size from the size buffer
    const sizeView = new DataView(sizeBuffer);
    const size = Number(sizeView.getBigUint64(0, true));

    // Convert the data pointer to Uint8Array using read function
    const data = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      data[i] = read.u8(dataPtr, i);
    }

    // Free the allocated memory
    free_extracted_data(dataPtr);

    return data;
  }

  extractFileByName(filename: string): Uint8Array {
    const sizeBuffer = new ArrayBuffer(8);
    const sizePtr = ptr(sizeBuffer);
    const filenameBuffer = Buffer.from(`${filename}\0`, "utf8");
    const filenamePtr = ptr(filenameBuffer);
    const dataPtr = extract_file_by_name(this.handleId, filenamePtr, sizePtr);

    if (!dataPtr) {
      throw new Error(`File not found in archive: ${filename}`);
    }

    // Read the size from the size buffer
    const sizeView = new DataView(sizeBuffer);
    const size = Number(sizeView.getBigUint64(0, true));

    // Convert the data pointer to Uint8Array using read function
    const data = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      data[i] = read.u8(dataPtr, i);
    }

    // Free the allocated memory
    free_extracted_data(dataPtr);

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

// Convenience functions
export function createArchive(filename: string): ZipArchiveWriter {
  return new ZipArchiveWriter(filename);
}

export function openArchive(filename: string): ZipArchiveReader {
  return new ZipArchiveReader(filename);
}

// Utility function to create a zip from a directory
export async function zipDirectory(
  sourceDir: string,
  outputFile: string,
  compressionLevel: CompressionLevelType = CompressionLevel.DEFAULT,
): Promise<void> {
  const writer = createArchive(outputFile);

  try {
    const entries = await Bun.file(sourceDir).arrayBuffer();

    const data = new Uint8Array(entries);
    writer.addFile(sourceDir, data, compressionLevel);
  } finally {
    writer.finalize();
  }
}

// Utility function to extract all files from a zip
export async function extractArchive(
  zipFile: string,
  outputDir: string,
): Promise<void> {
  const reader = openArchive(zipFile);

  try {
    const fileCount = reader.getFileCount();

    for (let i = 0; i < fileCount; i++) {
      const fileInfo = reader.getFileInfo(i);

      if (!fileInfo.directory) {
        const data = reader.extractFile(i);
        const outputPath = `${outputDir}/${fileInfo.filename}`;

        // Ensure the directory exists
        await Bun.write(outputPath, data);
      }
    }
  } finally {
    reader.close();
  }
}
