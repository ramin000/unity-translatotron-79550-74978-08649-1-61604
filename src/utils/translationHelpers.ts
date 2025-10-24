import { ExtractedItem } from '@/store/translatorStore';
import { CONFIG, REGEX, RTL_EMBEDDING } from '@/config/constants';

/**
 * Remove BOM and normalize line endings
 */
export function normalizeFileContent(content: string): string {
  return content.replace(REGEX.BOM, '').replace(/\r\n/g, '\n');
}

/**
 * Extract terms using requestIdleCallback for better performance
 */
export function extractTermsChunked(
  content: string,
  targetIndex: number,
  onProgress?: (progress: number) => void
): Promise<ExtractedItem[]> {
  return new Promise((resolve, reject) => {
    const lines = content.split('\n');
    const total = lines.length;
    let currentIndex = 0;
    const results: ExtractedItem[] = [];
    let currentTerm: ExtractedItem | null = null;
    let isFound = false;
    let bracketIndex = -1;

    function processChunk(deadline: IdleDeadline) {
      try {
        while (currentIndex < total && deadline.timeRemaining() > 0) {
          const endIndex = Math.min(currentIndex + CONFIG.CHUNK_SIZE, total);
          
          for (let i = currentIndex; i < endIndex; i++) {
            const line = lines[i];
            
            // Match Term
            const termMatch = line.match(REGEX.TERM);
            if (termMatch) {
              if (currentTerm) results.push(currentTerm);
              currentTerm = { term: termMatch[1], originalText: '' };
              isFound = false;
              bracketIndex = -1;
            }
            
            // Match bracket index
            const bracketMatch = line.match(REGEX.BRACKET);
            if (bracketMatch && currentTerm) {
              bracketIndex = parseInt(bracketMatch[1], 10);
            }
            
            // Match data for target language
            if (currentTerm && !isFound && bracketIndex === targetIndex) {
              const nextLine = lines[i + 1];
              if (nextLine) {
                const dataMatch = nextLine.match(REGEX.DATA);
                if (dataMatch) {
                  currentTerm.originalText = dataMatch[1];
                  currentTerm.dataLineIndex = i + 1;
                  isFound = true;
                }
              }
            }
          }
          
          currentIndex = endIndex;
          if (onProgress) {
            onProgress(Math.round((currentIndex / total) * 100));
          }
        }

        if (currentIndex < total) {
          requestIdleCallback(processChunk, { timeout: 1000 });
        } else {
          if (currentTerm) results.push(currentTerm);
          resolve(results);
        }
      } catch (error) {
        reject(error);
      }
    }

    // Fallback for browsers without requestIdleCallback
    if ('requestIdleCallback' in window) {
      requestIdleCallback(processChunk, { timeout: 1000 });
    } else {
      // Fallback to setTimeout
      function fallbackProcess() {
        const endIndex = Math.min(currentIndex + CONFIG.CHUNK_SIZE, total);
        
        for (let i = currentIndex; i < endIndex; i++) {
          const line = lines[i];
          const termMatch = line.match(REGEX.TERM);
          if (termMatch) {
            if (currentTerm) results.push(currentTerm);
            currentTerm = { term: termMatch[1], originalText: '' };
            isFound = false;
            bracketIndex = -1;
          }
          
          const bracketMatch = line.match(REGEX.BRACKET);
          if (bracketMatch && currentTerm) {
            bracketIndex = parseInt(bracketMatch[1], 10);
          }
          
          if (currentTerm && !isFound && bracketIndex === targetIndex) {
            const nextLine = lines[i + 1];
            if (nextLine) {
              const dataMatch = nextLine.match(REGEX.DATA);
              if (dataMatch) {
                currentTerm.originalText = dataMatch[1];
                currentTerm.dataLineIndex = i + 1;
                isFound = true;
              }
            }
          }
        }
        
        currentIndex = endIndex;
        if (onProgress) onProgress(Math.round((currentIndex / total) * 100));
        
        if (currentIndex < total) {
          setTimeout(fallbackProcess, 0);
        } else {
          if (currentTerm) results.push(currentTerm);
          resolve(results);
        }
      }
      fallbackProcess();
    }
  });
}

/**
 * Apply RTL formatting by reversing the text character-by-character
 * Unity game engine displays Persian text correctly only when characters are reversed
 */
export function applyRTLFormatting(text: string): string {
  // Normalize Arabic characters first
  const normalizedMap: Record<string, string> = {
    'ك': 'ک',
    'ي': 'ی',
    'ة': 'ه',
    'أ': 'ا',
    'إ': 'ا',
    'ؤ': 'و',
  };
  
  const normalized = text.replace(/./g, (char) => normalizedMap[char] || char);
  
  // Reverse the string character-by-character for Unity
  // This makes "سلام" become "مالس"
  const reversed = Array.from(normalized).reverse().join('');
  
  // Add RTL embedding character
  return `${RTL_EMBEDDING}${reversed}`;
}

/**
 * Parse translation file into Map
 * Supports multiple formats:
 * 1. Simple two-line format (term\ntranslation)
 * 2. #Term: / #Original: format
 * 3. CSV format
 * 4. JSON format
 */
export function parseTranslations(content: string): Map<string, string> {
  const translationMap = new Map<string, string>();
  const trimmed = content.trim();

  // Try JSON format first
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        parsed.forEach((item: any) => {
          if (item?.term && item?.translation) {
            translationMap.set(String(item.term), String(item.translation));
          }
        });
        return translationMap;
      } else if (typeof parsed === 'object') {
        Object.entries(parsed).forEach(([key, value]) => {
          translationMap.set(String(key), String(value));
        });
        return translationMap;
      }
    } catch {
      // Fall through to text parsing
    }
  }

  // Text-based parsing
  const lines = content.split(/\r?\n/).map(l => l.trim());
  
  for (let i = 0; i < lines.length; i++) {
    const currentLine = lines[i];
    
    // Skip empty lines
    if (!currentLine) continue;

    // Format 1: #Term: / #Original: format
    if (currentLine.startsWith('#Term:')) {
      const term = currentLine.replace(/^#Term:\s*/i, '').trim();
      const nextLine = lines[i + 1];
      if (nextLine && nextLine.startsWith('#Original:')) {
        const translation = nextLine.replace(/^#Original:\s*/i, '').trim();
        if (term && translation) {
          translationMap.set(term, translation);
        }
        i++; // Skip next line since we consumed it
        continue;
      }
    }

    // Format 2: CSV format "term","translation"
    const csvMatch = currentLine.match(/^"(.+)","(.+)"$/);
    if (csvMatch) {
      translationMap.set(csvMatch[1], csvMatch[2]);
      continue;
    }

    // Format 3: Simple two-line format (most common)
    // Current line is term, next line is translation
    const nextLine = lines[i + 1];
    if (nextLine && !nextLine.startsWith('#') && !nextLine.match(/^".*",".*"$/)) {
      // Make sure next line is not empty and not another term-like line
      if (nextLine.trim()) {
        translationMap.set(currentLine, nextLine);
        i++; // Skip next line since we consumed it
        continue;
      }
    }
  }

  return translationMap;
}

/**
 * Escape special characters for safe output
 */
export function escapeSpecialCharacters(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Apply translations to content safely
 */
export function applyTranslations(
  content: string,
  data: ExtractedItem[],
  translationMap: Map<string, string>
): { updated: string; count: number } {
  const lines = content.split('\n');
  let appliedCount = 0;

  data.forEach((item) => {
    const translation = translationMap.get(item.term);
    if (translation && item.dataLineIndex !== undefined) {
      const originalLine = lines[item.dataLineIndex];
      const indentation = originalLine.match(/^(\s*)/)?.[0] || '';
      const escapedTranslation = escapeSpecialCharacters(translation);
      lines[item.dataLineIndex] = `${indentation}string data = "${escapedTranslation}"`;
      appliedCount++;
    }
  });

  return {
    updated: lines.join('\n'),
    count: appliedCount,
  };
}

/**
 * Generate reversed content with RTL formatting
 */
export function generateReversedContent(
  content: string,
  data: ExtractedItem[],
  translationMap: Map<string, string>
): string {
  const lines = content.split('\n');

  data.forEach((item) => {
    const translation = translationMap.get(item.term);
    if (translation && item.dataLineIndex !== undefined) {
      const rtlText = applyRTLFormatting(translation);
      const originalLine = lines[item.dataLineIndex];
      const indentation = originalLine.match(/^(\s*)/)?.[0] || '';
      const escapedText = escapeSpecialCharacters(rtlText);
      lines[item.dataLineIndex] = `${indentation}string data = "${escapedText}"`;
    }
  });

  return lines.join('\n');
}

/**
 * Generate output filename based on input
 */
export function generateOutputFileName(originalName: string, suffix: string): string {
  if (!originalName) return `output${suffix}.txt`;
  const dotIndex = originalName.lastIndexOf('.');
  if (dotIndex > 0) {
    return originalName.slice(0, dotIndex) + suffix + originalName.slice(dotIndex);
  }
  return originalName + suffix;
}

/**
 * Safe file download
 */
export function downloadFile(data: string, filename: string): void {
  const blob = new Blob([data], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }
}

/**
 * Export to CSV with proper escaping
 */
export function exportToCSV(
  data: ExtractedItem[],
  translationMap: Map<string, string>
): string {
  const escapeCSV = (text: string): string => {
    if (text.includes('"') || text.includes(',') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const header = 'Term,Original Text,Translation\n';
  const rows = data.map((item) => {
    const translation = translationMap.get(item.term) || '';
    return [
      escapeCSV(item.term),
      escapeCSV(item.originalText),
      escapeCSV(translation),
    ].join(',');
  });

  return header + rows.join('\n');
}

/**
 * Get filtered data based on search query
 */
export function filterData(data: ExtractedItem[], query: string): ExtractedItem[] {
  if (!query.trim()) return data;
  
  const lowerQuery = query.toLowerCase();
  return data.filter((item) =>
    item.term.toLowerCase().includes(lowerQuery) ||
    item.originalText.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Count translated items
 */
export function countTranslated(
  data: ExtractedItem[],
  translationMap: Map<string, string>
): number {
  return data.filter((item) => {
    const translation = translationMap.get(item.term);
    return translation && translation.trim().length > 0;
  }).length;
}
