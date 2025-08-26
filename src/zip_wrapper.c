#include <string.h>
#include <stdlib.h>
#include <stdio.h>

// Compiler optimizations
#ifdef __GNUC__
#define LIKELY(x) __builtin_expect(!!(x), 1)
#define UNLIKELY(x) __builtin_expect(!!(x), 0)
#else
#define LIKELY(x) (x)
#define UNLIKELY(x) (x)
#endif

// Inline small functions for better performance
#ifdef __GNUC__
#define INLINE __attribute__((always_inline)) inline
#elif defined(_MSC_VER)
#define INLINE __forceinline
#else
#define INLINE inline
#endif

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

// Memory pool for zip handles to reduce malloc/free overhead
#define MAX_HANDLES 100
#define HANDLE_POOL_SIZE 20

static zip_handle_t* zip_handles[MAX_HANDLES] = {NULL};
static int next_handle_id = 0;

// Memory pool for frequently allocated handles
static zip_handle_t handle_pool[HANDLE_POOL_SIZE];
static int pool_used[HANDLE_POOL_SIZE] = {0};

// Get a handle from the pool or allocate new one
static INLINE zip_handle_t* get_handle_from_pool() {
    for (int i = 0; i < HANDLE_POOL_SIZE; i++) {
        if (LIKELY(!pool_used[i])) {
            pool_used[i] = 1;
            return &handle_pool[i];
        }
    }
    // Pool exhausted, fall back to malloc
    return (zip_handle_t*)malloc(sizeof(zip_handle_t));
}

// Return handle to pool or free it
static INLINE void return_handle_to_pool(zip_handle_t* handle) {
    for (int i = 0; i < HANDLE_POOL_SIZE; i++) {
        if (LIKELY(&handle_pool[i] == handle)) {
            pool_used[i] = 0;
            return;
        }
    }
    // Not from pool, free it
    free(handle);
}

// Create a new zip archive
int create_zip(const char* filename) {
    if (next_handle_id >= MAX_HANDLES) return -1;
    
    zip_handle_t* handle = get_handle_from_pool();
    if (!handle) return -1;
    
    // Use calloc-like behavior without memset
    handle->is_writer = 1;
    handle->archive = (mz_zip_archive){0}; // Zero-initialize struct
    
    mz_bool status = mz_zip_writer_init_file(&handle->archive, filename, 0);
    
    if (!status) {
        return_handle_to_pool(handle);
        return -1;
    }
    
    zip_handles[next_handle_id] = handle;
    return next_handle_id++;
}

// Add a file to zip archive
int add_file_to_zip(int handle_id, const char* filename, const void* data, size_t data_length, int compression_level) {
    if (UNLIKELY(handle_id < 0 || handle_id >= MAX_HANDLES || !zip_handles[handle_id] || !zip_handles[handle_id]->is_writer)) {
        return 0;
    }
    
    zip_handle_t* handle = zip_handles[handle_id];
    mz_bool status = mz_zip_writer_add_mem(&handle->archive, filename, data, data_length, compression_level);
    return status ? 1 : 0;
}

// Finalize and close zip archive
int finalize_zip(int handle_id) {
    if (handle_id < 0 || handle_id >= MAX_HANDLES || !zip_handles[handle_id] || !zip_handles[handle_id]->is_writer) {
        return 0;
    }
    
    zip_handle_t* handle = zip_handles[handle_id];
    mz_bool status = mz_zip_writer_finalize_archive(&handle->archive);
    mz_zip_writer_end(&handle->archive);
    
    return_handle_to_pool(handle);
    zip_handles[handle_id] = NULL;
    
    return status ? 1 : 0;
}

// Open an existing zip archive for reading
int open_zip(const char* filename) {
    if (next_handle_id >= MAX_HANDLES) return -1;
    
    zip_handle_t* handle = get_handle_from_pool();
    if (!handle) return -1;
    
    handle->is_writer = 0;
    handle->archive = (mz_zip_archive){0}; // Zero-initialize struct
    
    mz_bool status = mz_zip_reader_init_file(&handle->archive, filename, 0);
    
    if (!status) {
        return_handle_to_pool(handle);
        return -1;
    }
    
    zip_handles[next_handle_id] = handle;
    return next_handle_id++;
}

// Get number of files in zip archive
int get_file_count(int handle_id) {
    if (handle_id < 0 || handle_id >= MAX_HANDLES || !zip_handles[handle_id] || zip_handles[handle_id]->is_writer) {
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
    if (handle_id < 0 || handle_id >= MAX_HANDLES || !zip_handles[handle_id] || zip_handles[handle_id]->is_writer) {
        return 0;
    }
    
    zip_handle_t* handle = zip_handles[handle_id];
    mz_zip_archive_file_stat file_stat;
    mz_bool status = mz_zip_reader_file_stat(&handle->archive, file_index, &file_stat);
    
    if (!status) return 0;
    
    // Optimize string copying with length checks
    size_t filename_len = strlen(file_stat.m_filename);
    size_t comment_len = strlen(file_stat.m_comment);
    
    if (filename_len >= 256) filename_len = 255;
    if (comment_len >= 256) comment_len = 255;
    
    memcpy(info->filename, file_stat.m_filename, filename_len);
    info->filename[filename_len] = '\0';
    
    memcpy(info->comment, file_stat.m_comment, comment_len);
    info->comment[comment_len] = '\0';
    
    info->uncompressed_size = file_stat.m_uncomp_size;
    info->compressed_size = file_stat.m_comp_size;
    info->is_directory = mz_zip_reader_is_file_a_directory(&handle->archive, file_index) ? 1 : 0;
    info->is_encrypted = mz_zip_reader_is_file_encrypted(&handle->archive, file_index) ? 1 : 0;
    
    return 1;
}

// Extract file from zip archive
void* extract_file(int handle_id, int file_index, size_t* size) {
    if (handle_id < 0 || handle_id >= MAX_HANDLES || !zip_handles[handle_id] || zip_handles[handle_id]->is_writer) {
        return NULL;
    }
    
    zip_handle_t* handle = zip_handles[handle_id];
    void* data = mz_zip_reader_extract_to_heap(&handle->archive, file_index, size, 0);
    return data;
}

// Close zip archive reader
int close_zip(int handle_id) {
    if (handle_id < 0 || handle_id >= MAX_HANDLES || !zip_handles[handle_id] || zip_handles[handle_id]->is_writer) {
        return 0;
    }
    
    zip_handle_t* handle = zip_handles[handle_id];
    mz_bool status = mz_zip_reader_end(&handle->archive);
    
    return_handle_to_pool(handle);
    zip_handles[handle_id] = NULL;
    
    return status ? 1 : 0;
}

// Find file by name in zip archive
int find_file(int handle_id, const char* filename) {
    if (handle_id < 0 || handle_id >= MAX_HANDLES || !zip_handles[handle_id] || zip_handles[handle_id]->is_writer) {
        return -1;
    }
    
    zip_handle_t* handle = zip_handles[handle_id];
    return mz_zip_reader_locate_file(&handle->archive, filename, NULL, 0);
}

// Extract file by name
void* extract_file_by_name(int handle_id, const char* filename, size_t* size) {
    if (handle_id < 0 || handle_id >= MAX_HANDLES || !zip_handles[handle_id] || zip_handles[handle_id]->is_writer) {
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

// Optimized function to extract file data directly to a buffer
int extract_file_to_buffer(int handle_id, int file_index, void* output_buffer, size_t buffer_size) {
    if (handle_id < 0 || handle_id >= MAX_HANDLES || !zip_handles[handle_id] || zip_handles[handle_id]->is_writer) {
        return -1;
    }
    
    zip_handle_t* handle = zip_handles[handle_id];
    size_t extracted_size = 0;
    
    mz_bool status = mz_zip_reader_extract_to_mem(&handle->archive, file_index, output_buffer, buffer_size, 0);
    
    if (!status) return -1;
    
    // Get the actual size of the extracted data
    mz_zip_archive_file_stat file_stat;
    if (mz_zip_reader_file_stat(&handle->archive, file_index, &file_stat)) {
        extracted_size = file_stat.m_uncomp_size;
    }
    
    return (int)extracted_size;
}

// Create a new zip archive in memory
int create_zip_in_memory() {
    if (next_handle_id >= MAX_HANDLES) return -1;
    
    zip_handle_t* handle = get_handle_from_pool();
    if (!handle) return -1;
    
    handle->is_writer = 1;
    handle->archive = (mz_zip_archive){0}; // Zero-initialize struct
    
    mz_bool status = mz_zip_writer_init_heap(&handle->archive, 0, 0);
    
    if (!status) {
        return_handle_to_pool(handle);
        return -1;
    }
    
    zip_handles[next_handle_id] = handle;
    return next_handle_id++;
}

// Return data directly as bytes
int finalize_zip_in_memory_bytes(int handle_id, void* output_buffer, size_t buffer_size) {
    if (handle_id < 0 || handle_id >= MAX_HANDLES || !zip_handles[handle_id] || !zip_handles[handle_id]->is_writer) {
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
    
    return_handle_to_pool(handle);
    zip_handles[handle_id] = NULL;
    
    return (int)size;
}



// Open a zip archive from memory
int open_zip_from_memory(const void* data, size_t size) {
    if (next_handle_id >= MAX_HANDLES) return -1;
    
    zip_handle_t* handle = get_handle_from_pool();
    if (!handle) return -1;
    
    handle->is_writer = 0;
    handle->archive = (mz_zip_archive){0}; // Zero-initialize struct
    
    // Use the correct miniz function for memory-based reading
    mz_bool status = mz_zip_reader_init_mem(&handle->archive, data, size, 0);
    
    if (!status) {
        return_handle_to_pool(handle);
        return -1;
    }
    
    zip_handles[next_handle_id] = handle;
    return next_handle_id++;
}

