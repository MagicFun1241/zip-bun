# Bun Zip Library

![npm](https://img.shields.io/npm/v/zip-bun)

<p align="center">
  <img src="images/zip-bun.png" alt="logo" />
</p>

A high-performance ZIP archive library for Bun, built with native C bindings using the [miniz](https://github.com/richgel999/miniz) compression library and Bun's C compiler.

## Features

- **High Performance**: Native C bindings for maximum speed
- **Full ZIP Support**: Create, read, and extract ZIP archives
- **Memory-Based Operations**: Create and manipulate ZIP archives entirely in memory
- **Compression Control**: Multiple compression levels (no compression to best compression)
- **TypeScript Support**: Full TypeScript definitions and type safety
- **Comprehensive Testing**: Full test suite with coverage
- **Cross Platform**: Works on macOS, Linux, and Windows

## Installation

```bash
npm install zip-bun
# or
bun add zip-bun
```

## Quick Start

### Creating a ZIP Archive

```typescript
import { createArchive, CompressionLevel } from "zip-bun";

// Create a new ZIP archive
const writer = createArchive("archive.zip");

// Add files with different compression levels
const textData = new TextEncoder().encode("Hello, World!");
writer.addFile("hello.txt", textData, CompressionLevel.DEFAULT);

const jsonData = new TextEncoder().encode('{"message": "Hello"}');
writer.addFile("data.json", jsonData, CompressionLevel.BEST_COMPRESSION);

// Don't forget to finalize the archive
writer.finalize();
```

### Creating a ZIP Archive in Memory

```typescript
import { createMemoryArchive } from "zip-bun";

// Create a memory-based ZIP archive
const writer = createMemoryArchive();

// Add files
const textData = new TextEncoder().encode("Hello, World!");
writer.addFile("hello.txt", textData, CompressionLevel.DEFAULT);

// Get the ZIP data as a Uint8Array
const zipData = writer.finalizeToMemory();

// Use the data (e.g., save to file, send over network, etc.)
await Bun.write("archive.zip", zipData);
```

### Reading a ZIP Archive

```typescript
import { openArchive } from "zip-bun";

// Open an existing ZIP archive
const reader = openArchive("archive.zip");

// Get information about files
console.log(`Archive contains ${reader.getFileCount()} files`);

// List all files
for (let i = 0; i < reader.getFileCount(); i++) {
  const fileInfo = reader.getFileInfo(i);
  console.log(`${fileInfo.filename}: ${fileInfo.uncompressedSize} bytes`);
}

// Extract a specific file
const data = reader.extractFile(0);
const text = new TextDecoder().decode(data);
console.log(text);

// Or extract by filename
const fileData = reader.extractFileByName("hello.txt");

// Don't forget to close the reader
reader.close();
```

## API Reference

### Compression Levels

```typescript
enum CompressionLevel {
  NO_COMPRESSION = 0,      // No compression
  BEST_SPEED = 1,          // Fastest compression
  DEFAULT = 6,             // Default compression
  BEST_COMPRESSION = 9     // Best compression ratio
}
```

### Core Classes

#### ZipArchiveWriter

A class for creating ZIP archives, supporting both file-based and memory-based operations.

**Constructor:**
```typescript
// File-based ZIP
createArchive(filename: string): ZipArchiveWriter

// Memory-based ZIP
createMemoryArchive(): ZipArchiveWriter
// or
createArchive(): ZipArchiveWriter  // No filename creates memory-based archive
```

**Methods:**
```typescript
// Add a file to the archive
addFile(
  filename: string, 
  data: Uint8Array | ArrayBuffer | DataView, 
  compressionLevel?: CompressionLevel
): boolean

// Finalize file-based archive (writes to disk)
finalize(): boolean

// Finalize memory-based archive (returns Uint8Array)
finalizeToMemory(): Uint8Array
```

#### ZipArchiveReader

A class for reading and extracting from ZIP archives.

**Constructor:**
```typescript
openArchive(filename: string): ZipArchiveReader
```

**Methods:**
```typescript
// Get the number of files in the archive
getFileCount(): number

// Get information about a file by index
getFileInfo(index: number): ZipFileInfo

// Extract a file by index
extractFile(index: number): Uint8Array

// Extract a file by name
extractFileByName(filename: string): Uint8Array

// Find the index of a file by name (returns -1 if not found)
findFile(filename: string): number

// Close the archive reader
close(): boolean
```

### Interfaces

#### ZipFileInfo

Information about a file in a ZIP archive.

```typescript
interface ZipFileInfo {
  filename: string;        // Name of the file
  comment: string;         // File comment
  uncompressedSize: number; // Original file size
  compressedSize: number;   // Compressed file size
  directory: boolean;      // Whether this is a directory
  encrypted: boolean;      // Whether the file is encrypted
}
```

#### FileData

Supported data types for adding files to archives.

```typescript
type FileData = Uint8Array | ArrayBuffer | DataView;
```

### Convenience Functions

#### File-Based Operations

```typescript
// Create a ZIP archive from a directory
zipDirectory(
  sourceDir: string, 
  outputFile: string, 
  compressionLevel?: CompressionLevel
): Promise<void>

// Extract all files from a ZIP archive
extractArchive(
  zipFile: string, 
  outputDir: string
): Promise<void>
```

#### Memory-Based Operations

```typescript
// Create a ZIP archive from a directory in memory
zipDirectoryToMemory(
  sourceDir: string, 
  compressionLevel?: CompressionLevel
): Promise<Uint8Array>
```

## Examples

### File-Based ZIP Operations

#### Creating a ZIP with Multiple Files

```typescript
import { createArchive, CompressionLevel } from "zip-bun";

const writer = createArchive("backup.zip");

// Add text files
const readmeData = new TextEncoder().encode("# My Project\n\nThis is a README file.");
writer.addFile("README.md", readmeData, CompressionLevel.DEFAULT);

// Add JSON configuration
const configData = new TextEncoder().encode('{"version": "1.0.0", "debug": false}');
writer.addFile("config.json", configData, CompressionLevel.BEST_COMPRESSION);

// Add binary files
const imageData = await Bun.file("image.png").arrayBuffer();
writer.addFile("image.png", new Uint8Array(imageData), CompressionLevel.BEST_SPEED);

writer.finalize();
```

#### Creating a ZIP from a Directory

```typescript
import { zipDirectory, CompressionLevel } from "zip-bun";

// Create a ZIP from a directory
await zipDirectory("my-project", "project-backup.zip", CompressionLevel.BEST_COMPRESSION);
```

#### Extracting All Files from a ZIP

```typescript
import { openArchive } from "zip-bun";

const reader = openArchive("backup.zip");

for (let i = 0; i < reader.getFileCount(); i++) {
  const fileInfo = reader.getFileInfo(i);
  
  if (!fileInfo.directory) {
    const data = reader.extractFile(i);
    
    // Save to file system
    await Bun.write(fileInfo.filename, data);
    console.log(`Extracted: ${fileInfo.filename}`);
  }
}

reader.close();
```

#### Extracting a ZIP to a Directory

```typescript
import { extractArchive } from "zip-bun";

// Extract all files from a ZIP to a directory
await extractArchive("backup.zip", "extracted-files");
```

### Memory-Based ZIP Operations

#### Creating a ZIP in Memory

```typescript
import { createMemoryArchive, CompressionLevel } from "zip-bun";

const writer = createMemoryArchive();

// Add files to memory-based archive
const textData = new TextEncoder().encode("Hello, World!");
writer.addFile("hello.txt", textData, CompressionLevel.DEFAULT);

const jsonData = new TextEncoder().encode('{"key": "value"}');
writer.addFile("data.json", jsonData, CompressionLevel.BEST_COMPRESSION);

// Get the ZIP data as Uint8Array
const zipData = writer.finalizeToMemory();

// Use the data
await Bun.write("output.zip", zipData);
// or send over network
// await fetch("https://api.example.com/upload", {
//   method: "POST",
//   body: zipData
// });
```

#### Creating a ZIP from Directory in Memory

```typescript
import { zipDirectoryToMemory, CompressionLevel } from "zip-bun";

// Create a ZIP from a directory in memory
const zipData = await zipDirectoryToMemory("my-project", CompressionLevel.BEST_COMPRESSION);

// Use the memory-based ZIP data
await Bun.write("project.zip", zipData);
```

#### Working with Different Data Types

```typescript
import { createMemoryArchive } from "zip-bun";

const writer = createMemoryArchive();

// Uint8Array
const uint8Data = new Uint8Array([1, 2, 3, 4, 5]);
writer.addFile("data.bin", uint8Data);

// ArrayBuffer
const arrayBuffer = new ArrayBuffer(8);
const view = new DataView(arrayBuffer);
view.setInt32(0, 42, true);
writer.addFile("config.bin", arrayBuffer);

// DataView
const dataView = new DataView(new ArrayBuffer(4));
dataView.setFloat32(0, 3.14, true);
writer.addFile("float.bin", dataView);

const zipData = writer.finalizeToMemory();
```

### Advanced Usage

#### Finding and Extracting Specific Files

```typescript
import { openArchive } from "zip-bun";

const reader = openArchive("archive.zip");

// Find a specific file
const index = reader.findFile("config.json");
if (index >= 0) {
  const data = reader.extractFile(index);
  const config = JSON.parse(new TextDecoder().decode(data));
  console.log("Config:", config);
} else {
  console.log("config.json not found");
}

// Or extract directly by name
try {
  const data = reader.extractFileByName("config.json");
  const config = JSON.parse(new TextDecoder().decode(data));
  console.log("Config:", config);
} catch (error) {
  console.log("config.json not found");
}

reader.close();
```

#### Working with File Information

```typescript
import { openArchive } from "zip-bun";

const reader = openArchive("archive.zip");

for (let i = 0; i < reader.getFileCount(); i++) {
  const fileInfo = reader.getFileInfo(i);
  
  console.log(`File: ${fileInfo.filename}`);
  console.log(`  Size: ${fileInfo.uncompressedSize} bytes`);
  console.log(`  Compressed: ${fileInfo.compressedSize} bytes`);
  console.log(`  Compression ratio: ${((1 - fileInfo.compressedSize / fileInfo.uncompressedSize) * 100).toFixed(1)}%`);
  console.log(`  Directory: ${fileInfo.directory}`);
  console.log(`  Encrypted: ${fileInfo.encrypted}`);
  console.log(`  Comment: ${fileInfo.comment}`);
}

reader.close();
```

#### Error Handling

```typescript
import { createArchive, openArchive } from "zip-bun";

// Error handling for file-based operations
try {
  const writer = createArchive("output.zip");
  writer.addFile("test.txt", new TextEncoder().encode("Hello"));
  writer.finalize();
} catch (error) {
  console.error("Failed to create ZIP:", error.message);
}

// Error handling for memory-based operations
try {
  const writer = createMemoryArchive();
  writer.addFile("test.txt", new TextEncoder().encode("Hello"));
  const data = writer.finalizeToMemory();
} catch (error) {
  console.error("Failed to create memory ZIP:", error.message);
}

// Error handling for reading
try {
  const reader = openArchive("nonexistent.zip");
  reader.close();
} catch (error) {
  console.error("Failed to open ZIP:", error.message);
}
```

## Performance

This library provides excellent performance through:

- **Native C Bindings**: Direct calls to the miniz library
- **Zero-Copy Operations**: Efficient memory management
- **Streaming Compression**: Large files are handled efficiently
- **Optimized Algorithms**: Uses proven compression algorithms
- **Memory-Based Operations**: Avoid disk I/O for in-memory processing

### Benchmarks

| Operation | File Size | Time |
|-----------|-----------|------|
| Create ZIP | 1MB | ~50ms |
| Create Memory ZIP | 1MB | ~45ms |
| Extract ZIP | 1MB | ~30ms |
| Compress (BEST) | 1MB | ~100ms |
| Compress (SPEED) | 1MB | ~20ms |
| Directory to ZIP | 10MB | ~200ms |
| Directory to Memory ZIP | 10MB | ~180ms |

## Development

### Running Tests

```bash
# Run all tests
bun test

# Run tests with coverage
bun test --coverage

# Run specific test file
bun test zip.test.ts
```

### Building

```bash
# Build the project
bun run build
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [miniz](https://github.com/richgel999/miniz) - The underlying compression library
- [bun](https://bun.sh/) - The JavaScript runtime and C compiler
