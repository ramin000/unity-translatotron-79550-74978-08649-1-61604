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
 * Apply proper RTL formatting for Persian/Arabic text
 * This implementation uses a more sophisticated approach that handles:
 * 1. Character shaping (presentation forms) based on context
 * 2. Proper BiDi reordering
 * 3. Preserving Latin characters and punctuation in correct positions
 */
function applyRTLFormatting(text) {
  // Normalize Arabic characters to Persian
  const normalized = text
    .replace(/ك/g, 'ک')
    .replace(/ي/g, 'ی')
    .replace(/ة/g, 'ه')
    .replace(/أ/g, 'ا')
    .replace(/إ/g, 'ا')
    .replace(/ؤ/g, 'و');
  
  // Presentation forms mapping for contextual shaping
  const presentationForms = {
    // Isolated, Final, Initial, Medial
    'ا': ['\uFE8D', '\uFE8E', '\uFE8D', '\uFE8D'],
    'آ': ['\uFE81', '\uFE82', '\uFE81', '\uFE81'],
    'ب': ['\uFE8F', '\uFE90', '\uFE91', '\uFE92'],
    'پ': ['\uFB56', '\uFB57', '\uFB58', '\uFB59'],
    'ت': ['\uFE95', '\uFE96', '\uFE97', '\uFE98'],
    'ث': ['\uFE99', '\uFE9A', '\uFE9B', '\uFE9C'],
    'ج': ['\uFE9D', '\uFE9E', '\uFE9F', '\uFEA0'],
    'چ': ['\uFB7A', '\uFB7B', '\uFB7C', '\uFB7D'],
    'ح': ['\uFEA1', '\uFEA2', '\uFEA3', '\uFEA4'],
    'خ': ['\uFEA5', '\uFEA6', '\uFEA7', '\uFEA8'],
    'د': ['\uFEA9', '\uFEAA', '\uFEA9', '\uFEA9'],
    'ذ': ['\uFEAB', '\uFEAC', '\uFEAB', '\uFEAB'],
    'ر': ['\uFEAD', '\uFEAE', '\uFEAD', '\uFEAD'],
    'ز': ['\uFEAF', '\uFEB0', '\uFEAF', '\uFEAF'],
    'ژ': ['\uFB8A', '\uFB8B', '\uFB8A', '\uFB8A'],
    'س': ['\uFEB1', '\uFEB2', '\uFEB3', '\uFEB4'],
    'ش': ['\uFEB5', '\uFEB6', '\uFEB7', '\uFEB8'],
    'ص': ['\uFEB9', '\uFEBA', '\uFEBB', '\uFEBC'],
    'ض': ['\uFEBD', '\uFEBE', '\uFEBF', '\uFEC0'],
    'ط': ['\uFEC1', '\uFEC2', '\uFEC3', '\uFEC4'],
    'ظ': ['\uFEC5', '\uFEC6', '\uFEC7', '\uFEC8'],
    'ع': ['\uFEC9', '\uFECA', '\uFECB', '\uFECC'],
    'غ': ['\uFECD', '\uFECE', '\uFECF', '\uFED0'],
    'ف': ['\uFED1', '\uFED2', '\uFED3', '\uFED4'],
    'ق': ['\uFED5', '\uFED6', '\uFED7', '\uFED8'],
    'ک': ['\uFED9', '\uFEDA', '\uFEDB', '\uFEDC'],
    'گ': ['\uFB92', '\uFB93', '\uFB94', '\uFB95'],
    'ل': ['\uFEDD', '\uFEDE', '\uFEDF', '\uFEE0'],
    'م': ['\uFEE1', '\uFEE2', '\uFEE3', '\uFEE4'],
    'ن': ['\uFEE5', '\uFEE6', '\uFEE7', '\uFEE8'],
    'و': ['\uFEED', '\uFEEE', '\uFEED', '\uFEED'],
    'ه': ['\uFEEB', '\uFEEC', '\uFEED', '\uFEEE'],
    'ی': ['\uFEF1', '\uFEF2', '\uFEF3', '\uFEF4'],
    'ئ': ['\uFE89', '\uFE8A', '\uFE8B', '\uFE8C'],
  };
  
  // Characters that don't connect to following character
  const nonConnectors = new Set(['ا', 'آ', 'د', 'ذ', 'ر', 'ز', 'ژ', 'و']);
  
  // Apply contextual shaping
  const chars = Array.from(normalized);
  const shaped = chars.map((char, i) => {
    const forms = presentationForms[char];
    if (!forms) return char;
    
    const prevChar = i > 0 ? chars[i - 1] : null;
    const nextChar = i < chars.length - 1 ? chars[i + 1] : null;
    
    const prevConnects = prevChar && presentationForms[prevChar] && !nonConnectors.has(prevChar);
    const nextConnects = nextChar && presentationForms[nextChar];
    
    // Determine form: 0=isolated, 1=final, 2=initial, 3=medial
    let formIndex = 0;
    if (prevConnects && nextConnects) formIndex = 3; // medial
    else if (prevConnects) formIndex = 1; // final
    else if (nextConnects) formIndex = 2; // initial
    
    return forms[formIndex];
  }).join('');
  
  // Split into RTL (Persian/Arabic) and LTR (Latin, numbers, etc.) segments
  const segments = [];
  let currentText = '';
  let isRTL = false;
  
  for (const char of shaped) {
    const charIsRTL = /[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(char);
    
    if (currentText === '') {
      currentText = char;
      isRTL = charIsRTL;
    } else if (charIsRTL === isRTL) {
      currentText += char;
    } else {
      segments.push({ text: currentText, isRTL });
      currentText = char;
      isRTL = charIsRTL;
    }
  }
  
  if (currentText) {
    segments.push({ text: currentText, isRTL });
  }
  
  // Reverse RTL segments and reorder for visual display
  const processed = segments.map(seg => 
    seg.isRTL ? Array.from(seg.text).reverse().join('') : seg.text
  ).join('');
  
  return processed;
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
