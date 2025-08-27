export interface ZipFileInfo {
  filename: string;
  comment: string;

  uncompressedSize: number;
  compressedSize: number;

  directory: boolean;
  encrypted: boolean;
}

export type FileData = NodeJS.TypedArray | ArrayBufferLike | DataView;
