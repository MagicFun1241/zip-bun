// Use the new bytes function approach with intelligent buffer sizing
// Start with a reasonable buffer size and increase if needed
export const bufferSizes = [
  10 * 1024 * 1024, // 10MB
  50 * 1024 * 1024, // 50MB
  100 * 1024 * 1024, // 100MB
  500 * 1024 * 1024, // 500MB
  1024 * 1024 * 1024, // 1GB
];
