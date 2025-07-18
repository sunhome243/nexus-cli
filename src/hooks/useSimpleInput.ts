import { useState, useCallback, useRef } from 'react';
import { useInputHistory } from './useInputHistory.js';

export interface SimpleInputOptions {
  onSubmit?: (text: string) => void;
  onChange?: (text: string) => void;
  initialText?: string;
  disabled?: boolean;
  historyType?: 'chat' | 'cli';
  enableHistory?: boolean;
}

export interface SimpleInputResult {
  text: string;
  cursorPos: number;
  setText: (text: string) => void;
  clear: () => void;
  
  // History state
  history: {
    isNavigating: boolean;
    navigationIndex: number;
    totalEntries: number;
  };
  
  // Keyboard handler for Ink
  handleInkInput: (input: string, key: any) => void;
  
  // Manual actions
  handleSubmit: (text?: string) => void;
}

// Helper function to check if character is a word character
function isWordChar(char: string): boolean {
  return /[a-zA-Z0-9_]/.test(char);
}

// Helper function to find word boundaries
function findWordStart(text: string, pos: number): number {
  let start = pos;
  while (start > 0 && !isWordChar(text[start - 1])) start--;
  while (start > 0 && isWordChar(text[start - 1])) start--;
  return start;
}

function findWordEnd(text: string, pos: number): number {
  let end = pos;
  while (end < text.length && !isWordChar(text[end])) end++;
  while (end < text.length && isWordChar(text[end])) end++;
  return end;
}

// Helper function to detect meta key combinations from input sequences
function isMetaKeySequence(input: string): { isMetaBackspace: boolean; isMetaLeft: boolean; isMetaRight: boolean } {
  if (!input) return { isMetaBackspace: false, isMetaLeft: false, isMetaRight: false };
  
  // Common meta+backspace sequences
  const metaBackspaceSequences = [
    '\u007f', // DEL character
    '\u0008', // BS character  
    '\u001b\u007f', // ESC + DEL
    '\u001b\u0008', // ESC + BS
    '\u0017', // Ctrl+W (word delete)
  ];
  
  // Common meta+left sequences
  const metaLeftSequences = [
    '\u001b[1;3D', // Alt+Left
    '\u001b[1;5D', // Ctrl+Left
    '\u001bb', // Alt+b
    '\u001b[5D', // Ctrl+Left alternative
  ];
  
  // Common meta+right sequences
  const metaRightSequences = [
    '\u001b[1;3C', // Alt+Right
    '\u001b[1;5C', // Ctrl+Right
    '\u001bf', // Alt+f
    '\u001b[5C', // Ctrl+Right alternative
  ];
  
  return {
    isMetaBackspace: metaBackspaceSequences.includes(input),
    isMetaLeft: metaLeftSequences.includes(input),
    isMetaRight: metaRightSequences.includes(input)
  };
}

export function useSimpleInput(options: SimpleInputOptions = {}): SimpleInputResult {
  const {
    onSubmit,
    onChange,
    initialText = '',
    disabled = false,
    historyType = 'chat',
    enableHistory = true,
  } = options;
  
  const [text, setText] = useState(initialText);
  const [cursorPos, setCursorPos] = useState(initialText.length);
  
  // Refs for stable callbacks
  const onSubmitRef = useRef(onSubmit);
  const onChangeRef = useRef(onChange);
  const disabledRef = useRef(disabled);
  
  // Update refs
  onSubmitRef.current = onSubmit;
  onChangeRef.current = onChange;
  disabledRef.current = disabled;
  
  // History hook
  const history = useInputHistory(
    text,
    (newText: string) => {
      setText(newText);
      setCursorPos(newText.length);
      onChangeRef.current?.(newText);
    },
    {
      historyType,
      maxEntries: historyType === 'chat' ? 50 : 100,
    }
  );
  
  // Update text with cursor position
  const updateText = useCallback((newText: string, newCursorPos?: number) => {
    setText(newText);
    setCursorPos(newCursorPos !== undefined ? newCursorPos : newText.length);
    onChangeRef.current?.(newText);
  }, []);
  
  // Set text action
  const setTextAction = useCallback((newText: string) => {
    updateText(newText, newText.length);
  }, [updateText]);
  
  // Clear action
  const clear = useCallback(() => {
    updateText('', 0);
  }, [updateText]);
  
  // Handle submit
  const handleSubmit = useCallback((submitText?: string) => {
    const textToSubmit = submitText || text;
    if (!textToSubmit.trim() || disabledRef.current) return;
    
    const trimmedText = textToSubmit.trim();
    
    // Add to history
    if (enableHistory) {
      history.addEntry(trimmedText);
    }
    
    // Call onSubmit
    onSubmitRef.current?.(trimmedText);
    
    // Clear the text
    clear();
  }, [text, history, enableHistory, clear]);
  
  // Main keyboard handler for Ink
  const handleInkInput = useCallback((input: string, key: any) => {
    if (disabledRef.current) return;
    
    
    // Handle bracketed paste
    if (key.paste) {
      // Clean and insert pasted content at cursor position
      const cleanInput = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
      if (cleanInput) {
        const newText = text.slice(0, cursorPos) + cleanInput + text.slice(cursorPos);
        updateText(newText, cursorPos + cleanInput.length);
        if (history.isNavigating) {
          history.resetNavigation();
        }
      }
      return;
    }
    
    // Handle special keys
    if (key.return) {
      handleSubmit();
      return;
    }
    
    if (key.escape) {
      if (history.isNavigating) {
        history.resetNavigation();
      }
      return;
    }
    
    // History navigation (up/down arrows) - Ink style
    if (enableHistory && key.upArrow) {
      history.navigateUp();
      return;
    }
    
    if (enableHistory && key.downArrow) {
      history.navigateDown();
      return;
    }
    
    // Advanced navigation with cursor position - Ink style
    if (key.leftArrow && !key.meta && !key.ctrl) {
      if (cursorPos > 0) {
        setCursorPos(cursorPos - 1);
      }
      if (history.isNavigating) {
        history.resetNavigation();
      }
      return;
    }
    
    if (key.rightArrow && !key.meta && !key.ctrl) {
      if (cursorPos < text.length) {
        setCursorPos(cursorPos + 1);
      }
      if (history.isNavigating) {
        history.resetNavigation();
      }
      return;
    }
    
    // Word-wise navigation with Alt/Meta + Arrow keys
    const metaSequences = isMetaKeySequence(input);
    const isMetaLeft = (key.meta || key.alt) && (key.leftArrow || input === 'b');
    const isMetaRight = (key.meta || key.alt) && (key.rightArrow || input === 'f');
    
    if (isMetaLeft || metaSequences.isMetaLeft || (key.ctrl && key.leftArrow)) {
      const wordStart = findWordStart(text, cursorPos);
      setCursorPos(wordStart);
      if (history.isNavigating) {
        history.resetNavigation();
      }
      return;
    }
    
    if (isMetaRight || metaSequences.isMetaRight || (key.ctrl && key.rightArrow)) {
      const wordEnd = findWordEnd(text, cursorPos);
      setCursorPos(wordEnd);
      if (history.isNavigating) {
        history.resetNavigation();
      }
      return;
    }
    
    // Home/End navigation - Ink style
    if (key.home || (key.ctrl && (key.name === 'a' || input === 'a'))) {
      setCursorPos(0);
      if (history.isNavigating) {
        history.resetNavigation();
      }
      return;
    }
    
    if (key.end || (key.ctrl && (key.name === 'e' || input === 'e'))) {
      setCursorPos(text.length);
      if (history.isNavigating) {
        history.resetNavigation();
      }
      return;
    }
    
    // Backspace - delete character before cursor
    // NOTE: In some terminals, backspace is detected as key.delete=true
    if (key.backspace || (key.delete && !key.ctrl && !key.meta && !key.alt) || (key.ctrl && (key.name === 'h' || input === 'h'))) {
      if (cursorPos > 0) {
        const newText = text.slice(0, cursorPos - 1) + text.slice(cursorPos);
        updateText(newText, cursorPos - 1);
        if (history.isNavigating) {
          history.resetNavigation();
        }
      }
      return;
    }
    
    // Delete - delete character at cursor (only with modifier keys or specific conditions)
    if ((key.delete && (key.ctrl || key.meta || key.alt)) || (key.ctrl && (key.name === 'd' || input === 'd'))) {
      if (cursorPos < text.length) {
        const newText = text.slice(0, cursorPos) + text.slice(cursorPos + 1);
        updateText(newText, cursorPos);
        if (history.isNavigating) {
          history.resetNavigation();
        }
      }
      return;
    }
    
    // Word deletion with Alt/Meta + Backspace
    // NOTE: Since backspace is detected as key.delete, we need to handle both cases
    const isMetaBackspace = (key.meta || key.alt) && (key.backspace || key.delete);
    
    if (isMetaBackspace || metaSequences.isMetaBackspace) {
      if (cursorPos > 0) {
        const wordStart = findWordStart(text, cursorPos);
        const newText = text.slice(0, wordStart) + text.slice(cursorPos);
        updateText(newText, wordStart);
        if (history.isNavigating) {
          history.resetNavigation();
        }
      }
      return;
    }
    
    // Word deletion with Ctrl + Backspace (separate from Alt/Meta to avoid conflicts)
    if (key.ctrl && (key.backspace || key.delete) && !key.meta && !key.alt) {
      if (cursorPos > 0) {
        const wordStart = findWordStart(text, cursorPos);
        const newText = text.slice(0, wordStart) + text.slice(cursorPos);
        updateText(newText, wordStart);
        if (history.isNavigating) {
          history.resetNavigation();
        }
      }
      return;
    }
    
    // Word deletion with Ctrl + W (delete word before cursor) - Ink style
    // This also handles Option+Backspace which terminals translate to Ctrl+W
    if (key.ctrl && (key.name === 'w' || input === 'w')) {
      if (cursorPos > 0) {
        const wordStart = findWordStart(text, cursorPos);
        const newText = text.slice(0, wordStart) + text.slice(cursorPos);
        updateText(newText, wordStart);
        if (history.isNavigating) {
          history.resetNavigation();
        }
      }
      return;
    }
    
    // Kill line from cursor to end with Ctrl + K
    if (key.ctrl && (key.name === 'k' || input === 'k')) {
      const newText = text.slice(0, cursorPos);
      updateText(newText, cursorPos);
      if (history.isNavigating) {
        history.resetNavigation();
      }
      return;
    }
    
    // Kill line from beginning to cursor with Ctrl + U
    if (key.ctrl && (key.name === 'u' || input === 'u')) {
      const newText = text.slice(cursorPos);
      updateText(newText, 0);
      if (history.isNavigating) {
        history.resetNavigation();
      }
      return;
    }
    
    // Clear entire line with Ctrl + L
    if (key.ctrl && (key.name === 'l' || input === 'l')) {
      updateText('', 0);
      if (history.isNavigating) {
        history.resetNavigation();
      }
      return;
    }
    
    // Move cursor left with Ctrl + B (only if not meta key)
    if (key.ctrl && (key.name === 'b' || input === 'b') && !key.meta && !key.alt) {
      if (cursorPos > 0) {
        setCursorPos(cursorPos - 1);
      }
      if (history.isNavigating) {
        history.resetNavigation();
      }
      return;
    }
    
    // Move cursor right with Ctrl + F (only if not meta key)
    if (key.ctrl && (key.name === 'f' || input === 'f') && !key.meta && !key.alt) {
      if (cursorPos < text.length) {
        setCursorPos(cursorPos + 1);
      }
      if (history.isNavigating) {
        history.resetNavigation();
      }
      return;
    }
    
    // Backspace with Ctrl + H
    if (key.ctrl && (key.name === 'h' || input === 'h')) {
      if (cursorPos > 0) {
        const newText = text.slice(0, cursorPos - 1) + text.slice(cursorPos);
        updateText(newText, cursorPos - 1);
        if (history.isNavigating) {
          history.resetNavigation();
        }
      }
      return;
    }
    
    // Delete with Ctrl + D
    if (key.ctrl && (key.name === 'd' || input === 'd')) {
      if (cursorPos < text.length) {
        const newText = text.slice(0, cursorPos) + text.slice(cursorPos + 1);
        updateText(newText, cursorPos);
        if (history.isNavigating) {
          history.resetNavigation();
        }
      }
      return;
    }
    
    // Additional alternative key combinations
    
    // Real Delete key functionality (Fn+Delete or dedicated Delete key)
    // This should only trigger for actual forward delete, not backspace
    if (key.name === 'delete' && !key.ctrl && !key.meta && !key.alt) {
      if (cursorPos < text.length) {
        const newText = text.slice(0, cursorPos) + text.slice(cursorPos + 1);
        updateText(newText, cursorPos);
        if (history.isNavigating) {
          history.resetNavigation();
        }
      }
      return;
    }
    
    // Alternative word navigation with Ctrl+Left/Right (for terminals that don't send Alt)
    if (key.ctrl && key.leftArrow && !key.meta && !key.alt) {
      const wordStart = findWordStart(text, cursorPos);
      setCursorPos(wordStart);
      if (history.isNavigating) {
        history.resetNavigation();
      }
      return;
    }
    
    if (key.ctrl && key.rightArrow && !key.meta && !key.alt) {
      const wordEnd = findWordEnd(text, cursorPos);
      setCursorPos(wordEnd);
      if (history.isNavigating) {
        history.resetNavigation();
      }
      return;
    }
    
    // Regular text input - insert at cursor position
    if (input && !key.ctrl && !key.meta && !key.alt) {
      const newText = text.slice(0, cursorPos) + input + text.slice(cursorPos);
      updateText(newText, cursorPos + input.length);
      if (history.isNavigating) {
        history.resetNavigation();
      }
    }
  }, [text, cursorPos, history, enableHistory, handleSubmit, updateText]);
  
  return {
    text,
    cursorPos,
    setText: setTextAction,
    clear,
    
    // History state
    history: {
      isNavigating: history.isNavigating,
      navigationIndex: history.navigationIndex,
      totalEntries: history.totalEntries,
    },
    
    // Actions
    handleInkInput,
    handleSubmit,
  };
}