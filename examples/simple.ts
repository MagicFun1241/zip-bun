#!/usr/bin/env bun

import { CompressionLevel, createArchive, openArchive } from "zip-bun";

console.log("Bun Zip Library Example\n");

// Example 1: Creating a ZIP archive
console.log("Creating a ZIP archive...");
const writer = createArchive("example.zip");

// Add different types of files with different compression levels
const textData = new TextEncoder().encode("Hello, World! This is a text file.");
writer.addFile("hello.txt", textData, CompressionLevel.DEFAULT);

const jsonData = new TextEncoder().encode(
  '{"message": "Hello from JSON!", "timestamp": "' +
    new Date().toISOString() +
    '"}',
);
writer.addFile("data.json", jsonData, CompressionLevel.BEST_COMPRESSION);

const binaryData = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]); // PNG header
writer.addFile("sample.png", binaryData, CompressionLevel.BEST_SPEED);

writer.finalize();
console.log("ZIP archive created successfully!\n");

// Example 2: Reading and extracting from a ZIP archive
console.log("Reading the ZIP archive...");
const reader = openArchive("example.zip");

console.log(`Archive contains ${reader.getFileCount()} files:\n`);

// List all files and their information
for (let i = 0; i < reader.getFileCount(); i++) {
  const fileInfo = reader.getFileInfo(i);
  console.log(`${fileInfo.filename}`);
  console.log(
    `   Size: ${fileInfo.uncompressedSize} bytes (compressed: ${fileInfo.compressedSize} bytes)`,
  );
  console.log(`   Directory: ${fileInfo.directory ? "Yes" : "No"}`);
  console.log(`   Encrypted: ${fileInfo.encrypted ? "Yes" : "No"}`);
  console.log("");
}

// Extract and display the text file
console.log("Extracting hello.txt...");
const extractedText = reader.extractFileByName("hello.txt");
const text = new TextDecoder().decode(extractedText);
console.log(`Content: "${text}"\n`);

// Extract and parse the JSON file
console.log("Extracting data.json...");
const extractedJson = reader.extractFileByName("data.json");
const jsonText = new TextDecoder().decode(extractedJson);
const json = JSON.parse(jsonText);
console.log(`JSON data:`, json);
console.log("");

// Find a file by name
console.log("Finding files by name...");
const textIndex = reader.findFile("hello.txt");
console.log(`hello.txt found at index: ${textIndex}`);

const notFoundIndex = reader.findFile("nonexistent.txt");
console.log(`nonexistent.txt found at index: ${notFoundIndex} (not found)\n`);

reader.close();
console.log("ZIP archive reading completed!");

console.log("\nExample completed successfully!");
console.log("The example.zip file has been created in the current directory.");
