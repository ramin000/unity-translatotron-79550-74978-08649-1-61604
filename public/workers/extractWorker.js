/**
 * Web Worker for Unity I2 Translation Processing
 * Handles extraction and RTL formatting in background thread
 */

// Constants
const CONFIG = {
  CHUNK_SIZE: 1000,
  RTL_EMBEDDING: '\u202B',
};

const REGEX = {
  TERM: /string Term = "([^"]+)"/,
  BRACKET: /\[(\d+)\]/,
  DATA: /(\s*)(\d+\s+)?string data = "([^"]*)"/,
  BOM: /^\uFEFF/,
};

// Send ready signal
self.postMessage({ type: 'READY' });

// Message handler
self.onmessage = function(e) {
  const { type, content, langIndex, extractedData, translationsArray, map, requestId } = e.data;

  try {
    switch(type) {
      case 'EXTRACT':
        handleExtract(content, langIndex);
        break;
      case 'APPLY_TRANSLATIONS':
        handleApplyTranslations(content, extractedData, map);
        break;
      case 'GENERATE_REVERSED':
        handleGenerateReversed(content, extractedData, translationsArray, requestId);
        break;
      default:
        self.postMessage({ error: 'Unknown message type' });
    }
  } catch (error) {
    self.postMessage({ 
      error: error.message || 'Processing failed',
      requestId 
    });
  }
};

/**
 * Extract terms from content
 */
function handleExtract(content, targetIndex) {
  const lines = content.split('\n');
  const total = lines.length;
  const results = [];
  let currentTerm = null;
  let isFound = false;
  let bracketIndex = -1;

  for (let i = 0; i < total; i++) {
    const line = lines[i];
    
    // Progress update every 100 lines
    if (i % 100 === 0) {
      self.postMessage({ progress: Math.round((i / total) * 100) });
    }
    
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
          currentTerm.originalText = dataMatch[3];
          currentTerm.dataLineIndex = i + 1;
          currentTerm.linePrefix = (dataMatch[1] || '') + (dataMatch[2] || '');
          isFound = true;
        }
      }
    }
  }
  
  if (currentTerm) results.push(currentTerm);
  
  self.postMessage({ 
    extracted: results,
    progress: 100 
  });
}

/**
 * Apply translations to content
 */
function handleApplyTranslations(content, extractedData, translationsMap) {
  const lines = content.split('\n');
  const map = new Map(translationsMap);
  let appliedCount = 0;

  extractedData.forEach((item) => {
    const translation = map.get(item.term);
    if (translation && item.dataLineIndex !== undefined) {
      const prefix = item.linePrefix || '';
      const escapedTranslation = escapeSpecialCharacters(translation);
      lines[item.dataLineIndex] = `${prefix}string data = "${escapedTranslation}"`;
      appliedCount++;
    }
  });

  self.postMessage({
    type: 'APPLY_RESULT',
    updated: lines.join('\n'),
    count: appliedCount,
    map: translationsMap,
  });
}

/**
 * Generate reversed content with RTL formatting
 */
function handleGenerateReversed(content, extractedData, translationsArray, requestId) {
  const lines = content.split('\n');
  const map = new Map(translationsArray);

  extractedData.forEach((item) => {
    const translation = map.get(item.term);
    if (translation && item.dataLineIndex !== undefined) {
      const rtlText = applyRTLFormatting(translation);
      const prefix = item.linePrefix || '';
      const escapedText = escapeSpecialCharacters(rtlText);
      lines[item.dataLineIndex] = `${prefix}string data = "${escapedText}"`;
    }
  });

  self.postMessage({
    type: 'REVERSE_RESULT',
    requestId,
    updated: lines.join('\n'),
  });
}

/**
 * Apply RTL formatting by reversing text character-by-character
 * Unity game engine displays Persian text correctly only when characters are reversed
 */
function applyRTLFormatting(text) {
  // Normalize Arabic characters
  const normalizedMap = {
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
  return `${CONFIG.RTL_EMBEDDING}${reversed}`;
}

/**
 * Escape special characters for safe output
 */
function escapeSpecialCharacters(text) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}
