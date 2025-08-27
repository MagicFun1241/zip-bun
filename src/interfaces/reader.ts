import type { ZipFileInfo } from "./file.ts";

export interface ZipReader {
  getFileCount(): number;
  getFileInfo(index: number): ZipFileInfo;
  extractFile(index: number): Uint8Array;
  extractFileByName(filename: string): Uint8Array;
  findFile(filename: string): number;
  close(): boolean;
}
