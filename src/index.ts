import { cc, ptr, read } from "bun:ffi";
import { join } from "node:path";
import { Glob } from "bun";

const includePath = import.meta.dir;
const wrapperPath = join(includePath, "zip_wrapper.c");

type FileData = NodeJS.TypedArray | ArrayBufferLike | DataView;

// Use the new bytes function approach with intelligent buffer sizing
// Start with a reasonable buffer size and increase if needed
const bufferSizes = [
  10 * 1024 * 1024, // 10MB
  50 * 1024 * 1024, // 50MB
  100 * 1024 * 1024, // 100MB
  500 * 1024 * 1024, // 500MB
  1024 * 1024 * 1024, // 1GB
];

// Compile the C code with all the zip functions
const {
  symbols: {
    create_zip,
    add_file_to_zip,
    finalize_zip,
    create_zip_in_memory,
    finalize_zip_in_memory_bytes,
    open_zip,
    open_zip_from_memory,
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
    create_zip_in_memory: {
      args: [],
      returns: "i32",
    },
    finalize_zip_in_memory_bytes: {
      args: ["i32", "ptr", "u64"],
      returns: "i32",
    },
    open_zip: {
      args: ["cstring"],
      returns: "i32",
    },
    open_zip_from_memory: {
      args: ["ptr", "u64"],
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

//#region ZipFileInfo

export interface ZipFileInfo {
  filename: string;
  comment: string;

  uncompressedSize: number;
  compressedSize: number;

  directory: boolean;
  encrypted: boolean;
}

//#endregion

//#region ZipWriter

export interface ZipWriter {
  addFile(filename: string, data: FileData, compressionLevel?: number): boolean;
  finalize(): boolean;
}

//#endregion

//#region ZipReader

export interface ZipReader {
  getFileCount(): number;
  getFileInfo(index: number): ZipFileInfo;
  extractFile(index: number): Uint8Array;
  extractFileByName(filename: string): Uint8Array;
  findFile(filename: string): number;
  close(): boolean;
}

//#endregion

//#region CompressionLevel

export const CompressionLevel = {
  NO_COMPRESSION: 0,
  BEST_SPEED: 1,
  BEST_COMPRESSION: 9,
  DEFAULT: 6,
} as const;

//#endregion

//#region CompressionLevelType

export type CompressionLevelType =
  (typeof CompressionLevel)[keyof typeof CompressionLevel];

//#endregion

//#region ZipArchiveWriter

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
    compressionLevel: CompressionLevelType = CompressionLevel.DEFAULT,
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

    return Boolean(
      add_file_to_zip(
        this.handleId,
        filenamePtr,
        dataPtr,
        dataLength,
        compressionLevel,
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
    const originalView = new Uint8Array(buffer!, 0, resultSize);

    actualView.set(originalView);
    this.handleId = -1;

    return new Uint8Array(actualBuffer);
  }
}
//#endregion

//#region ZipArchiveReader

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

//#endregion

//#region Convenience functions

export function createArchive(filename?: string): ZipArchiveWriter {
  return new ZipArchiveWriter(filename);
}

export function createMemoryArchive(): ZipArchiveWriter {
  return new ZipArchiveWriter();
}

export function openArchive(filename: string): ZipArchiveReader {
  return new ZipArchiveReader(filename);
}

export function openMemoryArchive(data: FileData): ZipArchiveReader {
  return new ZipArchiveReader(data);
}

// Utility function to create a zip from a directory
export async function zipDirectory(
  sourceDir: string,
  outputFile: string,
  compressionLevel: CompressionLevelType = CompressionLevel.DEFAULT,
): Promise<void> {
  const writer = createArchive(outputFile);

  try {
    // Use Glob to recursively scan all files in the directory (including hidden files)
    const glob = new Glob("**/*");

    for await (const file of glob.scan(sourceDir)) {
      // Skip directories (they will be created automatically when files are added)
      const filePath = `${sourceDir}/${file}`;
      const fileInfo = await Bun.file(filePath).stat();

      if (fileInfo.isFile()) {
        // Read the file content
        const fileContent = await Bun.file(filePath).arrayBuffer();
        const data = new Uint8Array(fileContent);

        // Add the file to the zip with its relative path
        writer.addFile(file, data, compressionLevel);
      }
    }
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
        const dir = outputPath.substring(0, outputPath.lastIndexOf("/"));
        if (dir) {
          // Create directory by writing a temporary file and then removing it
          const tempFile = `${dir}/.temp`;
          await Bun.write(tempFile, "");
          await Bun.file(tempFile).delete();
        }

        await Bun.write(outputPath, data);
      }
    }
  } finally {
    reader.close();
  }
}

// Utility function to create a zip from a directory in memory
export async function zipDirectoryToMemory(
  sourceDir: string,
  compressionLevel: CompressionLevelType = CompressionLevel.DEFAULT,
): Promise<Uint8Array> {
  const writer = createMemoryArchive();

  try {
    // Use Glob to recursively scan all files in the directory (including hidden files)
    const glob = new Glob("**/*");

    for await (const file of glob.scan(sourceDir)) {
      // Skip directories (they will be created automatically when files are added)
      const filePath = `${sourceDir}/${file}`;
      const fileInfo = await Bun.file(filePath).stat();

      if (fileInfo.isFile()) {
        // Read the file content
        const fileContent = await Bun.file(filePath).arrayBuffer();
        const data = new Uint8Array(fileContent);

        // Add the file to the zip with its relative path
        writer.addFile(file, data, compressionLevel);
      }
    }

    return writer.finalizeToMemory();
  } finally {
    // The writer is automatically cleaned up in finalizeToMemory
  }
}

//#endregion
