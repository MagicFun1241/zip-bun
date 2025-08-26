#include <string.h>
#include <stdlib.h>
#include <stdio.h>

// Platform detection and fixes
#ifdef __APPLE__
#define __APPLE__ 1
#undef __MINGW32__
#undef __MINGW64__
#undef _MSC_VER
#undef _WIN32
#undef WIN32
#undef __USE_LARGEFILE64
#undef __TINYC__
#undef __WATCOMC__
#endif

// Define the necessary macros to enable zip functionality
// Note: We need deflate APIs for compression, so we don't define MINIZ_NO_ZLIB_APIS

// Force the correct platform path in miniz.c
#ifndef __APPLE__
#define __APPLE__ 1
#endif

#include "miniz.c"

// Global storage for zip archives
typedef struct {
    mz_zip_archive archive;
    int is_writer;
} zip_handle_t;

static zip_handle_t* zip_handles[100] = {NULL};
static int next_handle_id = 0;

// Create a new zip archive
int create_zip(const char* filename) {
    if (next_handle_id >= 100) return -1;
    
    zip_handle_t* handle = (zip_handle_t*)malloc(sizeof(zip_handle_t));
    if (!handle) return -1;
    
    memset(handle, 0, sizeof(zip_handle_t));
    handle->is_writer = 1;
    
    mz_bool status = mz_zip_writer_init_file(&handle->archive, filename, 0);
    
    if (!status) {
        free(handle);
        return -1;
    }
    
    zip_handles[next_handle_id] = handle;
    return next_handle_id++;
}

// Add a file to zip archive
int add_file_to_zip(int handle_id, const char* filename, const void* data, size_t data_length, int compression_level) {
    if (handle_id < 0 || handle_id >= 100 || !zip_handles[handle_id] || !zip_handles[handle_id]->is_writer) {
        return 0;
    }
    
    zip_handle_t* handle = zip_handles[handle_id];
    mz_bool status = mz_zip_writer_add_mem(&handle->archive, filename, data, data_length, compression_level);
    return status ? 1 : 0;
}

// Finalize and close zip archive
int finalize_zip(int handle_id) {
    if (handle_id < 0 || handle_id >= 100 || !zip_handles[handle_id] || !zip_handles[handle_id]->is_writer) {
        return 0;
    }
    
    zip_handle_t* handle = zip_handles[handle_id];
    mz_bool status = mz_zip_writer_finalize_archive(&handle->archive);
    mz_zip_writer_end(&handle->archive);
    
    free(handle);
    zip_handles[handle_id] = NULL;
    
    return status ? 1 : 0;
}

// Open an existing zip archive for reading
int open_zip(const char* filename) {
    if (next_handle_id >= 100) return -1;
    
    zip_handle_t* handle = (zip_handle_t*)malloc(sizeof(zip_handle_t));
    if (!handle) return -1;
    
    memset(handle, 0, sizeof(zip_handle_t));
    handle->is_writer = 0;
    
    mz_bool status = mz_zip_reader_init_file(&handle->archive, filename, 0);
    
    if (!status) {
        free(handle);
        return -1;
    }
    
    zip_handles[next_handle_id] = handle;
    return next_handle_id++;
}

// Get number of files in zip archive
int get_file_count(int handle_id) {
    if (handle_id < 0 || handle_id >= 100 || !zip_handles[handle_id] || zip_handles[handle_id]->is_writer) {
        return -1;
    }
    
    zip_handle_t* handle = zip_handles[handle_id];
    return (int)mz_zip_reader_get_num_files(&handle->archive);
}

// Get file info by index
typedef struct {
    char filename[256];
    char comment[256];
    size_t uncompressed_size;
    size_t compressed_size;
    int is_directory;
    int is_encrypted;
} file_info_t;

int get_file_info(int handle_id, int file_index, file_info_t* info) {
    if (handle_id < 0 || handle_id >= 100 || !zip_handles[handle_id] || zip_handles[handle_id]->is_writer) {
        return 0;
    }
    
    zip_handle_t* handle = zip_handles[handle_id];
    mz_zip_archive_file_stat file_stat;
    mz_bool status = mz_zip_reader_file_stat(&handle->archive, file_index, &file_stat);
    
    if (!status) return 0;
    
    strncpy(info->filename, file_stat.m_filename, 255);
    info->filename[255] = '\0';
    strncpy(info->comment, file_stat.m_comment, 255);
    info->comment[255] = '\0';
    info->uncompressed_size = file_stat.m_uncomp_size;
    info->compressed_size = file_stat.m_comp_size;
    info->is_directory = mz_zip_reader_is_file_a_directory(&handle->archive, file_index) ? 1 : 0;
    info->is_encrypted = mz_zip_reader_is_file_encrypted(&handle->archive, file_index) ? 1 : 0;
    
    return 1;
}

// Extract file from zip archive
void* extract_file(int handle_id, int file_index, size_t* size) {
    if (handle_id < 0 || handle_id >= 100 || !zip_handles[handle_id] || zip_handles[handle_id]->is_writer) {
        return NULL;
    }
    
    zip_handle_t* handle = zip_handles[handle_id];
    void* data = mz_zip_reader_extract_to_heap(&handle->archive, file_index, size, 0);
    return data;
}

// Close zip archive reader
int close_zip(int handle_id) {
    if (handle_id < 0 || handle_id >= 100 || !zip_handles[handle_id] || zip_handles[handle_id]->is_writer) {
        return 0;
    }
    
    zip_handle_t* handle = zip_handles[handle_id];
    mz_bool status = mz_zip_reader_end(&handle->archive);
    
    free(handle);
    zip_handles[handle_id] = NULL;
    
    return status ? 1 : 0;
}

// Find file by name in zip archive
int find_file(int handle_id, const char* filename) {
    if (handle_id < 0 || handle_id >= 100 || !zip_handles[handle_id] || zip_handles[handle_id]->is_writer) {
        return -1;
    }
    
    zip_handle_t* handle = zip_handles[handle_id];
    return mz_zip_reader_locate_file(&handle->archive, filename, NULL, 0);
}

// Extract file by name
void* extract_file_by_name(int handle_id, const char* filename, size_t* size) {
    if (handle_id < 0 || handle_id >= 100 || !zip_handles[handle_id] || zip_handles[handle_id]->is_writer) {
        return NULL;
    }
    
    zip_handle_t* handle = zip_handles[handle_id];
    int file_index = mz_zip_reader_locate_file(&handle->archive, filename, NULL, 0);
    
    if (file_index < 0) return NULL;
    
    return mz_zip_reader_extract_to_heap(&handle->archive, file_index, size, 0);
}

// Helper function to free extracted data
void free_extracted_data(void* data) {
    if (data) {
        free(data);
    }
}

// Create a new zip archive in memory
int create_zip_in_memory() {
    if (next_handle_id >= 100) return -1;
    
    zip_handle_t* handle = (zip_handle_t*)malloc(sizeof(zip_handle_t));
    if (!handle) return -1;
    
    memset(handle, 0, sizeof(zip_handle_t));
    handle->is_writer = 1;
    
    mz_bool status = mz_zip_writer_init_heap(&handle->archive, 0, 0);
    
    if (!status) {
        free(handle);
        return -1;
    }
    
    zip_handles[next_handle_id] = handle;
    return next_handle_id++;
}

// Get the memory buffer and size from a memory-based zip
typedef struct {
    void* data;
    size_t size;
} memory_zip_result_t;

// Alternative approach: Return data directly as bytes
int finalize_zip_in_memory_bytes(int handle_id, void* output_buffer, size_t buffer_size) {
    if (handle_id < 0 || handle_id >= 100 || !zip_handles[handle_id] || !zip_handles[handle_id]->is_writer) {
        return -1;
    }
    
    zip_handle_t* handle = zip_handles[handle_id];
    
    // Use mz_zip_writer_finalize_heap_archive but handle the data differently
    void* data = NULL;
    size_t size = 0;
    
    mz_bool status = mz_zip_writer_finalize_heap_archive(&handle->archive, &data, &size);
    if (!status || !data || size == 0) {
        return -1;
    }
    
    // Check if buffer is large enough
    if (buffer_size < size) {
        return -2; // Buffer too small
    }
    
    // Copy the data directly to the output buffer
    memcpy(output_buffer, data, size);
    
    // End the writer
    mz_zip_writer_end(&handle->archive);
    
    free(handle);
    zip_handles[handle_id] = NULL;
    
    return (int)size;
}

memory_zip_result_t* finalize_zip_in_memory(int handle_id) {
    if (handle_id < 0 || handle_id >= 100 || !zip_handles[handle_id] || !zip_handles[handle_id]->is_writer) {
        return NULL;
    }
    
    zip_handle_t* handle = zip_handles[handle_id];
    
    // Use mz_zip_writer_finalize_heap_archive but handle the data differently
    void* data = NULL;
    size_t size = 0;
    
    mz_bool status = mz_zip_writer_finalize_heap_archive(&handle->archive, &data, &size);
    if (!status || !data || size == 0) {
        return NULL;
    }
    
    // Copy the data to our own buffer
    void* copied_data = malloc(size);
    if (!copied_data) {
        return NULL;
    }
    memcpy(copied_data, data, size);
    
    // Create result structure
    memory_zip_result_t* result = (memory_zip_result_t*)malloc(sizeof(memory_zip_result_t));
    if (result) {
        result->data = copied_data;
        result->size = size;
    } else {
        free(copied_data);
    }
    
    // End the writer
    mz_zip_writer_end(&handle->archive);
    
    free(handle);
    zip_handles[handle_id] = NULL;
    
    return result;
}

// Free memory zip result
void free_memory_zip_result(memory_zip_result_t* result) {
    if (result) {
        if (result->data) {
            free(result->data);
        }
        free(result);
    }
}

// Open a zip archive from memory
int open_zip_from_memory(const void* data, size_t size) {
    if (next_handle_id >= 100) return -1;
    
    zip_handle_t* handle = (zip_handle_t*)malloc(sizeof(zip_handle_t));
    if (!handle) return -1;
    
    memset(handle, 0, sizeof(zip_handle_t));
    handle->is_writer = 0;
    
    // Use the correct miniz function for memory-based reading
    mz_bool status = mz_zip_reader_init_mem(&handle->archive, data, size, 0);
    
    if (!status) {
        free(handle);
        return -1;
    }
    
    zip_handles[next_handle_id] = handle;
    return next_handle_id++;
}

