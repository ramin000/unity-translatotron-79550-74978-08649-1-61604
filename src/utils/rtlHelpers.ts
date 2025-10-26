/**
 * RTL formatting utilities for Persian/Arabic text
 * Uses arabic-reshaper for proper contextual shaping
 */

// Import with proper type handling
let ArabicReshaper: any;
try {
  ArabicReshaper = require('arabic-reshaper');
} catch {
  console.warn('arabic-reshaper not available');
}

/**
 * Apply proper RTL formatting for Persian/Arabic text
 * This implementation uses arabic-reshaper for contextual shaping
 */
export function applyRTLFormatting(text: string): string {
  if (!text || !isLikelyRTL(text)) {
    return text;
  }

  try {
    // Step 1: Normalize Arabic characters to Persian equivalents
    const normalized = text
      .replace(/ي/g, 'ی')
      .replace(/ك/g, 'ک')
      .replace(/ؤ/g, 'و')
      .replace(/أ/g, 'ا')
      .replace(/إ/g, 'ا')
      .replace(/ة/g, 'ه');

    // Step 2: Apply Arabic reshaping if library is available
    let reshaped = normalized;
    if (ArabicReshaper && typeof ArabicReshaper.convertArabic === 'function') {
      try {
        reshaped = ArabicReshaper.convertArabic(normalized);
      } catch (err) {
        console.warn('Reshaping failed, using fallback:', err);
        reshaped = applyManualShaping(normalized);
      }
    } else {
      reshaped = applyManualShaping(normalized);
    }

    // Step 3: Apply BiDi reordering with proper segment handling
    const reordered = applyBidiReordering(reshaped);

    return reordered;
  } catch (error) {
    console.error('RTL formatting error:', error);
    // Return original text if formatting fails
    return text;
  }
}

/**
 * Fallback manual shaping for Persian/Arabic letters
 */
function applyManualShaping(text: string): string {
  // Presentation forms mapping for contextual shaping
  const presentationForms: Record<string, string[]> = {
    // [Isolated, Final, Initial, Medial]
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
  
  const chars = Array.from(text);
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
  
  return shaped;
}

/**
 * Apply BiDi reordering while preserving punctuation and Latin text
 */
function applyBidiReordering(text: string): string {
  const segments: Array<{ text: string; isRTL: boolean }> = [];
  let currentSegment = '';
  let isCurrentRTL = false;

  // Split text into RTL and LTR segments
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const isRTL = isRTLChar(char);

    if (i === 0) {
      currentSegment = char;
      isCurrentRTL = isRTL;
    } else if (isRTL === isCurrentRTL) {
      currentSegment += char;
    } else {
      segments.push({ text: currentSegment, isRTL: isCurrentRTL });
      currentSegment = char;
      isCurrentRTL = isRTL;
    }
  }

  if (currentSegment) {
    segments.push({ text: currentSegment, isRTL: isCurrentRTL });
  }

  // Reverse RTL segments only
  const result = segments.map(segment => {
    if (segment.isRTL) {
      return segment.text.split('').reverse().join('');
    }
    return segment.text;
  }).join('');

  return result;
}

/**
 * Check if a character is RTL (Arabic/Persian/Hebrew)
 */
function isRTLChar(char: string): boolean {
  const code = char.charCodeAt(0);
  
  // Arabic and Persian ranges (including presentation forms)
  if ((code >= 0x0600 && code <= 0x06FF) || // Arabic
      (code >= 0xFB50 && code <= 0xFDFF) || // Arabic Presentation Forms-A
      (code >= 0xFE70 && code <= 0xFEFF)) { // Arabic Presentation Forms-B
    return true;
  }
  
  // Hebrew range
  if (code >= 0x0590 && code <= 0x05FF) {
    return true;
  }
  
  return false;
}

/**
 * Detect if text likely contains RTL content
 */
export function isLikelyRTL(text: string): boolean {
  if (!text) return false;
  
  // Check for presence of Arabic/Persian characters
  return /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

/**
 * Escape special characters for safe string embedding
 */
export function escapeSpecialCharacters(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}
