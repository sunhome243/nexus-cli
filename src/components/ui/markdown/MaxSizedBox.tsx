/**
 * Simplified MaxSizedBox component for markdown rendering
 * Constrains content height and shows overflow indicators
 */

import React, { Fragment } from 'react';
import { Box, Text } from 'ink';
import stringWidth from 'string-width';
import { Colors } from './colors.js';

export const MINIMUM_MAX_HEIGHT = 2;

interface MaxSizedBoxProps {
  children?: React.ReactNode;
  maxWidth?: number;
  maxHeight: number | undefined;
  overflowDirection?: 'top' | 'bottom';
  additionalHiddenLinesCount?: number;
}

interface StyledText {
  text: string;
  props: Record<string, unknown>;
}

/**
 * A simplified version of MaxSizedBox that handles content overflow
 * Used primarily by the CodeColorizer component
 */
export const MaxSizedBox: React.FC<MaxSizedBoxProps> = ({
  children,
  maxWidth,
  maxHeight,
  overflowDirection = 'top',
  additionalHiddenLinesCount = 0,
}) => {
  // If no maxHeight is specified, just render children as-is
  if (!maxHeight) {
    return <Box flexDirection="column">{children}</Box>;
  }

  const targetMaxHeight = Math.max(Math.round(maxHeight), MINIMUM_MAX_HEIGHT);
  
  // Count the number of direct Box children (lines)
  const allLines: React.ReactNode[] = [];
  
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child)) {
      if (child.type === Fragment) {
        const fragmentProps = child.props as { children?: React.ReactNode };
        React.Children.forEach(fragmentProps.children, (fragmentChild) => {
          allLines.push(fragmentChild);
        });
      } else {
        allLines.push(child);
      }
    }
  });

  const contentWillOverflow = 
    allLines.length > targetMaxHeight || additionalHiddenLinesCount > 0;
    
  const visibleContentHeight = contentWillOverflow 
    ? targetMaxHeight - 1 
    : targetMaxHeight;

  const hiddenLinesCount = Math.max(0, allLines.length - visibleContentHeight);
  const totalHiddenLines = hiddenLinesCount + additionalHiddenLinesCount;

  let visibleLines: React.ReactNode[];
  
  if (hiddenLinesCount > 0) {
    if (overflowDirection === 'top') {
      visibleLines = allLines.slice(hiddenLinesCount);
    } else {
      visibleLines = allLines.slice(0, visibleContentHeight);
    }
  } else {
    visibleLines = allLines;
  }

  return (
    <Box flexDirection="column" width={maxWidth} flexShrink={0}>
      {totalHiddenLines > 0 && overflowDirection === 'top' && (
        <Text color={Colors.Gray} wrap="truncate">
          ... first {totalHiddenLines} line{totalHiddenLines === 1 ? '' : 's'}{' '}
          hidden ...
        </Text>
      )}
      {visibleLines}
      {totalHiddenLines > 0 && overflowDirection === 'bottom' && (
        <Text color={Colors.Gray} wrap="truncate">
          ... last {totalHiddenLines} line{totalHiddenLines === 1 ? '' : 's'}{' '}
          hidden ...
        </Text>
      )}
    </Box>
  );
};