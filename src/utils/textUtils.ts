/**
 * Text utilities for Unicode-aware text processing
 * Based on gemini-cli's implementation for proper text handling
 */

/**
 * Convert a string to an array of Unicode code points
 * Handles surrogate pairs correctly for emoji and extended Unicode
 * Using gemini-cli's simple and bulletproof approach
 */
export function toCodePoints(str: string): string[] {
  // Array.from iterates by UTF-32 code point, handling surrogate pairs correctly
  return Array.from(str);
}

/**
 * Get the code point length of a string
 * More accurate than str.length for Unicode text
 */
export function cpLen(str: string): number {
  return toCodePoints(str).length;
}

/**
 * Slice a string by code points instead of UTF-16 code units
 * Equivalent to Array.slice() but for Unicode strings
 */
export function cpSlice(str: string, start: number, end?: number): string {
  const codePoints = toCodePoints(str);
  return codePoints.slice(start, end).join('');
}


/**
 * Strip characters that can break terminal rendering.
 * Strip ANSI escape codes and control characters except for line breaks.
 * Control characters such as delete break terminal UI rendering.
 * Based on gemini-cli's implementation for proper Unicode handling.
 */
export function stripUnsafeCharacters(text: string): string {
  // Validate input first
  if (typeof text !== 'string' || text.length > 100000) {
    return '';
  }
  
  try {
    // Ensure the string can be properly converted to code points
    const codePoints = toCodePoints(text);
    
    // Note: stripAnsi would need to be imported if available, for now skip ANSI stripping
    return codePoints
      .filter((char) => {
        if (char.length > 1) return false;
        const code = char.codePointAt(0);
        if (code === undefined) {
          return false;
        }
        // Strip carriage returns (\r, code 13) but keep newlines (\n, code 10) and tabs (\t, code 9)
        // Also strip other control characters and delete (127)
        const isUnsafe =
          code === 127 || code === 13 || (code <= 31 && code !== 10 && code !== 9);
        return !isUnsafe;
      })
      .join('');
  } catch {
    // Invalid Unicode sequences
    return '';
  }
}

