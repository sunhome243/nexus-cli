import React, { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../../shared/ThemeProvider.js';
import { ISlashCommandParserService } from '../../../interfaces/commands/ISlashCommandParserService.js';
import { ISlashCommandListItem } from '../../../interfaces/commands/ISlashCommand.js';
import { ILoggerService } from '../../../interfaces/core/ILoggerService.js';
import { TextBuffer } from '../../../hooks/useTextBuffer.js';
import { useKeypress } from '../../../hooks/useKeypress.js';
import { useInputHistory } from '../../../hooks/useInputHistory.js';
import { cpSlice, cpLen } from '../../../utils/textUtils.js';
import stringWidth from 'string-width';
import { ProviderType } from '../../../abstractions/providers/index.js';

// Extended Key type to include paste property
interface ExtendedKey {
  name?: string;
  sequence?: string;
  shift?: boolean;
  ctrl?: boolean;
  meta?: boolean;
  paste?: boolean;
}

interface InputProps {
  buffer: TextBuffer; // TextBuffer passed from App level
  onSubmit: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  currentProvider?: string;
  claudePermissionMode?: string;
  projectRoot?: string; // For command history persistence
  availableCommands?: ISlashCommandListItem[]; // Available slash commands
  onSlashCommandListRequest?: () => void; // Request to list commands
  isStreaming?: boolean; // For showing cancellation option
  slashCommandParserService: ISlashCommandParserService; // Injected parser service
  inputWidth?: number; // Width for text display, passed from App
  logger: ILoggerService; // Injected logger service
}

export const Input = React.memo(function Input({ 
  buffer,
  onSubmit, 
  placeholder = 'Type your message or @path/to/file', 
  disabled = false,
  currentProvider = ProviderType.CLAUDE,
  claudePermissionMode = 'default',
  projectRoot,
  availableCommands = [],
  onSlashCommandListRequest,
  isStreaming = false,
  slashCommandParserService,
  inputWidth = 60,
  logger
}: InputProps) {
  const { theme } = useTheme();
  
  // State for slash command suggestions
  const [showingSlashCommands, setShowingSlashCommands] = useState(false);
  const [slashCommandFilter, setSlashCommandFilter] = useState('');
  
  // Input history for up/down arrow navigation
  const inputHistory = useInputHistory(
    buffer.text,
    (newText: string) => {
      buffer.setText(newText);
    },
    {
      historyType: 'chat',
      maxEntries: 50,
    }
  );
  
  // Handle text changes for slash command detection
  useEffect(() => {
    const parseResult = slashCommandParserService.parseInput(buffer.text);
    
    if (parseResult.isSlashCommand) {
      if (parseResult.isListRequest) {
        // Show all commands when just "/" is typed
        setShowingSlashCommands(true);
        setSlashCommandFilter('');
        onSlashCommandListRequest?.();
      } else if (parseResult.commandName) {
        // Show filtered commands when typing command name
        setShowingSlashCommands(true);
        setSlashCommandFilter(parseResult.commandName);
      }
    } else {
      // Hide slash commands if not a slash command
      setShowingSlashCommands(false);
      setSlashCommandFilter('');
    }
  }, [buffer.text, onSlashCommandListRequest]);
  
  // Ref to track if we just received a backslash (for Shift+Enter detection)
  const justReceivedBackslashRef = useRef(false);

  // Handle key input for submission (matching gemini-cli InputPrompt pattern)
  const handleInput = useCallback((key: ExtendedKey) => {
    // Debug logging for main input
    if (key.name === 'return' || key.sequence === '\\') {
      logger.debug('Main Input Key received', {
        component: 'Input',
        keyName: key.name,
        shift: key.shift,
        ctrl: key.ctrl,
        meta: key.meta,
        paste: key.paste,
        sequence: JSON.stringify(key.sequence)
      });
    }
    
    // Handle backslash - might be start of Shift+Enter sequence
    if (key.sequence === '\\' && !key.paste) {
      logger.debug('Received backslash - waiting for Enter to confirm Shift+Enter', {
        component: 'Input'
      });
      justReceivedBackslashRef.current = true;
      // Don't insert the backslash yet - wait to see if Enter follows
      setTimeout(() => {
        justReceivedBackslashRef.current = false;
      }, 100); // Reset after 100ms
      return;
    }
    
    // Handle Enter - check if it's part of Shift+Enter sequence
    if (key.name === 'return' && !key.paste) {
      logger.debug('Checking for Shift+Enter sequence', {
        component: 'Input',
        justReceivedBackslash: justReceivedBackslashRef.current
      });
      if (justReceivedBackslashRef.current) {
        // This is Shift+Enter sequence: backslash followed by Enter
        logger.debug('Detected Shift+Enter sequence - inserting newline', {
          component: 'Input'
        });
        justReceivedBackslashRef.current = false;
        buffer.newline();
        return;
      }
      
      // Regular Enter - submit (only if no modifier keys)
      if (!key.ctrl && !key.meta && !key.shift) {
        if (buffer.text.trim()) {
          setShowingSlashCommands(false);
          setSlashCommandFilter('');
          
          // Add to input history before submitting
          inputHistory.addEntry(buffer.text);
          
          onSubmit(buffer.text);
        }
        return;
      }
    }
    
    // For proper Shift+Enter (if terminal supports it), insert newline
    if (key.name === 'return' && key.shift && !key.paste) {
      logger.debug('Native Shift+Enter detected - inserting newline', {
        component: 'Input'
      });
      buffer.newline();
      return;
    }
    
    // If we received any other key after backslash, it wasn't Shift+Enter
    if (justReceivedBackslashRef.current) {
      logger.debug('Backslash was not Shift+Enter - inserting backslash + current key', {
        component: 'Input'
      });
      justReceivedBackslashRef.current = false;
      buffer.insert('\\'); // Insert the backslash we held back
    }
    
    // Smart up/down arrow handling: history navigation vs cursor movement
    if (key.name === 'up' && !key.ctrl && !key.meta && !key.shift) {
      // Check if cursor is at the first line - if so, navigate history
      const [cursorRow] = buffer.cursor;
      if (cursorRow === 0) {
        // At first line - try history navigation
        const didNavigate = inputHistory.navigateUp();
        if (didNavigate) {
          return; // History navigation handled, don't pass to TextBuffer
        }
      }
      // Either not at first line or no history - let TextBuffer handle cursor movement
    }
    
    if (key.name === 'down' && !key.ctrl && !key.meta && !key.shift) {
      // Check if cursor is at the last line - if so, navigate history
      const [cursorRow] = buffer.cursor;
      const lastLineIndex = buffer.lines.length - 1;
      if (cursorRow === lastLineIndex) {
        // At last line - try history navigation
        const didNavigate = inputHistory.navigateDown();
        if (didNavigate) {
          return; // History navigation handled, don't pass to TextBuffer
        }
      }
      // Either not at last line or no history - let TextBuffer handle cursor movement
    }
    
    // Reset history navigation when user types or moves cursor horizontally
    if (key.name && ['left', 'right', 'home', 'end'].includes(key.name)) {
      inputHistory.resetNavigation();
    } else if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
      // User is typing regular characters
      inputHistory.resetNavigation();
    }
    
    // Let TextBuffer handle all other input (backspace, paste, character input, navigation, etc.)
    buffer.handleInput(key as any);
  }, [buffer, onSubmit, setShowingSlashCommands, setSlashCommandFilter, inputHistory, logger]);
  
  // Set up keypress listening (only when not disabled)
  useKeypress(handleInput, { isActive: !disabled });

  // Get border color based on Claude permission mode (Claude only)
  const getBorderColor = () => {
    if (currentProvider !== ProviderType.CLAUDE) {
      return theme.interaction.primary; // Default border for Gemini
    }
    
    // Claude permission mode colors
    switch (claudePermissionMode) {
      case 'bypassPermissions':
        return theme.permission.dangerous; // Red - dangerous
      case 'acceptEdits':
        return theme.permission.moderate; // Blue - moderate
      case 'plan':
        return theme.permission.safe; // Green - safe
      case 'default':
      default:
        return theme.permission.neutral; // Grey - neutral
    }
  };

  // Use proper multiline rendering like gemini-cli (no flattening!)
  const linesToRender = buffer.viewportVisualLines;
  const [cursorVisualRowAbsolute, cursorVisualColAbsolute] = buffer.visualCursor;
  const scrollVisualRow = buffer.visualScrollRow;
  const hasText = buffer.text.length > 0;
  const showPlaceholder = !hasText && !disabled;
  
  // inputWidth is now passed as prop from App.tsx for proper synchronization
  // Debug logging removed - issue was carriage returns in text

  const borderColor = getBorderColor();
  
  return (
    <Box borderStyle="round" borderColor={borderColor} padding={1} width="100%">
      <Box width="100%" flexDirection="column">
        {/* Input with proper multiline rendering */}
        <Box width="100%">
          <Text color={borderColor} bold>
            {"> "}
          </Text>
          <Box flexGrow={1} flexDirection="column">
            {showPlaceholder ? (
              <Text color={theme.text.muted}>{placeholder}</Text>
            ) : (
              linesToRender.map((lineText, visualIdxInRenderedSet) => {
                const cursorVisualRow = cursorVisualRowAbsolute - scrollVisualRow;
                let display = cpSlice(lineText, 0, inputWidth);
                const currentVisualWidth = stringWidth(display);
                if (currentVisualWidth < inputWidth) {
                  display = display + ' '.repeat(inputWidth - currentVisualWidth);
                }
                
                // Handle cursor highlighting (matching gemini-cli exactly)
                if (visualIdxInRenderedSet === cursorVisualRow) {
                  const relativeVisualColForHighlight = cursorVisualColAbsolute;
                  
                  if (relativeVisualColForHighlight >= 0) {
                    if (relativeVisualColForHighlight < cpLen(display)) {
                      const charToHighlight =
                        cpSlice(
                          display,
                          relativeVisualColForHighlight,
                          relativeVisualColForHighlight + 1,
                        ) || ' ';
                      // Use Ink's inverse prop instead of chalk
                      const beforeCursor = cpSlice(display, 0, relativeVisualColForHighlight);
                      const afterCursor = cpSlice(display, relativeVisualColForHighlight + 1);
                      
                      return (
                        <Text key={`line-${visualIdxInRenderedSet}`} color={theme.text.primary}>
                          {beforeCursor}
                          <Text inverse>{charToHighlight}</Text>
                          {afterCursor}
                        </Text>
                      );
                    } else if (
                      relativeVisualColForHighlight === cpLen(display) &&
                      cpLen(display) === inputWidth
                    ) {
                      return (
                        <Text key={`line-${visualIdxInRenderedSet}`} color={theme.text.primary}>
                          {display}
                          <Text inverse> </Text>
                        </Text>
                      );
                    }
                  }
                }
                return (
                  <Text key={`line-${visualIdxInRenderedSet}`} color={theme.text.primary}>
                    {display}
                  </Text>
                );
              })
            )}
          </Box>
        </Box>
        
        {/* Status indicators */}
        
        {/* Slash command suggestions */}
        {showingSlashCommands && availableCommands.length > 0 && (
          <Box width="100%" marginTop={1} flexDirection="column">
            <Text color={theme.text.muted} dimColor>
              Available slash commands:
            </Text>
            {availableCommands
              .filter(cmd => slashCommandFilter === '' || cmd.name.toLowerCase().includes(slashCommandFilter.toLowerCase()))
              .slice(0, 5) // Show max 5 commands
              .map((cmd, index) => (
                <Box key={cmd.name} width="100%" marginTop={0}>
                  <Text color={theme.interaction.primary}>
                    /{cmd.name}
                  </Text>
                  {cmd.subdirectory && (
                    <Text color={theme.text.muted} dimColor>
                      {' '}(project:{cmd.subdirectory})
                    </Text>
                  )}
                  <Text color={theme.text.muted} dimColor>
                    {' '}- {cmd.description}
                  </Text>
                </Box>
              ))}
          </Box>
        )}
        
        {/* Streaming cancellation indicator */}
        {isStreaming && (
          <Box width="100%" marginTop={0}>
            <Text color={theme.text.muted} dimColor>
              [Streaming] • ESC: Cancel response
            </Text>
          </Box>
        )}
        
      </Box>
    </Box>
  );
});