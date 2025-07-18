import React from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../../shared/ThemeProvider.js';
import { formatUtils } from '../../shared/ThemeUtils.js';
import { useStdout } from 'ink';

// Constants for visual formatting
const DEFAULT_TAB_WIDTH = 4;
const LINE_NUMBER_WIDTH = 4;
const MAX_CONTEXT_LINES_WITHOUT_GAP = 5;
const MAX_VISIBLE_LINES = 30; // Default max lines to show before overflow

// Unified diff parsing types
interface DiffLine {
  type: 'add' | 'del' | 'context' | 'hunk' | 'header' | 'other';
  oldLine?: number;
  newLine?: number;
  content: string;
}

interface ParsedDiff {
  fileName?: string;
  lines: DiffLine[];
}

/**
 * Normalize tabs to spaces for consistent display
 */
function normalizeWhitespace(content: string, tabWidth: number = DEFAULT_TAB_WIDTH): string {
  return content.replace(/\t/g, ' '.repeat(tabWidth));
}

/**
 * Parse unified diff format into structured data
 */
function parseUnifiedDiff(diffContent: string): ParsedDiff {
  const lines = diffContent.split('\n');
  const result: DiffLine[] = [];
  let currentOldLine = 0;
  let currentNewLine = 0;
  let inHunk = false;
  let fileName: string | undefined;

  const hunkHeaderRegex = /^@@ -(\d+),?\d* \+(\d+),?\d* @@/;

  for (const line of lines) {
    // Extract filename from Index line
    if (line.startsWith('Index: ')) {
      fileName = line.substring(7).trim();
      result.push({ type: 'header', content: line });
      continue;
    }

    // Handle standard diff headers
    if (line.startsWith('===') || line.startsWith('---') || line.startsWith('+++')) {
      result.push({ type: 'header', content: line });
      continue;
    }

    // Handle hunk headers
    const hunkMatch = line.match(hunkHeaderRegex);
    if (hunkMatch) {
      currentOldLine = parseInt(hunkMatch[1], 10) - 1; // -1 because we increment before use
      currentNewLine = parseInt(hunkMatch[2], 10) - 1;
      inHunk = true;
      result.push({ type: 'hunk', content: line });
      continue;
    }

    if (!inHunk) {
      // Skip non-hunk content when not in a hunk
      result.push({ type: 'other', content: line });
      continue;
    }

    // Parse hunk content
    if (line.startsWith('+')) {
      currentNewLine++;
      result.push({
        type: 'add',
        newLine: currentNewLine,
        content: normalizeWhitespace(line.substring(1)),
      });
    } else if (line.startsWith('-')) {
      currentOldLine++;
      result.push({
        type: 'del',
        oldLine: currentOldLine,
        content: normalizeWhitespace(line.substring(1)),
      });
    } else if (line.startsWith(' ')) {
      currentOldLine++;
      currentNewLine++;
      result.push({
        type: 'context',
        oldLine: currentOldLine,
        newLine: currentNewLine,
        content: normalizeWhitespace(line.substring(1)),
      });
    } else if (line.startsWith('\\')) {
      // Handle "\ No newline at end of file"
      result.push({ type: 'other', content: line });
    } else if (line.trim() === '') {
      // Handle empty lines in diff
      result.push({ type: 'other', content: line });
    }
  }

  return { fileName, lines: result };
}

export interface DiffEdit {
  old_string: string;
  new_string: string;
}

export interface DiffRendererProps {
  filePath?: string;
  edit?: DiffEdit;
  edits?: DiffEdit[];
  fileDiff?: string;  // New: unified diff content
  fileName?: string;  // New: filename for unified diff
  showFileName?: boolean;
  showStats?: boolean;
}

// Unified diff renderer component
interface UnifiedDiffRendererProps {
  diffContent: string;
  fileName?: string;
  showFileName: boolean;
  showStats: boolean;
  theme: any;
  maxHeight?: number;
}

const UnifiedDiffRenderer: React.FC<UnifiedDiffRendererProps> = ({
  diffContent,
  fileName,
  showFileName,
  showStats,
  theme,
  maxHeight = MAX_VISIBLE_LINES
}) => {
  const parsedDiff = parseUnifiedDiff(diffContent);
  const displayFileName = fileName || parsedDiff.fileName || 'Unknown file';
  
  // Calculate stats
  const stats = parsedDiff.lines.reduce((acc, line) => {
    if (line.type === 'add') acc.additions++;
    else if (line.type === 'del') acc.deletions++;
    return acc;
  }, { additions: 0, deletions: 0 });

  // Track line numbers for gap detection
  let lastLineNumber: number | null = null;
  const renderedLines: React.ReactNode[] = [];

  parsedDiff.lines.forEach((line, index) => {
    const key = `line-${index}`;
    
    // Check if we need to add a gap indicator
    if (line.type === 'add' || line.type === 'del' || line.type === 'context') {
      const relevantLineNumber = line.type === 'del' ? line.oldLine : line.newLine;
      
      if (lastLineNumber !== null && relevantLineNumber && 
          relevantLineNumber > lastLineNumber + MAX_CONTEXT_LINES_WITHOUT_GAP + 1) {
        renderedLines.push(
          <Box key={`gap-${index}`}>
            <Text color={theme.border.subtle}>{'═'.repeat(50)}</Text>
          </Box>
        );
      }
      
      if (relevantLineNumber) {
        lastLineNumber = relevantLineNumber;
      }
    }
    
    switch (line.type) {
      case 'header':
        renderedLines.push(
          <Text key={key} color={theme.text.muted} bold>
            {line.content}
          </Text>
        );
        break;
        
      case 'hunk':
        renderedLines.push(
          <Text key={key} color={theme.interaction.secondary} bold>
            {line.content}
          </Text>
        );
        break;
        
      case 'add':
        renderedLines.push(
          <Box key={key} flexDirection="row">
            <Text color={theme.text.muted}>
              {line.newLine ? line.newLine.toString().padEnd(LINE_NUMBER_WIDTH) : ' '.repeat(LINE_NUMBER_WIDTH)} 
            </Text>
            <Text color={theme.status.success}>
              + {line.content}
            </Text>
          </Box>
        );
        break;
        
      case 'del':
        renderedLines.push(
          <Box key={key} flexDirection="row">
            <Text color={theme.text.muted}>
              {line.oldLine ? line.oldLine.toString().padEnd(LINE_NUMBER_WIDTH) : ' '.repeat(LINE_NUMBER_WIDTH)} 
            </Text>
            <Text color={theme.status.danger}>
              - {line.content}
            </Text>
          </Box>
        );
        break;
        
      case 'context':
        renderedLines.push(
          <Box key={key} flexDirection="row">
            <Text color={theme.text.muted}>
              {line.oldLine ? line.oldLine.toString().padEnd(LINE_NUMBER_WIDTH) : ' '.repeat(LINE_NUMBER_WIDTH)} 
            </Text>
            <Text color={theme.text.primary} dimColor>
              {'  '}{line.content}
            </Text>
          </Box>
        );
        break;
        
      default:
        if (line.content.trim()) {
          renderedLines.push(
            <Text key={key} color={theme.text.muted}>
              {line.content}
            </Text>
          );
        }
        break;
    }
  });

  // Handle overflow
  const visibleLines = renderedLines.slice(0, maxHeight);
  const hiddenCount = renderedLines.length - maxHeight;
  const hasOverflow = hiddenCount > 0;

  return (
    <Box flexDirection="column">
      {showFileName && (
        <Box marginBottom={1}>
          <Text color={theme.interaction.primary} bold>{displayFileName}</Text>
        </Box>
      )}
      
      {showStats && (
        <Box marginBottom={1}>
          <Text color={theme.status.success}>+{stats.additions} </Text>
          <Text color={theme.status.danger}>-{stats.deletions} </Text>
          <Text color={theme.text.muted}>
            ({stats.additions + stats.deletions} changes)
          </Text>
        </Box>
      )}
      
      <Box borderStyle="single" borderColor={theme.border.default} paddingX={1} flexDirection="column">
        {visibleLines}
        {hasOverflow && (
          <Box marginTop={1}>
            <Text color={theme.text.muted}>
              ... {hiddenCount} more line{hiddenCount === 1 ? '' : 's'} hidden ...
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export const DiffRenderer: React.FC<DiffRendererProps> = ({
  filePath,
  edit,
  edits,
  fileDiff,
  fileName,
  showFileName = true,
  showStats = true
}) => {
  const { theme } = useTheme();
  const { stdout } = useStdout();
  
  // Calculate max height based on terminal size
  const terminalHeight = stdout?.rows || 40;
  const maxHeight = Math.min(MAX_VISIBLE_LINES, Math.floor(terminalHeight * 0.6));
  
  // Priority 1: Unified diff format (Gemini tools)
  if (fileDiff) {
    return (
      <UnifiedDiffRenderer
        diffContent={fileDiff}
        fileName={fileName}
        showFileName={showFileName}
        showStats={showStats}
        theme={theme}
        maxHeight={maxHeight}
      />
    );
  }
  
  // Priority 2: Edit-based format (Claude tools)
  if (!edit && (!edits || edits.length === 0)) {
    return null;
  }

  const displayFileName = filePath ? filePath.split('/').pop() : 'Unknown file';
  const truncatedPath = filePath ? formatUtils.truncatePath(filePath) : undefined;
  
  if (edit) {
    return (
      <SingleEditRenderer
        edit={edit}
        fileName={displayFileName}
        filePath={truncatedPath}
        showFileName={showFileName}
        showStats={showStats}
        theme={theme}
        maxHeight={maxHeight}
      />
    );
  }

  if (edits) {
    return (
      <MultiEditRenderer
        edits={edits}
        fileName={displayFileName}
        filePath={truncatedPath}
        showFileName={showFileName}
        showStats={showStats}
        theme={theme}
        maxHeight={maxHeight}
      />
    );
  }

  return null;
};

interface SingleEditRendererProps {
  edit: DiffEdit;
  fileName?: string;
  filePath?: string;
  showFileName: boolean;
  showStats: boolean;
  theme: any;
  maxHeight?: number;
}

const SingleEditRenderer: React.FC<SingleEditRendererProps> = ({
  edit,
  fileName,
  filePath,
  showFileName,
  showStats,
  theme,
  maxHeight = MAX_VISIBLE_LINES
}) => {
  const { old_string, new_string } = edit;
  
  if (old_string === undefined || old_string === null || new_string === undefined || new_string === null) {
    return null;
  }
  
  // Normalize tabs in content
  const normalizedOld = normalizeWhitespace(old_string);
  const normalizedNew = normalizeWhitespace(new_string);
  
  const oldLines = normalizedOld.split('\n');
  const newLines = normalizedNew.split('\n');
  
  // Calculate total lines for overflow handling
  const totalLines = oldLines.length + newLines.length + (oldLines.length > 0 && newLines.length > 0 ? 1 : 0); // +1 for separator
  const hasOverflow = totalLines > maxHeight;
  
  let visibleOldLines = oldLines;
  let visibleNewLines = newLines;
  let hiddenCount = 0;
  
  if (hasOverflow) {
    // Simple strategy: show as many complete sections as possible
    if (oldLines.length <= maxHeight / 2) {
      visibleOldLines = oldLines;
      visibleNewLines = newLines.slice(0, maxHeight - oldLines.length - 1);
      hiddenCount = newLines.length - visibleNewLines.length;
    } else {
      visibleOldLines = oldLines.slice(0, Math.floor(maxHeight / 2));
      visibleNewLines = newLines.slice(0, Math.floor(maxHeight / 2));
      hiddenCount = (oldLines.length - visibleOldLines.length) + (newLines.length - visibleNewLines.length);
    }
  }
  
  return (
    <Box flexDirection="column">
      {showFileName && fileName && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color={theme.interaction.primary} bold>{fileName}</Text>
          {filePath && <Text color={theme.text.muted}> ({filePath})</Text>}
        </Box>
      )}
      
      {showStats && (
        <Box marginBottom={1} flexDirection="column">
          <Box>
            <Text color={theme.text.muted}>Single edit</Text>
          </Box>
          <Box>
            <Text color={theme.status.danger}>-{oldLines.length} </Text>
            <Text color={theme.status.success}>+{newLines.length} </Text>
            <Text color={theme.text.muted}>
              ({Math.abs(newLines.length - oldLines.length)} net change)
            </Text>
          </Box>
        </Box>
      )}
      
      <Box borderStyle="single" borderColor={theme.border.default} paddingX={1} flexDirection="column">
        <Box marginBottom={1}>
          <Text color={theme.interaction.secondary} bold>@@ -1,{oldLines.length} +1,{newLines.length} @@</Text>
        </Box>
        
        {/* Show deletion lines with line numbers and - prefix */}
        {visibleOldLines.map((line, index) => (
          <Box key={`old-${index}`}>
            <Text color={theme.text.muted}>
              {(index + 1).toString().padEnd(LINE_NUMBER_WIDTH)} 
            </Text>
            <Text color={theme.status.danger}>
              - {line}
            </Text>
          </Box>
        ))}
        
        {/* Visual separator between deletions and additions */}
        {visibleOldLines.length > 0 && visibleNewLines.length > 0 && (
          <Box marginY={1}>
            <Text color={theme.border.subtle}>{'═'.repeat(50)}</Text>
          </Box>
        )}
        
        {/* Show addition lines with line numbers and + prefix */}
        {visibleNewLines.map((line, index) => (
          <Box key={`new-${index}`}>
            <Text color={theme.text.muted}>
              {(index + 1).toString().padEnd(LINE_NUMBER_WIDTH)} 
            </Text>
            <Text color={theme.status.success}>
              + {line}
            </Text>
          </Box>
        ))}
        
        {/* Overflow indicator */}
        {hasOverflow && (
          <Box marginTop={1}>
            <Text color={theme.text.muted}>
              ... {hiddenCount} more line{hiddenCount === 1 ? '' : 's'} hidden ...
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
};

interface MultiEditRendererProps {
  edits: DiffEdit[];
  fileName?: string;
  filePath?: string;
  showFileName: boolean;
  showStats: boolean;
  theme: any;
  maxHeight?: number;
}

const MultiEditRenderer: React.FC<MultiEditRendererProps> = ({
  edits,
  fileName,
  filePath,
  showFileName,
  showStats,
  theme,
  maxHeight = MAX_VISIBLE_LINES
}) => {
  if (!edits || edits.length === 0) {
    return null;
  }
  
  // Calculate overall stats with normalized content
  const stats = edits.reduce((acc, edit) => {
    if (edit.old_string && edit.new_string) {
      acc.additions += normalizeWhitespace(edit.new_string).split('\n').length;
      acc.deletions += normalizeWhitespace(edit.old_string).split('\n').length;
    }
    return acc;
  }, { additions: 0, deletions: 0 });
  
  return (
    <Box flexDirection="column">
      {showFileName && fileName && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color={theme.interaction.primary} bold>{fileName}</Text>
          {filePath && <Text color={theme.text.muted}> ({filePath})</Text>}
        </Box>
      )}
      
      {showStats && (
        <Box marginBottom={1} flexDirection="column">
          <Box>
            <Text color={theme.text.muted}>{edits.length} edits in this file</Text>
          </Box>
          <Box>
            <Text color={theme.status.success}>+{stats.additions} </Text>
            <Text color={theme.status.danger}>-{stats.deletions} </Text>
            <Text color={theme.text.muted}>
              ({stats.additions + stats.deletions} total changes)
            </Text>
          </Box>
        </Box>
      )}
      
      <Box borderStyle="single" borderColor={theme.border.default} paddingX={1} flexDirection="column">
        <Box marginBottom={1}>
          <Text color={theme.interaction.secondary} bold>@@ Multiple Changes @@</Text>
        </Box>
        
        {/* Handle overflow for multiple edits */}
        {(() => {
          let linesUsed = 1; // Header line
          const editElements: React.ReactNode[] = [];
          let totalHiddenLines = 0;
          let hiddenEdits = 0;
          
          for (let editIndex = 0; editIndex < edits.length; editIndex++) {
            const edit = edits[editIndex];
            
            if (!edit.old_string || !edit.new_string) {
              if (linesUsed + 1 <= maxHeight) {
                editElements.push(
                  <Box key={editIndex} marginBottom={1}>
                    <Text color={theme.status.danger}>Edit {editIndex + 1}: Invalid edit data</Text>
                  </Box>
                );
                linesUsed += 1;
              } else {
                hiddenEdits++;
              }
              continue;
            }
            
            // Normalize tabs in content
            const normalizedOld = normalizeWhitespace(edit.old_string);
            const normalizedNew = normalizeWhitespace(edit.new_string);
            
            const oldLines = normalizedOld.split('\n');
            const newLines = normalizedNew.split('\n');
            
            // Calculate lines needed for this edit
            const editLinesNeeded = 1 + // Header
                                  oldLines.length + 
                                  (oldLines.length > 0 && newLines.length > 0 ? 1 : 0) + // Separator
                                  newLines.length +
                                  (editIndex < edits.length - 1 ? 1 : 0); // Bottom separator
            
            // Check if we can fit this entire edit
            if (linesUsed + editLinesNeeded <= maxHeight) {
              editElements.push(
                <Box key={editIndex} flexDirection="column" marginBottom={editIndex < edits.length - 1 ? 2 : 1}>
                  {/* Edit header with enhanced styling */}
                  <Box marginBottom={1}>
                    <Text color={theme.interaction.secondary} bold>
                      @@ Edit {editIndex + 1} - -{oldLines.length},{oldLines.length} +{newLines.length},{newLines.length} @@
                    </Text>
                  </Box>
                  
                  {/* Show deletion lines with better formatting */}
                  {oldLines.map((line: string, lineIndex: number) => (
                    <Box key={`edit-${editIndex}-old-${lineIndex}`}>
                      <Text color={theme.text.muted}>
                        {(lineIndex + 1).toString().padEnd(LINE_NUMBER_WIDTH)} 
                      </Text>
                      <Text color={theme.status.danger}>
                        - {line}
                      </Text>
                    </Box>
                  ))}
                  
                  {/* Visual separator if both old and new content exist */}
                  {oldLines.length > 0 && newLines.length > 0 && (
                    <Box marginY={1}>
                      <Text color={theme.border.subtle}>{'─'.repeat(30)}</Text>
                    </Box>
                  )}
                  
                  {/* Show addition lines with better formatting */}
                  {newLines.map((line: string, lineIndex: number) => (
                    <Box key={`edit-${editIndex}-new-${lineIndex}`}>
                      <Text color={theme.text.muted}>
                        {(lineIndex + 1).toString().padEnd(LINE_NUMBER_WIDTH)} 
                      </Text>
                      <Text color={theme.status.success}>
                        + {line}
                      </Text>
                    </Box>
                  ))}
                  
                  {editIndex < edits.length - 1 && (
                    <Box marginTop={1}>
                      <Text color={theme.border.subtle}>{'═'.repeat(50)}</Text>
                    </Box>
                  )}
                </Box>
              );
              linesUsed += editLinesNeeded;
            } else {
              // Can't fit the entire edit
              hiddenEdits++;
              totalHiddenLines += oldLines.length + newLines.length;
            }
          }
          
          // Add overflow indicator if needed
          if (hiddenEdits > 0) {
            editElements.push(
              <Box key="overflow" marginTop={1}>
                <Text color={theme.text.muted}>
                  ... {hiddenEdits} more edit{hiddenEdits === 1 ? '' : 's'} ({totalHiddenLines} lines) hidden ...
                </Text>
              </Box>
            );
          }
          
          return editElements;
        })()}
      </Box>
    </Box>
  );
};

export const useDiffRenderer = () => {
  const { theme } = useTheme();
  
  const tryRenderAsDiff = (args: any): React.ReactNode | null => {
    // Priority 1: Check for unified diff format (fileDiff property)
    if (args.fileDiff && typeof args.fileDiff === 'string') {
      return (
        <DiffRenderer
          fileDiff={args.fileDiff}
          fileName={args.fileName}
        />
      );
    }
    
    // Priority 2: Check for single edit (old_string/new_string pairs)
    if (args.old_string !== undefined && args.new_string !== undefined) {
      return (
        <DiffRenderer
          filePath={args.file_path}
          edit={{ old_string: args.old_string, new_string: args.new_string }}
        />
      );
    }
    
    // Priority 3: Check for MultiEdit pattern (edits array)
    if (args.edits && Array.isArray(args.edits)) {
      return (
        <DiffRenderer
          filePath={args.file_path}
          edits={args.edits}
        />
      );
    }
    
    // Check for nested objects that might contain diffs
    if (typeof args === 'object' && args !== null) {
      for (const [key, value] of Object.entries(args)) {
        if (typeof value === 'object' && value !== null) {
          const diffResult = tryRenderAsDiff(value);
          if (diffResult) {
            return (
              <Box flexDirection="column">
                <Text color={theme.text.muted} bold>{key}:</Text>
                {diffResult}
              </Box>
            );
          }
        }
      }
    }
    
    return null;
  };
  
  const hasDiffContent = (args: any): boolean => {
    return tryRenderAsDiff(args) !== null;
  };
  
  return {
    tryRenderAsDiff,
    hasDiffContent
  };
};

export default DiffRenderer;