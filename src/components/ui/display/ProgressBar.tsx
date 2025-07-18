import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../../shared/ThemeProvider.js';
import { globalAnimationManager } from '../../../utils/GlobalAnimationManager.js';

interface ProgressBarProps {
  isLoading: boolean;
  message?: string;
  microProgress: number; // 0-1 for smooth animation
}

export function ProgressBar({ isLoading, message = "Initializing...", microProgress }: ProgressBarProps) {
  const { theme } = useTheme();
  const [smoothProgress, setSmoothProgress] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);

  const targetProgress = microProgress;

  useEffect(() => {
    const animationId = 'progress-bar-smooth';

    // Subscribe to global animation manager for smooth updates
    globalAnimationManager.subscribe(animationId, () => {
      setSmoothProgress(current => {
        const diff = targetProgress - current;
        const step = diff * 0.15; // 15% of difference per frame
        const newProgress = Math.min(Math.max(current + step, 0), 1);
        
        // Update display progress
        setDisplayProgress(Math.floor(newProgress * 100));
        
        return newProgress;
      });
    }, 16); // 60fps

    return () => {
      globalAnimationManager.unsubscribe(animationId);
    };
  }, [targetProgress]);

  if (!isLoading) {
    return null;
  }

  const barWidth = 50;
  const filledWidth = Math.floor(smoothProgress * barWidth);
  const emptyWidth = barWidth - filledWidth;

  return (
    <Box flexDirection="column" alignItems="center" marginY={2}>
      <Box marginBottom={1}>
        <Text color={theme.interaction.primary}>{message}</Text>
      </Box>
      <Box>
        <Text color={theme.text.muted}>[</Text>
        <Text color={theme.interaction.primary}>{'█'.repeat(filledWidth)}</Text>
        <Text color={theme.text.muted}>{'░'.repeat(emptyWidth)}</Text>
        <Text color={theme.text.muted}>]</Text>
        <Text color={theme.text.muted}> {displayProgress}%</Text>
      </Box>
    </Box>
  );
}