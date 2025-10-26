/**
 * Extraction utilities for Unity I2 translation files
 */

import { applyRTLFormatting } from './rtlHelpers';

export interface ExtractedItem {
  term: string;
  originalText: string;
  dataLineIndex?: number;
  linePrefix?: string;
}

const REGEX = {
  TERM: /^#Term:\s*(.+)$/,
  DATA: /^\s*(\d+)\s+string\s+data\s*=\s*"((?:[^"\\]|\\.)*)"\s*$/,
  BRACKETED_NUM: /^\[(\d+)\]$/,
  BOM: /^\uFEFF/,
};

/**
 * Normalize file content (remove BOM, normalize line endings)
 */
export function normalizeFileContent(content: string): string {
  return content.replace(REGEX.BOM, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Extract terms from Unity I2 file content
 */
export async function extractTermsChunked(
  content: string,
  targetIndex: number,
  onProgress?: (progress: number) => void
): Promise<ExtractedItem[]> {
  const normalized = normalizeFileContent(content);
  const lines = normalized.split('\n');
  const results: ExtractedItem[] = [];
  
  let currentTerm = '';
  let dataLinesEncountered = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check if this is a term definition
    const termMatch = line.match(REGEX.TERM);
    if (termMatch) {
      currentTerm = termMatch[1];
      dataLinesEncountered = 0;
      continue;
    }

    // Check if this is a data line with bracketed number
    const bracketMatch = line.match(REGEX.BRACKETED_NUM);
    if (bracketMatch) {
      const nextLine = lines[i + 1];
      if (nextLine) {
        const dataMatch = nextLine.trim().match(REGEX.DATA);
        if (dataMatch) {
          const [, indexStr, dataStr] = dataMatch;
          const idx = parseInt(indexStr, 10);

          if (idx === targetIndex && currentTerm) {
            // Unescape the string data
            const unescaped = dataStr
              .replace(/\\n/g, '\n')
              .replace(/\\t/g, '\t')
              .replace(/\\r/g, '\r')
              .replace(/\\"/g, '"')
              .replace(/\\\\/g, '\\');

            results.push({
              term: currentTerm,
              originalText: unescaped,
              dataLineIndex: i + 1,
              linePrefix: `  ${indexStr} string data = "`,
            });
          }

          dataLinesEncountered++;
          i++; // Skip the data line since we processed it
        }
      }
    }

    // Report progress every 1000 lines
    if (onProgress && i % 1000 === 0) {
      const progress = Math.round((i / lines.length) * 100);
      onProgress(progress);
    }
  }

  if (onProgress) {
    onProgress(100);
  }

  return results;
}

/**
 * Parse translation map from various formats (TSV, JSON, CSV, plain text)
 */
export function parseTranslations(content: string): Map<string, string> {
  const map = new Map<string, string>();
  
  if (!content.trim()) {
    return map;
  }

  try {
    // Try JSON format first
    const parsed = JSON.parse(content);
    if (typeof parsed === 'object' && parsed !== null) {
      Object.entries(parsed).forEach(([key, value]) => {
        if (typeof value === 'string') {
          map.set(key, value);
        }
      });
      return map;
    }
  } catch {
    // Not JSON, continue to other formats
  }

  const lines = content.split(/\r?\n/);
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // TSV/CSV format: term<tab/comma>translation
    if (trimmed.includes('\t')) {
      const [term, translation] = trimmed.split('\t', 2);
      if (term && translation) {
        map.set(term.trim(), translation.trim());
      }
      continue;
    }

    if (trimmed.includes(',')) {
      const parts = trimmed.split(',');
      if (parts.length >= 2) {
        const term = parts[0].trim().replace(/^["']|["']$/g, '');
        const translation = parts.slice(1).join(',').trim().replace(/^["']|["']$/g, '');
        if (term && translation) {
          map.set(term, translation);
        }
      }
      continue;
    }

    // #Term: format
    if (trimmed.startsWith('#Term:')) {
      const term = trimmed.substring(6).trim();
      const nextLineIdx = lines.indexOf(line) + 1;
      if (nextLineIdx < lines.length) {
        const nextLine = lines[nextLineIdx].trim();
        if (nextLine && !nextLine.startsWith('#')) {
          map.set(term, nextLine);
        }
      }
    }
  }

  return map;
}

/**
 * Apply translations to content
 */
export function applyTranslations(
  content: string,
  data: ExtractedItem[],
  translationMap: Map<string, string>
): { updated: string; count: number } {
  let updated = content;
  let count = 0;

  for (const item of data) {
    const translation = translationMap.get(item.term);
    if (!translation || !item.dataLineIndex || !item.linePrefix) {
      continue;
    }

    const lines = updated.split('\n');
    if (item.dataLineIndex >= lines.length) {
      continue;
    }

    const oldLine = lines[item.dataLineIndex];
    const escapedTranslation = translation
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');

    const newLine = `${item.linePrefix}${escapedTranslation}"`;
    
    if (oldLine !== newLine) {
      lines[item.dataLineIndex] = newLine;
      updated = lines.join('\n');
      count++;
    }
  }

  return { updated, count };
}

/**
 * Generate reversed content with RTL formatting applied
 */
export function generateReversedContent(
  content: string,
  data: ExtractedItem[],
  translationMap: Map<string, string>
): string {
  let updated = content;

  for (const item of data) {
    const translation = translationMap.get(item.term);
    if (!translation || !item.dataLineIndex || !item.linePrefix) {
      continue;
    }

    // Apply RTL formatting
    const rtlText = applyRTLFormatting(translation);
    
    const lines = updated.split('\n');
    if (item.dataLineIndex >= lines.length) {
      continue;
    }

    const escapedTranslation = rtlText
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');

    const newLine = `${item.linePrefix}${escapedTranslation}"`;
    lines[item.dataLineIndex] = newLine;
    updated = lines.join('\n');
  }

  return updated;
}

/**
 * Filter extracted items by search query
 */
export function filterData(data: ExtractedItem[], query: string): ExtractedItem[] {
  if (!query.trim()) {
    return data;
  }

  const lowerQuery = query.toLowerCase();
  return data.filter(item => 
    item.term.toLowerCase().includes(lowerQuery) ||
    item.originalText.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Count translated items
 */
export function countTranslated(data: ExtractedItem[], translationMap: Map<string, string>): number {
  return data.filter(item => translationMap.has(item.term)).length;
}
