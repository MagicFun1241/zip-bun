import type { ZipFile } from "./file.ts";

export interface ZipReader {
  getFileCount(): number;
  getFileByIndex(index: number): ZipFile;

  extractFile(index: number): Uint8Array;
  readFile(index: number): Uint8Array;

  extractFileArrayBuffer(index: number): ArrayBuffer;
  extractFileBuffer(index: number): Buffer;
  readFileArrayBuffer(index: number): ArrayBuffer;
  readFileBuffer(index: number): Buffer;

  extractFileByName(filename: string): Uint8Array;
  readFileByName(filename: string): Uint8Array;

  findFile(filename: string): number;
  close(): boolean;
}
