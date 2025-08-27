export const CompressionLevel = {
  NO_COMPRESSION: 0,
  BEST_SPEED: 1,
  BEST_COMPRESSION: 9,
  DEFAULT: 6,
} as const;

export type CompressionLevelType =
  (typeof CompressionLevel)[keyof typeof CompressionLevel];
