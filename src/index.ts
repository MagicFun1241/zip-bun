import { Glob } from "bun";
import { ZipArchiveReader } from "./classes/reader.ts";
import { ZipArchiveWriter } from "./classes/writer.ts";
import type { CompressionLevelType } from "./compression.ts";
import type { FileData } from "./interfaces/file.ts";
import { symbols } from "./symbols.ts";

//#region Convenience functions

export function createArchive(filename?: string): ZipArchiveWriter {
  return new ZipArchiveWriter(filename);
}

export function createMemoryArchive(): ZipArchiveWriter {
  return new ZipArchiveWriter();
}

export const readArchive = openArchive;

export function openArchive(filename: string): ZipArchiveReader {
  return new ZipArchiveReader(filename);
}

export const readMemoryArchive = openMemoryArchive;

export function openMemoryArchive(data: FileData): ZipArchiveReader {
  return new ZipArchiveReader(data);
}

// Utility function to create a zip from a directory
export async function zipDirectory(
  sourceDir: string,
  outputFile: string,
  compressionLevel?: CompressionLevelType,
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
        const fileContent = await Bun.file(filePath).bytes();

        // Add the file to the zip with its relative path
        writer.addFile(file, fileContent, compressionLevel);
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
      const fileInfo = reader.getFileByIndex(i);

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
  compressionLevel?: CompressionLevelType,
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
        const fileContent = await Bun.file(filePath).bytes();

        // Add the file to the zip with its relative path
        writer.addFile(file, fileContent, compressionLevel);
      }
    }

    return writer.finalizeToMemory();
  } finally {
    // The writer is automatically cleaned up in finalizeToMemory
  }
}

//#endregion

export { symbols };

export * from "./classes/reader.ts";
export * from "./classes/writer.ts";
export * from "./compression.ts";
export * from "./interfaces/file.ts";
export * from "./interfaces/reader.ts";
export * from "./interfaces/writer.ts";
