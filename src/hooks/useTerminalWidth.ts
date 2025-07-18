import { useStdout } from 'ink';
import stringWidth from 'string-width';

export interface TerminalWidthOptions {
  minWidth?: number;
  maxWidth?: number;
  targetPercent?: number;
}

export const useTerminalWidth = (options: TerminalWidthOptions = {}) => {
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns || 80;
  
  const {
    minWidth = 60,
    maxWidth = 120,
    targetPercent = 0.85
  } = options;
  
  // Calculate optimal permission prompt width
  const calculatePromptWidth = () => {
    const calculatedWidth = Math.floor(terminalWidth * targetPercent);
    return Math.max(minWidth, Math.min(maxWidth, calculatedWidth));
  };
  
  // Truncate text to fit within width
  const truncateText = (text: string, maxWidth: number, suffix = '...') => {
    const textWidth = stringWidth(text);
    if (textWidth <= maxWidth) {
      return text;
    }
    
    const suffixWidth = stringWidth(suffix);
    const targetWidth = maxWidth - suffixWidth;
    
    let truncated = '';
    let currentWidth = 0;
    
    for (const char of text) {
      const charWidth = stringWidth(char);
      if (currentWidth + charWidth > targetWidth) {
        break;
      }
      truncated += char;
      currentWidth += charWidth;
    }
    
    return truncated + suffix;
  };
  
  // Wrap text to fit within width
  const wrapText = (text: string, maxWidth: number): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    for (const word of words) {
      const wordWidth = stringWidth(word);
      const currentWidth = stringWidth(currentLine);
      const spaceWidth = currentLine ? 1 : 0;
      
      if (currentWidth + spaceWidth + wordWidth <= maxWidth) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) {
          lines.push(currentLine);
        }
        
        // Handle words longer than maxWidth
        if (wordWidth > maxWidth) {
          const truncated = truncateText(word, maxWidth - 3, '...');
          lines.push(truncated);
          currentLine = '';
        } else {
          currentLine = word;
        }
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines;
  };
  
  return {
    terminalWidth,
    promptWidth: calculatePromptWidth(),
    stringWidth,
    truncateText,
    wrapText
  };
};