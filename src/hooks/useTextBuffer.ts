/**
 * Comprehensive TextBuffer implementation based on gemini-cli's proven architecture
 * Adapted for nexus-cli to fix multiline editing and keyboard shortcuts
 */

import { useState, useCallback, useEffect, useMemo, useReducer } from "react";
import { cpLen, cpSlice, toCodePoints, stripUnsafeCharacters } from "../utils/textUtils.js";
import { Key } from "./useKeypress.js";
import stringWidth from "string-width";

export type Direction = "left" | "right" | "up" | "down" | "wordLeft" | "wordRight" | "home" | "end";

// Simple helper for word‑wise ops.
function isWordChar(ch: string | undefined): boolean {
  if (ch === undefined) {
    return false;
  }
  return !/[\s,.;!?]/.test(ch);
}


export interface Viewport {
  height: number;
  width: number;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export interface UseTextBufferOptions {
  initialText?: string;
  initialCursorOffset?: number;
  viewport: Viewport;
  stdin?: NodeJS.ReadableStream;
  setRawMode?: (mode: boolean) => void;
  onChange?: (text: string) => void;
  isValidPath: (path: string) => boolean;
}

interface UndoHistoryEntry {
  lines: string[];
  cursorRow: number;
  cursorCol: number;
}

function calculateInitialCursorPosition(initialLines: string[], offset: number): [number, number] {
  let remainingChars = offset;
  let row = 0;
  while (row < initialLines.length) {
    const lineLength = cpLen(initialLines[row]);
    const totalCharsInLineAndNewline = lineLength + (row < initialLines.length - 1 ? 1 : 0);

    if (remainingChars <= lineLength) {
      return [row, remainingChars];
    }
    remainingChars -= totalCharsInLineAndNewline;
    row++;
  }

  if (initialLines.length > 0) {
    const lastRow = initialLines.length - 1;
    return [lastRow, cpLen(initialLines[lastRow])];
  }
  return [0, 0];
}

export function offsetToLogicalPos(text: string, offset: number): [number, number] {
  let row = 0;
  let col = 0;
  let currentOffset = 0;

  if (offset === 0) return [0, 0];

  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLength = cpLen(line);
    const lineLengthWithNewline = lineLength + (i < lines.length - 1 ? 1 : 0);

    if (offset <= currentOffset + lineLength) {
      row = i;
      col = offset - currentOffset;
      return [row, col];
    } else if (offset <= currentOffset + lineLengthWithNewline) {
      row = i;
      col = lineLength;
      if (offset === currentOffset + lineLengthWithNewline && i < lines.length - 1) {
        return [i + 1, 0];
      }
      return [row, col];
    }
    currentOffset += lineLengthWithNewline;
  }

  if (lines.length > 0) {
    row = lines.length - 1;
    col = cpLen(lines[row]);
  } else {
    row = 0;
    col = 0;
  }
  return [row, col];
}

// Helper to calculate visual lines and map cursor positions - THE CRITICAL PART
function calculateVisualLayout(
  logicalLines: string[],
  logicalCursor: [number, number],
  viewportWidth: number
): {
  visualLines: string[];
  visualCursor: [number, number];
  logicalToVisualMap: Array<Array<[number, number]>>;
  visualToLogicalMap: Array<[number, number]>;
} {
  const visualLines: string[] = [];
  const logicalToVisualMap: Array<Array<[number, number]>> = [];
  const visualToLogicalMap: Array<[number, number]> = [];
  let currentVisualCursor: [number, number] = [0, 0];

  logicalLines.forEach((logLine, logIndex) => {
    logicalToVisualMap[logIndex] = [];
    if (logLine.length === 0) {
      // Handle empty logical line
      logicalToVisualMap[logIndex].push([visualLines.length, 0]);
      visualToLogicalMap.push([logIndex, 0]);
      visualLines.push("");
      if (logIndex === logicalCursor[0] && logicalCursor[1] === 0) {
        currentVisualCursor = [visualLines.length - 1, 0];
      }
    } else {
      // Non-empty logical line
      let currentPosInLogLine = 0;
      const codePointsInLogLine = toCodePoints(logLine);

      while (currentPosInLogLine < codePointsInLogLine.length) {
        let currentChunk = "";
        let currentChunkVisualWidth = 0;
        let numCodePointsInChunk = 0;
        let lastWordBreakPoint = -1;
        let numCodePointsAtLastWordBreak = 0;

        // Iterate through code points to build the current visual line
        for (let i = currentPosInLogLine; i < codePointsInLogLine.length; i++) {
          const char = codePointsInLogLine[i];
          const charVisualWidth = stringWidth(char) || 1; // Proper Unicode visual width

          if (currentChunkVisualWidth + charVisualWidth > viewportWidth) {
            // Character would exceed viewport width
            if (
              lastWordBreakPoint !== -1 &&
              numCodePointsAtLastWordBreak > 0 &&
              currentPosInLogLine + numCodePointsAtLastWordBreak < i
            ) {
              // Use word break point
              currentChunk = codePointsInLogLine
                .slice(currentPosInLogLine, currentPosInLogLine + numCodePointsAtLastWordBreak)
                .join("");
              numCodePointsInChunk = numCodePointsAtLastWordBreak;
            } else {
              // Hard break
              if (numCodePointsInChunk === 0 && charVisualWidth > viewportWidth) {
                currentChunk = char;
                numCodePointsInChunk = 1;
              }
            }
            break;
          }

          currentChunk += char;
          currentChunkVisualWidth += charVisualWidth;
          numCodePointsInChunk++;

          // Check for word break opportunity
          if (char === " ") {
            lastWordBreakPoint = i;
            numCodePointsAtLastWordBreak = numCodePointsInChunk - 1;
          }
        }

        if (numCodePointsInChunk === 0 && currentPosInLogLine < codePointsInLogLine.length) {
          const firstChar = codePointsInLogLine[currentPosInLogLine];
          currentChunk = firstChar;
          numCodePointsInChunk = 1;
        }

        if (numCodePointsInChunk === 0 && currentPosInLogLine < codePointsInLogLine.length) {
          currentChunk = codePointsInLogLine[currentPosInLogLine];
          numCodePointsInChunk = 1;
        }

        logicalToVisualMap[logIndex].push([visualLines.length, currentPosInLogLine]);
        visualToLogicalMap.push([logIndex, currentPosInLogLine]);
        visualLines.push(currentChunk);

        // Cursor mapping logic - CRITICAL FOR NAVIGATION
        if (logIndex === logicalCursor[0]) {
          const cursorLogCol = logicalCursor[1];
          if (cursorLogCol >= currentPosInLogLine && cursorLogCol < currentPosInLogLine + numCodePointsInChunk) {
            currentVisualCursor = [visualLines.length - 1, cursorLogCol - currentPosInLogLine];
          } else if (cursorLogCol === currentPosInLogLine + numCodePointsInChunk && numCodePointsInChunk > 0) {
            currentVisualCursor = [visualLines.length - 1, numCodePointsInChunk];
          }
        }

        const logicalStartOfThisChunk = currentPosInLogLine;
        currentPosInLogLine += numCodePointsInChunk;

        // Skip trailing space
        if (
          logicalStartOfThisChunk + numCodePointsInChunk < codePointsInLogLine.length &&
          currentPosInLogLine < codePointsInLogLine.length &&
          codePointsInLogLine[currentPosInLogLine] === " "
        ) {
          currentPosInLogLine++;
        }
      }

      // Handle cursor at end of logical line
      if (logIndex === logicalCursor[0] && logicalCursor[1] === codePointsInLogLine.length) {
        const lastVisualLineIdx = visualLines.length - 1;
        if (lastVisualLineIdx >= 0 && visualLines[lastVisualLineIdx] !== undefined) {
          currentVisualCursor = [lastVisualLineIdx, cpLen(visualLines[lastVisualLineIdx])];
        }
      }
    }
  });

  // Handle empty text
  if (logicalLines.length === 0 || (logicalLines.length === 1 && logicalLines[0] === "")) {
    if (visualLines.length === 0) {
      visualLines.push("");
      if (!logicalToVisualMap[0]) logicalToVisualMap[0] = [];
      logicalToVisualMap[0].push([0, 0]);
      visualToLogicalMap.push([0, 0]);
    }
    currentVisualCursor = [0, 0];
  } else if (
    logicalCursor[0] === logicalLines.length - 1 &&
    logicalCursor[1] === cpLen(logicalLines[logicalLines.length - 1]) &&
    visualLines.length > 0
  ) {
    const lastVisLineIdx = visualLines.length - 1;
    currentVisualCursor = [lastVisLineIdx, cpLen(visualLines[lastVisLineIdx])];
  }

  return {
    visualLines,
    visualCursor: currentVisualCursor,
    logicalToVisualMap,
    visualToLogicalMap,
  };
}

// --- Reducer logic ---

interface TextBufferState {
  lines: string[];
  cursorRow: number;
  cursorCol: number;
  preferredCol: number | null;
  undoStack: UndoHistoryEntry[];
  redoStack: UndoHistoryEntry[];
  viewportWidth: number;
}

const historyLimit = 100;

type TextBufferAction =
  | { type: "set_text"; payload: string; pushToUndo?: boolean }
  | { type: "insert"; payload: string }
  | { type: "backspace" }
  | { type: "move"; payload: { dir: Direction } }
  | { type: "delete" }
  | { type: "delete_word_left" }
  | { type: "delete_word_right" }
  | { type: "kill_line_right" }
  | { type: "kill_line_left" }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "set_viewport_width"; payload: number };

export function textBufferReducer(state: TextBufferState, action: TextBufferAction): TextBufferState {
  const pushUndo = (currentState: TextBufferState): TextBufferState => {
    const snapshot = {
      lines: [...currentState.lines],
      cursorRow: currentState.cursorRow,
      cursorCol: currentState.cursorCol,
    };
    const newStack = [...currentState.undoStack, snapshot];
    if (newStack.length > historyLimit) {
      newStack.shift();
    }
    return { ...currentState, undoStack: newStack, redoStack: [] };
  };

  const currentLine = (r: number): string => state.lines[r] ?? "";
  const currentLineLen = (r: number): number => cpLen(currentLine(r));

  switch (action.type) {
    case "set_text": {
      let nextState = state;
      if (action.pushToUndo !== false) {
        nextState = pushUndo(state);
      }
      const newContentLines = action.payload.replace(/\r\n?/g, "\n").split("\n");
      const lines = newContentLines.length === 0 ? [""] : newContentLines;
      const lastNewLineIndex = lines.length - 1;
      return {
        ...nextState,
        lines,
        cursorRow: lastNewLineIndex,
        cursorCol: cpLen(lines[lastNewLineIndex] ?? ""),
        preferredCol: null,
      };
    }

    case "insert": {
      const nextState = pushUndo(state);
      const newLines = [...nextState.lines];
      let newCursorRow = nextState.cursorRow;
      let newCursorCol = nextState.cursorCol;

      const currentLine = (r: number) => newLines[r] ?? "";

      const str = stripUnsafeCharacters(action.payload);
      const parts = str.split("\n");
      const lineContent = currentLine(newCursorRow);
      const before = cpSlice(lineContent, 0, newCursorCol);
      const after = cpSlice(lineContent, newCursorCol);

      if (parts.length > 1) {
        newLines[newCursorRow] = before + parts[0];
        const remainingParts = parts.slice(1);
        const lastPartOriginal = remainingParts.pop() ?? "";
        newLines.splice(newCursorRow + 1, 0, ...remainingParts);
        newLines.splice(newCursorRow + parts.length - 1, 0, lastPartOriginal + after);
        newCursorRow = newCursorRow + parts.length - 1;
        newCursorCol = cpLen(lastPartOriginal);
      } else {
        newLines[newCursorRow] = before + parts[0] + after;
        newCursorCol = cpLen(before) + cpLen(parts[0]);
      }

      return {
        ...nextState,
        lines: newLines,
        cursorRow: newCursorRow,
        cursorCol: newCursorCol,
        preferredCol: null,
      };
    }

    case "backspace": {
      const nextState = pushUndo(state);
      const newLines = [...nextState.lines];
      let newCursorRow = nextState.cursorRow;
      let newCursorCol = nextState.cursorCol;

      const currentLine = (r: number) => newLines[r] ?? "";

      if (newCursorCol === 0 && newCursorRow === 0) return state;

      if (newCursorCol > 0) {
        const lineContent = currentLine(newCursorRow);
        newLines[newCursorRow] = cpSlice(lineContent, 0, newCursorCol - 1) + cpSlice(lineContent, newCursorCol);
        newCursorCol--;
      } else if (newCursorRow > 0) {
        const prevLineContent = currentLine(newCursorRow - 1);
        const currentLineContentVal = currentLine(newCursorRow);
        const newCol = cpLen(prevLineContent);
        newLines[newCursorRow - 1] = prevLineContent + currentLineContentVal;
        newLines.splice(newCursorRow, 1);
        newCursorRow--;
        newCursorCol = newCol;
      }

      return {
        ...nextState,
        lines: newLines,
        cursorRow: newCursorRow,
        cursorCol: newCursorCol,
        preferredCol: null,
      };
    }

    case "set_viewport_width": {
      if (action.payload === state.viewportWidth) {
        return state;
      }
      return { ...state, viewportWidth: action.payload };
    }

    case "move": {
      const { dir } = action.payload;
      const { lines, cursorRow, cursorCol, viewportWidth } = state;
      const visualLayout = calculateVisualLayout(lines, [cursorRow, cursorCol], viewportWidth);
      const { visualLines, visualCursor, visualToLogicalMap } = visualLayout;

      let newVisualRow = visualCursor[0];
      let newVisualCol = visualCursor[1];
      let newPreferredCol = state.preferredCol;

      const currentVisLineLen = cpLen(visualLines[newVisualRow] ?? "");

      switch (dir) {
        case "left":
          newPreferredCol = null;
          if (newVisualCol > 0) {
            newVisualCol--;
          } else if (newVisualRow > 0) {
            newVisualRow--;
            newVisualCol = cpLen(visualLines[newVisualRow] ?? "");
          }
          break;
        case "right":
          newPreferredCol = null;
          if (newVisualCol < currentVisLineLen) {
            newVisualCol++;
          } else if (newVisualRow < visualLines.length - 1) {
            newVisualRow++;
            newVisualCol = 0;
          }
          break;
        case "up":
          if (newVisualRow > 0) {
            if (newPreferredCol === null) newPreferredCol = newVisualCol;
            newVisualRow--;
            newVisualCol = clamp(newPreferredCol, 0, cpLen(visualLines[newVisualRow] ?? ""));
          }
          break;
        case "down":
          if (newVisualRow < visualLines.length - 1) {
            if (newPreferredCol === null) newPreferredCol = newVisualCol;
            newVisualRow++;
            newVisualCol = clamp(newPreferredCol, 0, cpLen(visualLines[newVisualRow] ?? ""));
          }
          break;
        case "home":
          newPreferredCol = null;
          newVisualCol = 0;
          break;
        case "end":
          newPreferredCol = null;
          newVisualCol = currentVisLineLen;
          break;
        case "wordLeft": {
          const { cursorRow, cursorCol, lines } = state;
          if (cursorCol === 0 && cursorRow === 0) return state;

          let newCursorRow = cursorRow;
          let newCursorCol = cursorCol;

          if (cursorCol === 0) {
            newCursorRow--;
            newCursorCol = cpLen(lines[newCursorRow] ?? "");
          } else {
            const lineContent = lines[cursorRow];
            const arr = toCodePoints(lineContent);
            let start = cursorCol;
            let onlySpaces = true;
            for (let i = 0; i < start; i++) {
              if (isWordChar(arr[i])) {
                onlySpaces = false;
                break;
              }
            }
            if (onlySpaces && start > 0) {
              start--;
            } else {
              while (start > 0 && !isWordChar(arr[start - 1])) start--;
              while (start > 0 && isWordChar(arr[start - 1])) start--;
            }
            newCursorCol = start;
          }
          return {
            ...state,
            cursorRow: newCursorRow,
            cursorCol: newCursorCol,
            preferredCol: null,
          };
        }
        case "wordRight": {
          const { cursorRow, cursorCol, lines } = state;
          if (cursorRow === lines.length - 1 && cursorCol === cpLen(lines[cursorRow] ?? "")) {
            return state;
          }

          let newCursorRow = cursorRow;
          let newCursorCol = cursorCol;
          const lineContent = lines[cursorRow] ?? "";
          const arr = toCodePoints(lineContent);

          if (cursorCol >= arr.length) {
            newCursorRow++;
            newCursorCol = 0;
          } else {
            let end = cursorCol;
            while (end < arr.length && !isWordChar(arr[end])) end++;
            while (end < arr.length && isWordChar(arr[end])) end++;
            newCursorCol = end;
          }
          return {
            ...state,
            cursorRow: newCursorRow,
            cursorCol: newCursorCol,
            preferredCol: null,
          };
        }
        default:
          break;
      }

      if (visualToLogicalMap[newVisualRow]) {
        const [logRow, logStartCol] = visualToLogicalMap[newVisualRow];
        return {
          ...state,
          cursorRow: logRow,
          cursorCol: clamp(logStartCol + newVisualCol, 0, cpLen(state.lines[logRow] ?? "")),
          preferredCol: newPreferredCol,
        };
      }
      return state;
    }

    case "delete": {
      const { cursorRow, cursorCol, lines } = state;
      const lineContent = currentLine(cursorRow);
      if (cursorCol < currentLineLen(cursorRow)) {
        const nextState = pushUndo(state);
        const newLines = [...nextState.lines];
        newLines[cursorRow] = cpSlice(lineContent, 0, cursorCol) + cpSlice(lineContent, cursorCol + 1);
        return { ...nextState, lines: newLines, preferredCol: null };
      } else if (cursorRow < lines.length - 1) {
        const nextState = pushUndo(state);
        const nextLineContent = currentLine(cursorRow + 1);
        const newLines = [...nextState.lines];
        newLines[cursorRow] = lineContent + nextLineContent;
        newLines.splice(cursorRow + 1, 1);
        return { ...nextState, lines: newLines, preferredCol: null };
      }
      return state;
    }

    case "delete_word_left": {
      const { cursorRow, cursorCol } = state;
      if (cursorCol === 0 && cursorRow === 0) return state;
      if (cursorCol === 0) {
        const nextState = pushUndo(state);
        const prevLineContent = currentLine(cursorRow - 1);
        const currentLineContentVal = currentLine(cursorRow);
        const newCol = cpLen(prevLineContent);
        const newLines = [...nextState.lines];
        newLines[cursorRow - 1] = prevLineContent + currentLineContentVal;
        newLines.splice(cursorRow, 1);
        return {
          ...nextState,
          lines: newLines,
          cursorRow: cursorRow - 1,
          cursorCol: newCol,
          preferredCol: null,
        };
      }
      const nextState = pushUndo(state);
      const lineContent = currentLine(cursorRow);
      const arr = toCodePoints(lineContent);
      let start = cursorCol;
      let onlySpaces = true;
      for (let i = 0; i < start; i++) {
        if (isWordChar(arr[i])) {
          onlySpaces = false;
          break;
        }
      }
      if (onlySpaces && start > 0) {
        start--;
      } else {
        while (start > 0 && !isWordChar(arr[start - 1])) start--;
        while (start > 0 && isWordChar(arr[start - 1])) start--;
      }
      const newLines = [...nextState.lines];
      newLines[cursorRow] = cpSlice(lineContent, 0, start) + cpSlice(lineContent, cursorCol);
      return {
        ...nextState,
        lines: newLines,
        cursorCol: start,
        preferredCol: null,
      };
    }

    case "delete_word_right": {
      const { cursorRow, cursorCol, lines } = state;
      const lineContent = currentLine(cursorRow);
      const arr = toCodePoints(lineContent);
      if (cursorCol >= arr.length && cursorRow === lines.length - 1) return state;
      if (cursorCol >= arr.length) {
        const nextState = pushUndo(state);
        const nextLineContent = currentLine(cursorRow + 1);
        const newLines = [...nextState.lines];
        newLines[cursorRow] = lineContent + nextLineContent;
        newLines.splice(cursorRow + 1, 1);
        return { ...nextState, lines: newLines, preferredCol: null };
      }
      const nextState = pushUndo(state);
      let end = cursorCol;
      while (end < arr.length && !isWordChar(arr[end])) end++;
      while (end < arr.length && isWordChar(arr[end])) end++;
      const newLines = [...nextState.lines];
      newLines[cursorRow] = cpSlice(lineContent, 0, cursorCol) + cpSlice(lineContent, end);
      return { ...nextState, lines: newLines, preferredCol: null };
    }

    case "kill_line_right": {
      const { cursorRow, cursorCol, lines } = state;
      const lineContent = currentLine(cursorRow);
      if (cursorCol < currentLineLen(cursorRow)) {
        const nextState = pushUndo(state);
        const newLines = [...nextState.lines];
        newLines[cursorRow] = cpSlice(lineContent, 0, cursorCol);
        return { ...nextState, lines: newLines };
      } else if (cursorRow < lines.length - 1) {
        const nextState = pushUndo(state);
        const nextLineContent = currentLine(cursorRow + 1);
        const newLines = [...nextState.lines];
        newLines[cursorRow] = lineContent + nextLineContent;
        newLines.splice(cursorRow + 1, 1);
        return { ...nextState, lines: newLines, preferredCol: null };
      }
      return state;
    }

    case "kill_line_left": {
      const { cursorRow, cursorCol } = state;
      if (cursorCol > 0) {
        const nextState = pushUndo(state);
        const lineContent = currentLine(cursorRow);
        const newLines = [...nextState.lines];
        newLines[cursorRow] = cpSlice(lineContent, cursorCol);
        return {
          ...nextState,
          lines: newLines,
          cursorCol: 0,
          preferredCol: null,
        };
      }
      return state;
    }

    case "undo": {
      const stateToRestore = state.undoStack[state.undoStack.length - 1];
      if (!stateToRestore) return state;

      const currentSnapshot = {
        lines: [...state.lines],
        cursorRow: state.cursorRow,
        cursorCol: state.cursorCol,
      };
      return {
        ...state,
        ...stateToRestore,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, currentSnapshot],
      };
    }

    case "redo": {
      const stateToRestore = state.redoStack[state.redoStack.length - 1];
      if (!stateToRestore) return state;

      const currentSnapshot = {
        lines: [...state.lines],
        cursorRow: state.cursorRow,
        cursorCol: state.cursorCol,
      };
      return {
        ...state,
        ...stateToRestore,
        redoStack: state.redoStack.slice(0, -1),
        undoStack: [...state.undoStack, currentSnapshot],
      };
    }

    default: {
      return state;
    }
  }
}

// TextBuffer interface matching gemini-cli's pattern
export interface TextBuffer {
  // State (match gemini-cli exactly)
  lines: string[];
  text: string;
  cursor: [number, number]; // Logical cursor [row, col]
  preferredCol: number | null;
  selectionAnchor: [number, number] | null;

  // Visual state (handles wrapping)
  allVisualLines: string[];
  viewportVisualLines: string[];
  visualCursor: [number, number]; // Visual cursor [row, col]
  visualScrollRow: number;

  // Actions (match gemini-cli methods)
  setText: (text: string) => void;
  insert: (text: string) => void;
  newline: () => void;
  backspace: () => void;
  del: () => void;
  move: (direction: Direction) => void;
  undo: () => void;
  redo: () => void;
  deleteWordLeft: () => void;
  deleteWordRight: () => void;
  killLineRight: () => void;
  killLineLeft: () => void;
  handleInput: (key: Key) => void;
}

export type UseTextBufferReturn = TextBuffer;

/**
 * Complete TextBuffer implementation with sophisticated visual layout and input handling
 */
export function useTextBuffer({
  initialText = "",
  initialCursorOffset = 0,
  viewport,
  stdin,
  setRawMode,
  onChange,
  isValidPath,
}: UseTextBufferOptions): UseTextBufferReturn {
  const initialState = useMemo((): TextBufferState => {
    const lines = initialText.split("\n");
    const [initialCursorRow, initialCursorCol] = calculateInitialCursorPosition(
      lines.length === 0 ? [""] : lines,
      initialCursorOffset
    );
    return {
      lines: lines.length === 0 ? [""] : lines,
      cursorRow: initialCursorRow,
      cursorCol: initialCursorCol,
      preferredCol: null,
      undoStack: [],
      redoStack: [],
      viewportWidth: viewport.width,
    };
  }, [initialText, initialCursorOffset, viewport.width]);

  const [state, dispatch] = useReducer(textBufferReducer, initialState);
  const { lines, cursorRow, cursorCol, preferredCol } = state;

  const text = useMemo(() => lines.join("\n"), [lines]);

  const visualLayout = useMemo(
    () => calculateVisualLayout(lines, [cursorRow, cursorCol], state.viewportWidth),
    [lines, cursorRow, cursorCol, state.viewportWidth]
  );

  const { visualLines, visualCursor } = visualLayout;

  const [visualScrollRow, setVisualScrollRow] = useState<number>(0);

  useEffect(() => {
    if (onChange) {
      onChange(text);
    }
  }, [text, onChange]);

  useEffect(() => {
    dispatch({ type: "set_viewport_width", payload: viewport.width });
  }, [viewport.width]);

  // Update visual scroll (vertical)
  useEffect(() => {
    const { height } = viewport;
    let newVisualScrollRow = visualScrollRow;

    if (visualCursor[0] < visualScrollRow) {
      newVisualScrollRow = visualCursor[0];
    } else if (visualCursor[0] >= visualScrollRow + height) {
      newVisualScrollRow = visualCursor[0] - height + 1;
    }
    if (newVisualScrollRow !== visualScrollRow) {
      setVisualScrollRow(newVisualScrollRow);
    }
  }, [visualCursor, visualScrollRow, viewport]);

  const insert = useCallback(
    (ch: string): void => {
      // Basic drag-and-drop path detection (like gemini-cli)
      const minLengthToInferAsDragDrop = 3;
      if (ch.length >= minLengthToInferAsDragDrop) {
        let potentialPath = ch;
        if (potentialPath.length > 2 && potentialPath.startsWith("'") && potentialPath.endsWith("'")) {
          potentialPath = ch.slice(1, -1);
        }

        potentialPath = potentialPath.trim();
        if (isValidPath(potentialPath)) {
          ch = `@${potentialPath}`;
        }
      }

      dispatch({ type: "insert", payload: ch });
    },
    [isValidPath]
  );

  const newline = useCallback((): void => {
    dispatch({ type: "insert", payload: "\n" });
  }, []);

  const backspace = useCallback((): void => {
    dispatch({ type: "backspace" });
  }, []);

  const del = useCallback((): void => {
    dispatch({ type: "delete" });
  }, []);

  const move = useCallback((dir: Direction): void => {
    dispatch({ type: "move", payload: { dir } });
  }, []);

  const undo = useCallback((): void => {
    dispatch({ type: "undo" });
  }, []);

  const redo = useCallback((): void => {
    dispatch({ type: "redo" });
  }, []);

  const setText = useCallback((newText: string): void => {
    dispatch({ type: "set_text", payload: newText });
  }, []);

  const deleteWordLeft = useCallback((): void => {
    dispatch({ type: "delete_word_left" });
  }, []);

  const deleteWordRight = useCallback((): void => {
    dispatch({ type: "delete_word_right" });
  }, []);

  const killLineRight = useCallback((): void => {
    dispatch({ type: "kill_line_right" });
  }, []);

  const killLineLeft = useCallback((): void => {
    dispatch({ type: "kill_line_left" });
  }, []);

  // Comprehensive input handling with consistent UX pattern
  const handleInput = useCallback(
    (key: Key): void => {
      const { sequence: input } = key;

      // Only insert newline on Shift+Enter, let parent components handle plain Enter
      if (
        (key.name === "return" && key.shift && !key.ctrl && !key.meta) ||
        (key.shift && (input === "\r" || input === "\n" || input === "\\\r"))
      )
        newline();
      else if (key.name === "left" && !key.meta && !key.ctrl) move("left");
      else if (key.ctrl && key.name === "b") move("left");
      else if (key.name === "right" && !key.meta && !key.ctrl) move("right");
      else if (key.ctrl && key.name === "f") move("right");
      else if (key.name === "up") move("up");
      else if (key.name === "down") move("down");
      else if ((key.ctrl || key.meta) && key.name === "left") move("wordLeft");
      else if (key.meta && key.name === "b") move("wordLeft");
      else if ((key.ctrl || key.meta) && key.name === "right") move("wordRight");
      else if (key.meta && key.name === "f") move("wordRight");
      else if (key.name === "home") move("home");
      else if (key.ctrl && key.name === "a") move("home");
      else if (key.name === "end") move("end");
      else if (key.ctrl && key.name === "e") move("end");
      else if (key.ctrl && key.name === "w") deleteWordLeft();
      else if ((key.meta || key.ctrl) && (key.name === "backspace" || input === "\x7f")) deleteWordLeft();
      else if ((key.meta || key.ctrl) && key.name === "delete") deleteWordRight();
      else if (key.name === "backspace" || input === "\x7f" || (key.ctrl && key.name === "h")) backspace();
      else if (key.name === "delete" || (key.ctrl && key.name === "d")) del();
      else if (input && !key.ctrl && !key.meta) {
        // Filter out escape sequences that should not be inserted as text
        if (input.startsWith("\x1b[") || input.startsWith("\x1B[")) {
          // Skip escape sequences like Shift+Tab (\x1B[Z), arrow keys, etc.
          return;
        }
        insert(input);
      }
    },
    [newline, move, deleteWordLeft, deleteWordRight, backspace, del, insert]
  );

  const renderedVisualLines = useMemo(
    () => visualLines.slice(visualScrollRow, visualScrollRow + viewport.height),
    [visualLines, visualScrollRow, viewport.height]
  );

  const textBuffer: TextBuffer = {
    // State (match gemini-cli exactly)
    lines,
    text,
    cursor: [cursorRow, cursorCol],
    preferredCol,
    selectionAnchor: null,

    // Visual state (handles wrapping)
    allVisualLines: visualLines,
    viewportVisualLines: renderedVisualLines,
    visualCursor,
    visualScrollRow,

    // Actions (match gemini-cli methods)
    setText,
    insert,
    newline,
    backspace,
    del,
    move,
    undo,
    redo,
    deleteWordLeft,
    deleteWordRight,
    killLineRight,
    killLineLeft,
    handleInput,
  };

  return textBuffer;
}
