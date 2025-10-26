// Unity I2 Translation Worker
// Simplified version - RTL formatting handled by main thread

const REGEX = {
  TERM: /^#Term:\s*(.+)$/,
  DATA: /^\s*(\d+)\s+string\s+data\s*=\s*"((?:[^"\\]|\\.)*)"\s*$/,
  BRACKETED_NUM: /^\[(\d+)\]$/,
  BOM: /^\uFEFF/,
};

// Send ready signal
postMessage({ type: 'READY' });

// Message Handler
onmessage = async function(event) {
  const data = event.data || {};
  
  try {
    if (data.type === 'EXTRACT') {
      handleExtract(data);
    } else if (data.type === 'APPLY_TRANSLATIONS') {
      handleApplyTranslations(data);
    } else if (data.type === 'GENERATE_REVERSED') {
      handleGenerateReversed(data);
    } else {
      postMessage({ error: `Unknown message type: ${data.type}` });
    }
  } catch (error) {
    postMessage({ 
      error: error.message || 'Worker processing failed',
      type: 'ERROR'
    });
  }
};

// Extract handler
function handleExtract(data) {
  const content = data.content || '';
  const targetIndex = data.targetIndex || 0;
  
  const normalized = content.replace(REGEX.BOM, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  const results = [];
  
  let currentTerm = '';
  let processedLines = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    const termMatch = line.match(REGEX.TERM);
    if (termMatch) {
      currentTerm = termMatch[1];
      continue;
    }

    const bracketMatch = line.match(REGEX.BRACKETED_NUM);
    if (bracketMatch) {
      const nextLine = lines[i + 1];
      if (nextLine) {
        const dataMatch = nextLine.trim().match(REGEX.DATA);
        if (dataMatch) {
          const [, indexStr, dataStr] = dataMatch;
          const idx = parseInt(indexStr, 10);

          if (idx === targetIndex && currentTerm) {
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
          i++;
        }
      }
    }

    processedLines++;
    if (processedLines % 1000 === 0) {
      postMessage({ progress: Math.round((processedLines / lines.length) * 100) });
    }
  }

  postMessage({ 
    type: 'EXTRACT_COMPLETE',
    extracted: results,
    progress: 100 
  });
}

// Apply translations handler
function handleApplyTranslations(data) {
  const content = data.content || '';
  const extractedData = data.extractedData || [];
  const translationsMap = new Map(data.translationsMap || []);
  
  let updated = content;
  let count = 0;

  for (const item of extractedData) {
    const translation = translationsMap.get(item.term);
    if (!translation || !item.dataLineIndex || !item.linePrefix) {
      continue;
    }

    const lines = updated.split('\n');
    if (item.dataLineIndex >= lines.length) {
      continue;
    }

    const escapedTranslation = escapeSpecialCharacters(translation);
    const newLine = `${item.linePrefix}${escapedTranslation}"`;
    
    lines[item.dataLineIndex] = newLine;
    updated = lines.join('\n');
    count++;
  }

  postMessage({ 
    type: 'APPLY_RESULT',
    updated,
    count 
  });
}

// Generate reversed content handler
function handleGenerateReversed(data) {
  const content = data.content || '';
  const extractedData = data.extractedData || [];
  const translationsMap = new Map(data.translationsMap || []);
  
  // Note: RTL formatting is now handled by the main thread
  // This worker just does the replacement
  let finalContent = content;
  let count = 0;

  for (const item of extractedData) {
    const translation = translationsMap.get(item.term);
    if (!translation || !item.dataLineIndex || !item.linePrefix) {
      continue;
    }

    const lines = finalContent.split('\n');
    if (item.dataLineIndex >= lines.length) {
      continue;
    }

    const escapedTranslation = escapeSpecialCharacters(translation);
    const newLine = `${item.linePrefix}${escapedTranslation}"`;
    
    lines[item.dataLineIndex] = newLine;
    finalContent = lines.join('\n');
    count++;
  }

  postMessage({ 
    type: 'REVERSE_RESULT',
    updated: finalContent,
    requestId: data.requestId 
  });
}

// Helper: Escape special characters
function escapeSpecialCharacters(text) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}
