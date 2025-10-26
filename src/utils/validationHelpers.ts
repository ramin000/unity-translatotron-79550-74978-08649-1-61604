/**
 * Validation utilities for file and input validation
 */

/**
 * Check if filename is valid
 */
export function isValidFileName(name: string): boolean {
  if (!name || typeof name !== 'string') {
    return false;
  }
  
  // Check length
  if (name.length === 0 || name.length > 255) {
    return false;
  }
  
  // Check for invalid characters
  const invalidChars = /[<>:"|?*\x00-\x1F]/;
  if (invalidChars.test(name)) {
    return false;
  }
  
  return true;
}

/**
 * Check if file type is supported
 */
export function isSupportedFileType(filename: string): boolean {
  const supportedExtensions = ['.txt', '.json', '.csv', '.tsv'];
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return supportedExtensions.includes(ext);
}

/**
 * Check if file size is acceptable (default max: 50MB)
 */
export function isAcceptableSize(size: number, maxSize: number = 50 * 1024 * 1024): boolean {
  return typeof size === 'number' && size > 0 && size <= maxSize;
}

/**
 * Validate language index
 */
export function isValidLanguageIndex(index: number): boolean {
  return typeof index === 'number' && index >= 0 && index <= 12;
}

/**
 * Validate search query
 */
export function isValidSearchQuery(query: string): boolean {
  if (typeof query !== 'string') {
    return false;
  }
  
  // Allow empty queries (clear search)
  if (query.length === 0) {
    return true;
  }
  
  // Limit max length
  if (query.length > 500) {
    return false;
  }
  
  return true;
}

/**
 * Validate translation map
 */
export function isValidTranslationMap(map: any): map is Map<string, string> {
  return map instanceof Map;
}

/**
 * Sanitize filename for download
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, '_')
    .substring(0, 255);
}

/**
 * Validate file before upload
 */
export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export function validateFileForUpload(file: File): FileValidationResult {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }
  
  if (!isValidFileName(file.name)) {
    return { valid: false, error: 'Invalid filename' };
  }
  
  if (!isSupportedFileType(file.name)) {
    return { valid: false, error: 'Unsupported file type. Please use .txt, .json, .csv, or .tsv files' };
  }
  
  if (!isAcceptableSize(file.size)) {
    return { valid: false, error: 'File size exceeds 50MB limit' };
  }
  
  return { valid: true };
}
