import React, { useState, useEffect } from 'react';
import { globalAnimationManager } from '../../../utils/GlobalAnimationManager.js';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { useTheme } from '../../shared/ThemeProvider.js';
import { ThoughtSummary } from '../../core/types.js';
import { ProviderRegistry } from '../../shared/ProviderRegistry.js';
import { ProviderType } from '../../../abstractions/providers/index.js';

interface LoadingIndicatorProps {
  isLoading: boolean;
  message?: string;
  currentThought?: ThoughtSummary;
  provider?: ProviderType;
}


export const LoadingIndicator = React.memo(function LoadingIndicator({ isLoading, message, currentThought, provider = ProviderType.CLAUDE }: LoadingIndicatorProps) {
  const { theme } = useTheme();
  const [currentPhrase, setCurrentPhrase] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (!isLoading) {
      setElapsedTime(0);
      setCurrentPhrase(0);
      globalAnimationManager.unsubscribe('loading-indicator');
      return;
    }

    const { phrases } = ProviderRegistry.getLoadingConfig(provider);
    let seconds = 0;
    
    // Use global animation manager for unified timing
    globalAnimationManager.subscribe('loading-indicator', () => {
      seconds++;
      setElapsedTime(seconds);
      
      // Update phrase every 3 seconds
      if (seconds % 3 === 0) {
        setCurrentPhrase(prev => (prev + 1) % phrases.length);
      }
    }, 1000); // 1000ms interval

    return () => {
      globalAnimationManager.unsubscribe('loading-indicator');
    };
  }, [isLoading, provider]);

  // Show indicator if loading OR if there's thinking content
  if (!isLoading && !currentThought) {
    return null;
  }

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  // Use thinking content if available, otherwise use message or default phrase
  const { phrases, spinnerType } = ProviderRegistry.getLoadingConfig(provider);
  const displayText = currentThought?.subject || message || phrases[currentPhrase];
  const isThinking = !!currentThought;
  const providerTheme = ProviderRegistry.getTheme(provider);
  const displayInfo = ProviderRegistry.getDisplayInfo(provider);
  const hasThinking = ProviderRegistry.hasFeature(provider, 'hasThinking');
  
  // Simplified thinking display - provider agnostic
  const getThinkingDisplay = () => {
    if (hasThinking && isThinking) {
      return `● ${displayText}`;
    } else if (isThinking) {
      return `● ${displayText}`;
    }
    return displayText;
  };
  
  const getSpinnerColor = () => {
    if (hasThinking && isThinking) {
      return theme.text.muted; // Light grey for thinking
    }
    return providerTheme.primary; // Provider brand color for active operations
  };
  
  return (
    <Box flexDirection="column">
      <Box>
        <Text color={getSpinnerColor()}>
          {/* Show spinner only when not thinking, match official gemini-cli pattern */}
          {!isThinking && <Spinner type={spinnerType} />}
          {!isThinking && " "}
          {getThinkingDisplay()}
        </Text>
        {elapsedTime > 0 && (
          <Text color={theme.text.muted}> ({formatTime(elapsedTime)})</Text>
        )}
        {/* Show provider indicator for clarity */}
        {hasThinking && (
          <Text color={theme.text.muted}> [{displayInfo.name}]</Text>
        )}
      </Box>
      {/* Show thinking description if available */}
      {currentThought?.description && (
        <Box marginTop={1} marginLeft={2}>
          <Text color={theme.text.muted}>
            {currentThought.description}
          </Text>
        </Box>
      )}
    </Box>
  );
});