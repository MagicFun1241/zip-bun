import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { 
  createZipArchive, 
  openZipArchive, 
  CompressionLevel,
  ZipArchiveWriter,
  ZipArchiveReader,
} from "./index.ts";
import { unlink } from "fs/promises";
import { existsSync } from "fs";

// Test data
const testTextData = "Hello, World! This is a test file for compression.";
const testJsonData = '{"message": "This is JSON data", "number": 42, "array": [1, 2, 3]}';
const testBinaryData = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]); // PNG header

describe("ZipArchiveWriter", () => {
  const testZipFile = "test_writer.zip";

  afterAll(async () => {
    // Clean up test files
    if (existsSync(testZipFile)) {
      await unlink(testZipFile);
    }
  });

  test("should create a new zip archive", () => {
    const writer = createZipArchive(testZipFile);
    expect(writer).toBeInstanceOf(ZipArchiveWriter);
    writer.finalize();
  });

  test("should add text file to zip archive", () => {
    const writer = createZipArchive(testZipFile);
    const textData = new TextEncoder().encode(testTextData);
    
    const result = writer.addFile("test.txt", textData, CompressionLevel.DEFAULT);
    expect(result).toBe(true);
    
    writer.finalize();
  });

  test("should add JSON file to zip archive", () => {
    const writer = createZipArchive(testZipFile);
    const jsonData = new TextEncoder().encode(testJsonData);
    
    const result = writer.addFile("data.json", jsonData, CompressionLevel.BEST_COMPRESSION);
    expect(result).toBe(true);
    
    writer.finalize();
  });

  test("should add binary file to zip archive", () => {
    const writer = createZipArchive(testZipFile);
    
    const result = writer.addFile("test.png", testBinaryData, CompressionLevel.BEST_SPEED);
    expect(result).toBe(true);
    
    writer.finalize();
  });

  test("should add multiple files with different compression levels", () => {
    const writer = createZipArchive(testZipFile);
    
    const textData = new TextEncoder().encode(testTextData);
    const jsonData = new TextEncoder().encode(testJsonData);
    
    expect(writer.addFile("text.txt", textData, CompressionLevel.NO_COMPRESSION)).toBe(true);
    expect(writer.addFile("data.json", jsonData, CompressionLevel.BEST_COMPRESSION)).toBe(true);
    expect(writer.addFile("binary.png", testBinaryData, CompressionLevel.BEST_SPEED)).toBe(true);
    
    writer.finalize();
  });

  test("should handle empty file", () => {
    const writer = createZipArchive(testZipFile);
    const emptyData = new Uint8Array(0);
    
    const result = writer.addFile("empty.txt", emptyData);
    expect(result).toBe(true);
    
    writer.finalize();
  });

  test("should throw error for invalid filename", () => {
    expect(() => {
      createZipArchive("");
    }).toThrow();
  });
});

describe("ZipArchiveReader", () => {
  const testZipFile = "test_reader.zip";

  beforeAll(async () => {
    // Create a test zip file for reading tests
    const writer = createZipArchive(testZipFile);
    const textData = new TextEncoder().encode(testTextData);
    const jsonData = new TextEncoder().encode(testJsonData);
    
    writer.addFile("test.txt", textData, CompressionLevel.DEFAULT);
    writer.addFile("data.json", jsonData, CompressionLevel.BEST_COMPRESSION);
    writer.addFile("binary.png", testBinaryData, CompressionLevel.BEST_SPEED);
    writer.addFile("empty.txt", new Uint8Array(0), CompressionLevel.NO_COMPRESSION);
    writer.finalize();
  });

  afterAll(async () => {
    // Clean up test files
    if (existsSync(testZipFile)) {
      await unlink(testZipFile);
    }
  });

  test("should open existing zip archive", () => {
    const reader = openZipArchive(testZipFile);
    expect(reader).toBeInstanceOf(ZipArchiveReader);
    reader.close();
  });

  test("should get correct file count", () => {
    const reader = openZipArchive(testZipFile);
    const fileCount = reader.getFileCount();
    expect(fileCount).toBe(4);
    reader.close();
  });

  test("should get file info by index", () => {
    const reader = openZipArchive(testZipFile);
    
    const fileInfo = reader.getFileInfo(0);
    expect(fileInfo).toHaveProperty("filename");
    expect(fileInfo).toHaveProperty("uncompressed_size");
    expect(fileInfo).toHaveProperty("compressed_size");
    expect(fileInfo).toHaveProperty("is_directory");
    expect(fileInfo).toHaveProperty("is_encrypted");
    
    reader.close();
  });

  test("should extract text file correctly", () => {
    const reader = openZipArchive(testZipFile);
    
    const data = reader.extractFile(0);
    const text = new TextDecoder().decode(data);
    
    expect(text).toBe(testTextData);
    
    reader.close();
  });

  test("should extract JSON file correctly", () => {
    const reader = openZipArchive(testZipFile);
    
    const data = reader.extractFile(1);
    const text = new TextDecoder().decode(data);
    
    expect(text).toBe(testJsonData);
    
    reader.close();
  });

  test("should extract binary file correctly", () => {
    const reader = openZipArchive(testZipFile);
    
    const data = reader.extractFile(2);
    
    expect(data.length).toBe(testBinaryData.length);
    expect(Array.from(data)).toEqual(Array.from(testBinaryData));
    
    reader.close();
  });

  test("should extract empty file correctly", () => {
    const reader = openZipArchive(testZipFile);
    
    const data = reader.extractFile(3);
    
    expect(data.length).toBe(0);
    
    reader.close();
  });

  test("should find file by name", () => {
    const reader = openZipArchive(testZipFile);
    
    const index = reader.findFile("test.txt");
    expect(index).toBe(0);
    
    const notFoundIndex = reader.findFile("nonexistent.txt");
    expect(notFoundIndex).toBe(-1);
    
    reader.close();
  });

  test("should extract file by name", () => {
    const reader = openZipArchive(testZipFile);
    
    const data = reader.extractFileByName("test.txt");
    const text = new TextDecoder().decode(data);
    
    expect(text).toBe(testTextData);
    
    reader.close();
  });

  test("should throw error when extracting non-existent file by name", () => {
    const reader = openZipArchive(testZipFile);
    
    expect(() => {
      reader.extractFileByName("nonexistent.txt");
    }).toThrow();
    
    reader.close();
  });

  test("should throw error when extracting invalid index", () => {
    const reader = openZipArchive(testZipFile);
    
    expect(() => {
      reader.extractFile(999);
    }).toThrow();
    
    reader.close();
  });

  test("should throw error when getting info for invalid index", () => {
    const reader = openZipArchive(testZipFile);
    
    expect(() => {
      reader.getFileInfo(999);
    }).toThrow();
    
    reader.close();
  });
});

describe("Compression Levels", () => {
  const testZipFile = "compression_test.zip";

  afterAll(async () => {
    if (existsSync(testZipFile)) {
      await unlink(testZipFile);
    }
  });

  test("should compress with NO_COMPRESSION", () => {
    const writer = createZipArchive(testZipFile);
    const data = new TextEncoder().encode(testTextData);
    
    const result = writer.addFile("test.txt", data, CompressionLevel.NO_COMPRESSION);
    expect(result).toBe(true);
    
    writer.finalize();
    
    // Verify the file was created
    expect(existsSync(testZipFile)).toBe(true);
  });

  test("should compress with BEST_SPEED", () => {
    const writer = createZipArchive(testZipFile);
    const data = new TextEncoder().encode(testTextData);
    
    const result = writer.addFile("test.txt", data, CompressionLevel.BEST_SPEED);
    expect(result).toBe(true);
    
    writer.finalize();
  });

  test("should compress with BEST_COMPRESSION", () => {
    const writer = createZipArchive(testZipFile);
    const data = new TextEncoder().encode(testTextData);
    
    const result = writer.addFile("test.txt", data, CompressionLevel.BEST_COMPRESSION);
    expect(result).toBe(true);
    
    writer.finalize();
  });

  test("should compress with DEFAULT level", () => {
    const writer = createZipArchive(testZipFile);
    const data = new TextEncoder().encode(testTextData);
    
    const result = writer.addFile("test.txt", data, CompressionLevel.DEFAULT);
    expect(result).toBe(true);
    
    writer.finalize();
  });
});

describe("Round-trip compression and decompression", () => {
  const testZipFile = "roundtrip_test.zip";

  afterAll(async () => {
    if (existsSync(testZipFile)) {
      await unlink(testZipFile);
    }
  });

  test("should compress and decompress text data correctly", () => {
    const originalData = new TextEncoder().encode(testTextData);
    
    // Compress
    const writer = createZipArchive(testZipFile);
    writer.addFile("test.txt", originalData, CompressionLevel.DEFAULT);
    writer.finalize();
    
    // Decompress
    const reader = openZipArchive(testZipFile);
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
    const writer = createZipArchive(testZipFile);
    writer.addFile("test.png", testBinaryData, CompressionLevel.BEST_COMPRESSION);
    writer.finalize();
    
    // Decompress
    const reader = openZipArchive(testZipFile);
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
    const writer = createZipArchive(testZipFile);
    writer.addFile("large.bin", largeData, CompressionLevel.DEFAULT);
    writer.finalize();
    
    // Decompress
    const reader = openZipArchive(testZipFile);
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
      openZipArchive("nonexistent.zip");
    }).toThrow();
  });

  test("should throw error when finalizing already finalized writer", () => {
    const writer = createZipArchive("test.zip");
    writer.finalize();
    
    expect(() => {
      writer.finalize();
    }).toThrow();
  });

  test("should throw error when adding file to finalized writer", () => {
    const writer = createZipArchive("test.zip");
    writer.finalize();
    
    const data = new TextEncoder().encode("test");
    expect(() => {
      writer.addFile("test.txt", data);
    }).toThrow();
  });

  test("should throw error when closing already closed reader", () => {
    // Create a temporary zip file for this test
    const tempZipFile = "temp_test.zip";
    const writer = createZipArchive(tempZipFile);
    writer.addFile("test.txt", new TextEncoder().encode("test"), CompressionLevel.DEFAULT);
    writer.finalize();
    
    const reader = openZipArchive(tempZipFile);
    reader.close();
    
    expect(() => {
      reader.close();
    }).toThrow();
    
    // Clean up
    if (existsSync(tempZipFile)) {
      unlink(tempZipFile);
    }
  });
});
