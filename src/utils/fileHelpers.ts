/**
 * File import/export utilities
 */

import { ExtractedItem } from './extractionHelpers';

/**
 * Download file to user's computer
 */
export function downloadFile(data: string, filename: string): void {
  try {
    const blob = new Blob([data], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Download error:', error);
    throw new Error('Failed to download file');
  }
}

/**
 * Generate output filename with suffix
 */
export function generateOutputFileName(originalName: string, suffix: string): string {
  const lastDot = originalName.lastIndexOf('.');
  if (lastDot === -1) {
    return `${originalName}${suffix}`;
  }
  const name = originalName.substring(0, lastDot);
  const ext = originalName.substring(lastDot);
  return `${name}${suffix}${ext}`;
}

/**
 * Export extracted data to CSV format
 */
export function exportToCSV(data: ExtractedItem[], translationMap: Map<string, string>): string {
  const rows: string[] = ['Term,Original Text,Translation'];

  for (const item of data) {
    const translation = translationMap.get(item.term) || '';
    
    const escapedTerm = escapeCSV(item.term);
    const escapedOriginal = escapeCSV(item.originalText);
    const escapedTranslation = escapeCSV(translation);
    
    rows.push(`${escapedTerm},${escapedOriginal},${escapedTranslation}`);
  }

  return rows.join('\n');
}

/**
 * Export extracted data to JSON format
 */
export function exportToJSON(data: ExtractedItem[], translationMap: Map<string, string>): string {
  const output = data.map(item => ({
    term: item.term,
    originalText: item.originalText,
    translation: translationMap.get(item.term) || '',
  }));

  return JSON.stringify(output, null, 2);
}

/**
 * Export extracted data to plain text format
 */
export function exportToText(data: ExtractedItem[], translationMap: Map<string, string>): string {
  const lines: string[] = [];

  for (const item of data) {
    lines.push(`#Term: ${item.term}`);
    lines.push(`Original: ${item.originalText}`);
    
    const translation = translationMap.get(item.term);
    if (translation) {
      lines.push(`Translation: ${translation}`);
    }
    
    lines.push(''); // Empty line between items
  }

  return lines.join('\n');
}

/**
 * Escape text for CSV format
 */
function escapeCSV(text: string): string {
  if (!text) return '""';
  
  // If text contains comma, quote, or newline, wrap in quotes and escape quotes
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  
  return text;
}

/**
 * Read file as text
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content === 'string') {
        resolve(content);
      } else {
        reject(new Error('Failed to read file as text'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('File read error'));
    };
    
    reader.readAsText(file, 'utf-8');
  });
}

/**
 * Validate file type
 */
export function isValidFileType(filename: string): boolean {
  const validExtensions = ['.txt', '.json', '.csv', '.tsv'];
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return validExtensions.includes(ext);
}

/**
 * Validate file size (max 50MB)
 */
export function isValidFileSize(size: number, maxSize: number = 50 * 1024 * 1024): boolean {
  return size > 0 && size <= maxSize;
}
