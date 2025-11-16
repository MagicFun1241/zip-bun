import { cc } from "bun:ffi";
import { join } from "node:path";

function getIncludePath(): string | null {
  // Attempt to get the directory of the current module
  if (import.meta && import.meta.dir) {
    return import.meta.dir;
  }

  // Fallback to a default path (adjust as necessary)
  const defaultPath = join(process.cwd(), "node_modules/zip-bun/dist");
  return defaultPath || null;
}

const includePath = getIncludePath();
if (!includePath) {
  throw new Error("Could not determine include path for zip-bun");
}

const wrapperPath = join(includePath, "zip_wrapper.c");

// Compile the C code with all the zip functions
export const { symbols } = cc({
  source: wrapperPath,
  include: [includePath],
  symbols: {
    create_zip: {
      args: ["cstring"],
      returns: "i32",
    },
    add_file_to_zip: {
      args: ["i32", "cstring", "ptr", "u64", "i32"],
      returns: "i32",
    },
    finalize_zip: {
      args: ["i32"],
      returns: "i32",
    },
    create_zip_in_memory: {
      args: [],
      returns: "i32",
    },
    get_zip_final_size: {
      args: ["i32"],
      returns: "i32",
    },
    finalize_zip_in_memory_bytes: {
      args: ["i32", "ptr", "u64"],
      returns: "i32",
    },
    open_zip: {
      args: ["cstring"],
      returns: "i32",
    },
    open_zip_from_memory: {
      args: ["ptr", "u64"],
      returns: "i32",
    },
    get_file_count: {
      args: ["i32"],
      returns: "i32",
    },
    get_file_info: {
      args: ["i32", "i32", "ptr"],
      returns: "i32",
    },
    extract_file: {
      args: ["i32", "i32", "ptr"],
      returns: "ptr",
    },
    close_zip: {
      args: ["i32"],
      returns: "i32",
    },
    find_file: {
      args: ["i32", "cstring"],
      returns: "i32",
    },
    extract_file_by_name: {
      args: ["i32", "cstring", "ptr"],
      returns: "ptr",
    },
    free_extracted_data: {
      args: ["ptr"],
      returns: "void",
    },
    extract_file_to_buffer: {
      args: ["i32", "i32", "ptr", "u64"],
      returns: "i32",
    },
  },
});
