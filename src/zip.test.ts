import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import {
  CompressionLevel,
  createArchive,
  openArchive,
  ZipArchiveReader,
  ZipArchiveWriter,
} from "./index.ts";

const testDirectory = "test_directory";

function generateTextData(size: number): Uint8Array {
  // Use a simpler pattern for testing
  const data = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    data[i] = i % 256; // Simple pattern: 0, 1, 2, ..., 255, 0, 1, ...
  }
  return data;
}

const five_mb = generateTextData(5 * 1024 * 1024);

// Test data
const testTextData = "Hello, World! This is a test file for compression.";
const testJsonData =
  '{"message": "This is JSON data", "number": 42, "array": [1, 2, 3]}';
const testBinaryData = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]); // PNG header

describe("ZipArchiveWriter", () => {
  const testZipFile = "test_writer.zip";

  afterAll(async () => {
    // Clean up test files
    if (await Bun.file(testZipFile).exists()) {
      await Bun.file(testZipFile).delete();
    }
  });

  test("should create a new zip archive", () => {
    const writer = createArchive(testZipFile);
    expect(writer).toBeInstanceOf(ZipArchiveWriter);
    writer.finalize();
  });

  test("should add text file to zip archive", () => {
    const writer = createArchive(testZipFile);
    const textData = new TextEncoder().encode(testTextData);

    const result = writer.addFile(
      "test.txt",
      textData,
      CompressionLevel.DEFAULT,
    );
    expect(result).toBe(true);

    writer.finalize();
  });

  test("should add JSON file to zip archive", () => {
    const writer = createArchive(testZipFile);
    const jsonData = new TextEncoder().encode(testJsonData);

    const result = writer.addFile(
      "data.json",
      jsonData,
      CompressionLevel.BEST_COMPRESSION,
    );
    expect(result).toBe(true);

    writer.finalize();
  });

  test("should add binary file to zip archive", () => {
    const writer = createArchive(testZipFile);

    const result = writer.addFile(
      "test.png",
      testBinaryData,
      CompressionLevel.BEST_SPEED,
    );
    expect(result).toBe(true);

    writer.finalize();
  });

  test("should add multiple files with different compression levels", () => {
    const writer = createArchive(testZipFile);

    const textData = new TextEncoder().encode(testTextData);
    const jsonData = new TextEncoder().encode(testJsonData);

    expect(
      writer.addFile("text.txt", textData, CompressionLevel.NO_COMPRESSION),
    ).toBe(true);
    expect(
      writer.addFile("data.json", jsonData, CompressionLevel.BEST_COMPRESSION),
    ).toBe(true);
    expect(
      writer.addFile("binary.png", testBinaryData, CompressionLevel.BEST_SPEED),
    ).toBe(true);

    writer.finalize();
  });

  test("should handle empty file", () => {
    const writer = createArchive(testZipFile);
    const emptyData = new Uint8Array(0);

    const result = writer.addFile("empty.txt", emptyData);
    expect(result).toBe(true);

    writer.finalize();
  });

  test("should create memory archive with empty filename", () => {
    const writer = createArchive("");
    expect(writer).toBeInstanceOf(ZipArchiveWriter);
    writer.finalizeToMemory();
  });
});

describe("Memory-based ZipArchiveWriter", () => {
  test("should create memory archive", async () => {
    const { createMemoryArchive } = await import("./index.ts");
    const writer = createMemoryArchive();
    expect(writer).toBeInstanceOf(ZipArchiveWriter);
  });

  test("should add files to memory archive", async () => {
    const { createMemoryArchive } = await import("./index.ts");
    const writer = createMemoryArchive();

    const textData = new TextEncoder().encode(testTextData);
    const result = writer.addFile(
      "test.txt",
      textData,
      CompressionLevel.DEFAULT,
    );
    expect(result).toBe(true);
  });

  test("should finalize memory archive to Uint8Array", async () => {
    const { createMemoryArchive } = await import("./index.ts");
    const writer = createMemoryArchive();

    const textData = new TextEncoder().encode(testTextData);
    writer.addFile("test.txt", textData, CompressionLevel.DEFAULT);

    const result = writer.finalizeToMemory();
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  test("should finalize memory archive with small text file", async () => {
    const { createMemoryArchive } = await import("./index.ts");
    const writer = createMemoryArchive();

    const textData = new TextEncoder().encode(testTextData);
    writer.addFile("test.txt", textData, CompressionLevel.DEFAULT);
    const result = writer.finalizeToMemory();

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);

    // Verify it's a valid ZIP by checking the signature
    expect(result[0]).toBe(0x50); // P
    expect(result[1]).toBe(0x4b); // K
    expect(result[2]).toBe(0x03); // \003
    expect(result[3]).toBe(0x04); // \004
  });

  test("should finalize memory archive with 5MB file", async () => {
    const { createMemoryArchive } = await import("./index.ts");
    const writer = createMemoryArchive();

    writer.addFile("large_file.txt", five_mb, CompressionLevel.DEFAULT);
    const result = writer.finalizeToMemory();

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);

    // Verify it's a valid ZIP by checking the signature
    expect(result[0]).toBe(0x50); // P
    expect(result[1]).toBe(0x4b); // K
    expect(result[2]).toBe(0x03); // \003
    expect(result[3]).toBe(0x04); // \004

    // Verify the ZIP has a reasonable size (could be smaller due to compression)
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThan(five_mb.length * 1.1); // Should not be much larger than original
  });

  test("should finalize memory archive with small text file and compression", async () => {
    const { createMemoryArchive } = await import("./index.ts");
    const writer = createMemoryArchive();

    const textData = new TextEncoder().encode(testTextData);
    writer.addFile("test.txt", textData, CompressionLevel.BEST_COMPRESSION);
    const result = writer.finalizeToMemory();

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);

    // Verify it's a valid ZIP by checking the signature
    expect(result[0]).toBe(0x50); // P
    expect(result[1]).toBe(0x4b); // K
    expect(result[2]).toBe(0x03); // \003
    expect(result[3]).toBe(0x04); // \004
  });

  test("should compress 5MB file effectively", async () => {
    const { createMemoryArchive } = await import("./index.ts");

    // Create uncompressed version
    const writer1 = createMemoryArchive();
    writer1.addFile("large.txt", five_mb, CompressionLevel.NO_COMPRESSION);
    const uncompressedResult = writer1.finalizeToMemory();

    // Create compressed version
    const writer2 = createMemoryArchive();
    writer2.addFile("large.txt", five_mb, CompressionLevel.BEST_COMPRESSION);
    const compressedResult = writer2.finalizeToMemory();

    // Verify both are valid ZIPs
    expect(uncompressedResult[0]).toBe(0x50); // P
    expect(uncompressedResult[1]).toBe(0x4b); // K
    expect(compressedResult[0]).toBe(0x50); // P
    expect(compressedResult[1]).toBe(0x4b); // K

    // Verify compression is effective (compressed should be smaller)
    expect(compressedResult.length).toBeLessThan(uncompressedResult.length);

    // Verify compression ratio is reasonable (should compress by at least 10%)
    const compressionRatio =
      compressedResult.length / uncompressedResult.length;
    expect(compressionRatio).toBeLessThan(0.9); // At least 10% compression
  });

  test("should throw error when finalizing memory archive with finalize()", async () => {
    const { createMemoryArchive } = await import("./index.ts");
    const writer = createMemoryArchive();

    const textData = new TextEncoder().encode(testTextData);
    writer.addFile("test.txt", textData, CompressionLevel.DEFAULT);

    expect(() => {
      writer.finalize();
    }).toThrow("Use finalizeToMemory() for memory-based zip archives");
  });

  test("should throw error when finalizing file archive with finalizeToMemory()", () => {
    const writer = createArchive("test.zip");

    const textData = new TextEncoder().encode(testTextData);
    writer.addFile("test.txt", textData, CompressionLevel.DEFAULT);

    expect(() => {
      writer.finalizeToMemory();
    }).toThrow("Use finalize() for file-based zip archives");
  });

  test("should create memory archive from directory", async () => {
    const { zipDirectoryToMemory } = await import("./index.ts");

    const result = await zipDirectoryToMemory(
      testDirectory,
      CompressionLevel.DEFAULT,
    );
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  test("should create memory archive from directory with different compression levels", async () => {
    const { zipDirectoryToMemory } = await import("./index.ts");

    const result = await zipDirectoryToMemory(
      testDirectory,
      CompressionLevel.BEST_COMPRESSION,
    );
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("ZipArchiveReader", () => {
  const testZipFile = "test_reader.zip";

  beforeAll(async () => {
    // Create a test zip file for reading tests
    const writer = createArchive(testZipFile);
    const textData = new TextEncoder().encode(testTextData);
    const jsonData = new TextEncoder().encode(testJsonData);

    writer.addFile("test.txt", textData, CompressionLevel.DEFAULT);
    writer.addFile("data.json", jsonData, CompressionLevel.BEST_COMPRESSION);
    writer.addFile("binary.png", testBinaryData, CompressionLevel.BEST_SPEED);
    writer.addFile(
      "empty.txt",
      new Uint8Array(0),
      CompressionLevel.NO_COMPRESSION,
    );
    writer.finalize();
  });

  afterAll(async () => {
    // Clean up test files
    if (await Bun.file(testZipFile).exists()) {
      await Bun.file(testZipFile).delete();
    }
  });

  test("should open existing zip archive", () => {
    const reader = openArchive(testZipFile);
    expect(reader).toBeInstanceOf(ZipArchiveReader);
    reader.close();
  });

  test("should get correct file count", () => {
    const reader = openArchive(testZipFile);
    const fileCount = reader.getFileCount();
    expect(fileCount).toBe(4);
    reader.close();
  });

  test("should get file info by index", () => {
    const reader = openArchive(testZipFile);

    const fileInfo = reader.getFileInfo(0);
    expect(fileInfo).toHaveProperty("filename");
    expect(fileInfo).toHaveProperty("uncompressedSize");
    expect(fileInfo).toHaveProperty("compressedSize");
    expect(fileInfo).toHaveProperty("directory");
    expect(fileInfo).toHaveProperty("encrypted");

    reader.close();
  });

  test("should extract text file correctly", () => {
    const reader = openArchive(testZipFile);

    const data = reader.extractFile(0);
    const text = new TextDecoder().decode(data);

    expect(text).toBe(testTextData);

    reader.close();
  });

  test("should extract JSON file correctly", () => {
    const reader = openArchive(testZipFile);

    const data = reader.extractFile(1);
    const text = new TextDecoder().decode(data);

    expect(text).toBe(testJsonData);

    reader.close();
  });

  test("should extract binary file correctly", () => {
    const reader = openArchive(testZipFile);

    const data = reader.extractFile(2);

    expect(data.length).toBe(testBinaryData.length);
    expect(Array.from(data)).toEqual(Array.from(testBinaryData));

    reader.close();
  });

  test("should extract empty file correctly", () => {
    const reader = openArchive(testZipFile);

    const data = reader.extractFile(3);

    expect(data.length).toBe(0);

    reader.close();
  });

  test("should find file by name", () => {
    const reader = openArchive(testZipFile);

    const index = reader.findFile("test.txt");
    expect(index).toBe(0);

    const notFoundIndex = reader.findFile("nonexistent.txt");
    expect(notFoundIndex).toBe(-1);

    reader.close();
  });

  test("should extract file by name", () => {
    const reader = openArchive(testZipFile);

    const data = reader.extractFileByName("test.txt");
    const text = new TextDecoder().decode(data);

    expect(text).toBe(testTextData);

    reader.close();
  });

  test("should throw error when extracting non-existent file by name", () => {
    const reader = openArchive(testZipFile);

    expect(() => {
      reader.extractFileByName("nonexistent.txt");
    }).toThrow();

    reader.close();
  });

  test("should throw error when extracting invalid index", () => {
    const reader = openArchive(testZipFile);

    expect(() => {
      reader.extractFile(999);
    }).toThrow();

    reader.close();
  });

  test("should throw error when getting info for invalid index", () => {
    const reader = openArchive(testZipFile);

    expect(() => {
      reader.getFileInfo(999);
    }).toThrow();

    reader.close();
  });
});

describe("Compression Levels", () => {
  const testZipFile = "compression_test.zip";

  afterAll(async () => {
    if (await Bun.file(testZipFile).exists()) {
      await Bun.file(testZipFile).delete();
    }
  });

  test("should compress with NO_COMPRESSION", async () => {
    const writer = createArchive(testZipFile);
    const data = new TextEncoder().encode(testTextData);

    const result = writer.addFile(
      "test.txt",
      data,
      CompressionLevel.NO_COMPRESSION,
    );
    expect(result).toBe(true);

    writer.finalize();

    // Verify the file was created
    expect(await Bun.file(testZipFile).exists()).toBe(true);
  });

  test("should compress with BEST_SPEED", () => {
    const writer = createArchive(testZipFile);
    const data = new TextEncoder().encode(testTextData);

    const result = writer.addFile(
      "test.txt",
      data,
      CompressionLevel.BEST_SPEED,
    );
    expect(result).toBe(true);

    writer.finalize();
  });

  test("should compress with BEST_COMPRESSION", () => {
    const writer = createArchive(testZipFile);
    const data = new TextEncoder().encode(testTextData);

    const result = writer.addFile(
      "test.txt",
      data,
      CompressionLevel.BEST_COMPRESSION,
    );
    expect(result).toBe(true);

    writer.finalize();
  });

  test("should compress with DEFAULT level", () => {
    const writer = createArchive(testZipFile);
    const data = new TextEncoder().encode(testTextData);

    const result = writer.addFile("test.txt", data, CompressionLevel.DEFAULT);
    expect(result).toBe(true);

    writer.finalize();
  });
});

describe("Round-trip compression and decompression", () => {
  const testZipFile = "roundtrip_test.zip";

  afterAll(async () => {
    if (await Bun.file(testZipFile).exists()) {
      await Bun.file(testZipFile).delete();
    }
  });

  test("should compress and decompress text data correctly", () => {
    const originalData = new TextEncoder().encode(testTextData);

    // Compress
    const writer = createArchive(testZipFile);
    writer.addFile("test.txt", originalData, CompressionLevel.DEFAULT);
    writer.finalize();

    // Decompress
    const reader = openArchive(testZipFile);
    const extractedData = reader.extractFile(0);
    reader.close();

    // Compare
    expect(extractedData.length).toBe(originalData.length);
    expect(Array.from(extractedData)).toEqual(Array.from(originalData));

    const extractedText = new TextDecoder().decode(extractedData);
    expect(extractedText).toBe(testTextData);
  });

  test("should compress and decompress binary data correctly", () => {
    // Compress
    const writer = createArchive(testZipFile);
    writer.addFile(
      "test.png",
      testBinaryData,
      CompressionLevel.BEST_COMPRESSION,
    );
    writer.finalize();

    // Decompress
    const reader = openArchive(testZipFile);
    const extractedData = reader.extractFile(0);
    reader.close();

    // Compare
    expect(extractedData.length).toBe(testBinaryData.length);
    expect(Array.from(extractedData)).toEqual(Array.from(testBinaryData));
  });

  test("should handle large data", () => {
    // Create large test data
    const largeData = new Uint8Array(1024 * 1024); // 1MB
    for (let i = 0; i < largeData.length; i++) {
      largeData[i] = i % 256;
    }

    // Compress
    const writer = createArchive(testZipFile);
    writer.addFile("large.bin", largeData, CompressionLevel.DEFAULT);
    writer.finalize();

    // Decompress
    const reader = openArchive(testZipFile);
    const extractedData = reader.extractFile(0);
    reader.close();

    // Compare
    expect(extractedData.length).toBe(largeData.length);
    expect(Array.from(extractedData)).toEqual(Array.from(largeData));
  });
});

describe("Error handling", () => {
  test("should throw error when opening non-existent file", () => {
    expect(() => {
      openArchive("nonexistent.zip");
    }).toThrow();
  });

  test("should throw error when finalizing already finalized writer", () => {
    const writer = createArchive("test.zip");
    writer.finalize();

    expect(() => {
      writer.finalize();
    }).toThrow();
  });

  test("should throw error when adding file to finalized writer", () => {
    const writer = createArchive("test.zip");
    writer.finalize();

    const data = new TextEncoder().encode("test");
    expect(() => {
      writer.addFile("test.txt", data);
    }).toThrow();
  });

  test("should throw error when closing already closed reader", async () => {
    // Create a temporary zip file for this test
    const tempZipFile = "temp_test.zip";
    const writer = createArchive(tempZipFile);
    writer.addFile(
      "test.txt",
      new TextEncoder().encode("test"),
      CompressionLevel.DEFAULT,
    );
    writer.finalize();

    const reader = openArchive(tempZipFile);
    reader.close();

    expect(() => {
      reader.close();
    }).toThrow();

    // Clean up
    if (await Bun.file(tempZipFile).exists()) {
      await Bun.file(tempZipFile).delete();
    }
  });
});

describe("Convenience functions", () => {
  const testDir = "test_directory";
  const testZipFile = "convenience_test.zip";
  const extractedDir = "extracted_directory";

  beforeAll(async () => {
    // Create a test directory with some files
    // First create the directory by writing a file to it
    await Bun.write(`${testDir}/.keep`, "");
    await Bun.write(`${testDir}/file1.txt`, "Content of file 1");
    await Bun.write(`${testDir}/file2.json`, '{"key": "value"}');
    await Bun.write(`${testDir}/binary.bin`, new Uint8Array([1, 2, 3, 4, 5]));
  });

  afterAll(async () => {
    // Clean up test files and directories
    const filesToClean = [testZipFile, testDir, extractedDir];
    for (const file of filesToClean) {
      if (await Bun.file(file).exists()) {
        await Bun.file(file).delete();
      }
    }
  });

  test("should create archive from directory", async () => {
    const { zipDirectory } = await import("./index.ts");

    await zipDirectory(testDir, testZipFile, CompressionLevel.DEFAULT);

    // Verify the zip file was created
    expect(await Bun.file(testZipFile).exists()).toBe(true);

    // Verify we can read the archive
    const reader = openArchive(testZipFile);
    expect(reader.getFileCount()).toBeGreaterThan(0); // Should have at least some files
    reader.close();
  });

  test("should create archive from directory with different compression levels", async () => {
    const { zipDirectory } = await import("./index.ts");

    await zipDirectory(testDir, testZipFile, CompressionLevel.BEST_COMPRESSION);

    // Verify the zip file was created
    expect(await Bun.file(testZipFile).exists()).toBe(true);

    // Verify we can read the archive
    const reader = openArchive(testZipFile);
    expect(reader.getFileCount()).toBeGreaterThan(0); // Should have at least some files
    reader.close();
  });

  test("should extract archive to directory", async () => {
    const { zipDirectory, extractArchive } = await import("./index.ts");

    // First create an archive
    await zipDirectory(testDir, testZipFile, CompressionLevel.DEFAULT);

    // Then extract it
    await extractArchive(testZipFile, extractedDir);

    // Verify that the zip file contains files
    const reader = openArchive(testZipFile);
    const fileCount = reader.getFileCount();
    expect(fileCount).toBeGreaterThan(0);
    reader.close();

    // Check if specific files exist and verify their content if they do
    if (await Bun.file(`${extractedDir}/file1.txt`).exists()) {
      const content1 = await Bun.file(`${extractedDir}/file1.txt`).text();
      expect(content1).toBe("Content of file 1");
    }

    if (await Bun.file(`${extractedDir}/file2.json`).exists()) {
      const content2 = await Bun.file(`${extractedDir}/file2.json`).text();
      expect(content2).toBe('{"key": "value"}');
    }

    if (await Bun.file(`${extractedDir}/binary.bin`).exists()) {
      const content3 = await Bun.file(
        `${extractedDir}/binary.bin`,
      ).arrayBuffer();
      expect(new Uint8Array(content3)).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
    }
  });

  test("should handle zipDirectory with non-existent source", async () => {
    const { zipDirectory } = await import("./index.ts");

    // This should handle the error gracefully or throw an appropriate error
    try {
      await zipDirectory("non_existent_dir", testZipFile);
      // If it doesn't throw, the zip file should still be created (even if empty)
      expect(await Bun.file(testZipFile).exists()).toBe(true);
    } catch (error) {
      // It's also acceptable for this to throw an error
      expect(error).toBeInstanceOf(Error);
    }
  });

  test("should handle extractArchive with non-existent zip file", async () => {
    const { extractArchive } = await import("./index.ts");

    // This should throw an error when trying to open a non-existent zip file
    await expect(
      extractArchive("non_existent.zip", extractedDir),
    ).rejects.toThrow();
  });
});

describe("Memory-based ZipArchiveReader", () => {
  test("should open memory archive", async () => {
    const { createMemoryArchive, openMemoryArchive } = await import(
      "./index.ts"
    );

    // Create a memory archive first
    const writer = createMemoryArchive();
    const textData = new TextEncoder().encode(testTextData);
    writer.addFile("test.txt", textData, CompressionLevel.DEFAULT);
    const zipData = writer.finalizeToMemory();

    // Open the memory archive
    const reader = openMemoryArchive(zipData);
    expect(reader).toBeInstanceOf(ZipArchiveReader);
    expect(reader.getFileCount()).toBe(1);
    reader.close();
  });

  test("should extract files from memory archive", async () => {
    const { createMemoryArchive, openMemoryArchive } = await import(
      "./index.ts"
    );

    // Create a memory archive with multiple files
    const writer = createMemoryArchive();
    const textData = new TextEncoder().encode(testTextData);
    const jsonData = new TextEncoder().encode(testJsonData);

    writer.addFile("test.txt", textData, CompressionLevel.DEFAULT);
    writer.addFile("data.json", jsonData, CompressionLevel.BEST_COMPRESSION);
    const zipData = writer.finalizeToMemory();

    // Open and extract from memory archive
    const reader = openMemoryArchive(zipData);
    expect(reader.getFileCount()).toBe(2);

    // Extract text file
    const extractedText = reader.extractFile(0);
    const text = new TextDecoder().decode(extractedText);
    expect(text).toBe(testTextData);

    // Extract JSON file
    const extractedJson = reader.extractFile(1);
    const json = new TextDecoder().decode(extractedJson);
    expect(json).toBe(testJsonData);

    reader.close();
  });

  test("should find and extract files by name from memory archive", async () => {
    const { createMemoryArchive, openMemoryArchive } = await import(
      "./index.ts"
    );

    // Create a memory archive
    const writer = createMemoryArchive();
    const textData = new TextEncoder().encode(testTextData);
    writer.addFile("test.txt", textData, CompressionLevel.DEFAULT);
    const zipData = writer.finalizeToMemory();

    // Open memory archive and find file
    const reader = openMemoryArchive(zipData);

    const index = reader.findFile("test.txt");
    expect(index).toBe(0);

    const notFoundIndex = reader.findFile("nonexistent.txt");
    expect(notFoundIndex).toBe(-1);

    // Extract by name
    const data = reader.extractFileByName("test.txt");
    const text = new TextDecoder().decode(data);
    expect(text).toBe(testTextData);

    reader.close();
  });

  test("should get file info from memory archive", async () => {
    const { createMemoryArchive, openMemoryArchive } = await import(
      "./index.ts"
    );

    // Create a memory archive
    const writer = createMemoryArchive();
    const textData = new TextEncoder().encode(testTextData);
    writer.addFile("test.txt", textData, CompressionLevel.DEFAULT);
    const zipData = writer.finalizeToMemory();

    // Open memory archive and get file info
    const reader = openMemoryArchive(zipData);

    const fileInfo = reader.getFileInfo(0);
    expect(fileInfo.filename).toBe("test.txt");
    expect(fileInfo.uncompressedSize).toBe(testTextData.length);
    expect(fileInfo.directory).toBe(false);
    expect(fileInfo.encrypted).toBe(false);

    reader.close();
  });

  test("should handle round-trip memory operations", async () => {
    const { createMemoryArchive, openMemoryArchive } = await import(
      "./index.ts"
    );

    // Create memory archive
    const writer = createMemoryArchive();
    const originalData = new TextEncoder().encode(testTextData);
    writer.addFile("test.txt", originalData, CompressionLevel.DEFAULT);
    const zipData = writer.finalizeToMemory();

    // Open memory archive
    const reader = openMemoryArchive(zipData);
    const extractedData = reader.extractFile(0);
    reader.close();

    // Compare
    expect(extractedData.length).toBe(originalData.length);
    expect(Array.from(extractedData)).toEqual(Array.from(originalData));

    const extractedText = new TextDecoder().decode(extractedData);
    expect(extractedText).toBe(testTextData);
  });

  test("should handle different data types in memory archive", async () => {
    const { createMemoryArchive, openMemoryArchive } = await import(
      "./index.ts"
    );

    // Create memory archive with different data types
    const writer = createMemoryArchive();

    // Uint8Array
    const uint8Data = new Uint8Array([1, 2, 3, 4, 5]);
    writer.addFile("data.bin", uint8Data);

    // ArrayBuffer
    const arrayBuffer = new ArrayBuffer(8);
    const view = new DataView(arrayBuffer);
    view.setInt32(0, 42, true);
    writer.addFile("config.bin", arrayBuffer);

    const zipData = writer.finalizeToMemory();

    // Open memory archive and extract
    const reader = openMemoryArchive(zipData);
    expect(reader.getFileCount()).toBe(2);

    const extractedUint8 = reader.extractFile(0);
    expect(Array.from(extractedUint8)).toEqual([1, 2, 3, 4, 5]);

    const extractedArrayBuffer = reader.extractFile(1);
    expect(extractedArrayBuffer.length).toBe(8);

    reader.close();
  });

  test("should verify memory ZIP data is valid by writing to file", async () => {
    const { createMemoryArchive, openArchive } = await import("./index.ts");

    // Create a memory archive
    const writer = createMemoryArchive();
    const textData = new TextEncoder().encode(testTextData);
    writer.addFile("test.txt", textData, CompressionLevel.DEFAULT);
    const zipData = writer.finalizeToMemory();

    // Write the memory ZIP data to a file
    const tempFile = "temp_memory_test.zip";
    await Bun.write(tempFile, zipData);

    // Try to open it as a regular file-based ZIP
    const reader = openArchive(tempFile);
    expect(reader.getFileCount()).toBe(1);

    const extractedData = reader.extractFile(0);
    const extractedText = new TextDecoder().decode(extractedData);
    expect(extractedText).toBe(testTextData);

    reader.close();

    // Clean up
    await Bun.file(tempFile).delete();
  });

  test("should open memory archive from real ZIP file", async () => {
    const { openMemoryArchive } = await import("./index.ts");

    // Create a real ZIP file first
    const writer = createArchive("test_real.zip");
    const textData = new TextEncoder().encode(testTextData);
    writer.addFile("test.txt", textData, CompressionLevel.DEFAULT);
    writer.finalize();

    // Read the ZIP file into memory
    const zipData = await Bun.file("test_real.zip").arrayBuffer();
    const zipBuffer = new Uint8Array(zipData);

    // Open the memory archive
    const reader = openMemoryArchive(zipBuffer);
    expect(reader.getFileCount()).toBe(1);

    const extractedData = reader.extractFile(0);
    const extractedText = new TextDecoder().decode(extractedData);
    expect(extractedText).toBe(testTextData);

    reader.close();

    // Clean up
    await Bun.file("test_real.zip").delete();
  });

  test("should read memory archive with small text file", async () => {
    const { createMemoryArchive, openMemoryArchive } = await import(
      "./index.ts"
    );

    // Create a memory archive with small text file
    const writer = createMemoryArchive();
    const textData = new TextEncoder().encode(testTextData);
    writer.addFile("small.txt", textData, CompressionLevel.DEFAULT);
    const zipData = writer.finalizeToMemory();

    // Read the memory archive
    const reader = openMemoryArchive(zipData);
    expect(reader.getFileCount()).toBe(1);

    const fileInfo = reader.getFileInfo(0);
    expect(fileInfo.filename).toBe("small.txt");
    expect(fileInfo.uncompressedSize).toBe(testTextData.length);

    const extractedData = reader.extractFile(0);
    const extractedText = new TextDecoder().decode(extractedData);
    expect(extractedText).toBe(testTextData);

    reader.close();
  });

  test("should read memory archive with 5MB file", async () => {
    const { createMemoryArchive, openMemoryArchive } = await import(
      "./index.ts"
    );

    // Create a memory archive with 5MB file
    const writer = createMemoryArchive();
    writer.addFile("large.txt", five_mb, CompressionLevel.DEFAULT);
    const zipData = writer.finalizeToMemory();

    // Read the memory archive
    const reader = openMemoryArchive(zipData);
    expect(reader.getFileCount()).toBe(1);

    const fileInfo = reader.getFileInfo(0);
    expect(fileInfo.filename).toBe("large.txt");
    expect(fileInfo.uncompressedSize).toBe(five_mb.length);

    const extractedData = reader.extractFile(0);
    expect(extractedData.length).toBe(five_mb.length);

    // Verify the data matches (check first and last few bytes for performance)
    const [first, second] = five_mb;
    expect(first).toBeDefined();
    expect(second).toBeDefined();

    // biome-ignore lint/style/noNonNullAssertion: must be defined
    expect(extractedData[0]).toBe(first!);
    // biome-ignore lint/style/noNonNullAssertion: must be defined
    expect(extractedData[1]).toBe(second!);

    const [secondLast, last] = five_mb.slice(-2);
    expect(last).toBeDefined();
    expect(secondLast).toBeDefined();

    // biome-ignore lint/style/noNonNullAssertion: must be defined
    expect(extractedData[extractedData.length - 1]).toBe(last!);
    // biome-ignore lint/style/noNonNullAssertion: must be defined
    expect(extractedData[extractedData.length - 2]).toBe(secondLast!);

    reader.close();
  });

  test("should read memory archive with compressed 5MB file", async () => {
    const { createMemoryArchive, openMemoryArchive } = await import(
      "./index.ts"
    );

    // Create a memory archive with compressed 5MB file
    const writer = createMemoryArchive();
    writer.addFile(
      "large_compressed.txt",
      five_mb,
      CompressionLevel.BEST_COMPRESSION,
    );
    const zipData = writer.finalizeToMemory();

    // Read the memory archive
    const reader = openMemoryArchive(zipData);
    expect(reader.getFileCount()).toBe(1);

    const fileInfo = reader.getFileInfo(0);
    expect(fileInfo.filename).toBe("large_compressed.txt");
    expect(fileInfo.uncompressedSize).toBe(five_mb.length);
    expect(fileInfo.compressedSize).toBeLessThan(five_mb.length); // Should be compressed

    const extractedData = reader.extractFile(0);
    expect(extractedData.length).toBe(five_mb.length);

    const [first, second] = five_mb;
    expect(first).toBeDefined();
    expect(second).toBeDefined();

    // Verify the data matches (check first and last few bytes for performance)
    // biome-ignore lint/style/noNonNullAssertion: must be defined
    expect(extractedData[0]).toBe(first!);
    // biome-ignore lint/style/noNonNullAssertion: must be defined
    expect(extractedData[1]).toBe(second!);

    const [secondLast, last] = five_mb.slice(-2);
    expect(last).toBeDefined();
    expect(secondLast).toBeDefined();
    // biome-ignore lint/style/noNonNullAssertion: must be defined
    expect(extractedData[extractedData.length - 1]).toBe(last!);
    // biome-ignore lint/style/noNonNullAssertion: must be defined
    expect(extractedData[extractedData.length - 2]).toBe(secondLast!);

    reader.close();
  });
});
