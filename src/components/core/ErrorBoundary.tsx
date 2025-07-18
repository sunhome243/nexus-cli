/**
 * React Error Boundary Component
 * Catches React component errors and provides graceful fallback UI
 */

import React, { Component, ReactNode, ErrorInfo } from 'react';
import { Box, Text } from 'ink';
import { ILoggerService } from '../../interfaces/core/ILoggerService.js';

interface ErrorBoundaryProps {
  children: ReactNode;
  logger?: ILoggerService;
  fallbackMessage?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to logger service
    if (this.props.logger) {
      this.props.logger.error('React Error Boundary caught error', {
        error: error.toString(),
        stack: error.stack,
        componentStack: errorInfo.componentStack
      });
    }

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Update state with error details
    this.setState({
      error,
      errorInfo
    });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Fallback UI
      return (
        <Box flexDirection="column" paddingTop={1} paddingBottom={1}>
          <Text color="red" bold>
            ❌ An unexpected error occurred
          </Text>
          <Text color="yellow">
            {this.props.fallbackMessage || 'The application encountered an error and needs to restart.'}
          </Text>
          {this.state.error && (
            <Box marginTop={1}>
              <Text color="gray" dimColor>
                Error: {this.state.error.message}
              </Text>
            </Box>
          )}
          <Box marginTop={1}>
            <Text color="cyan">
              Press Ctrl+C to exit and restart the application.
            </Text>
          </Box>
        </Box>
      );
    }

    return this.props.children;
  }

  /**
   * Reset error boundary state (useful for retry mechanisms)
   */
  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };
}

/**
 * Hook to use error boundary in functional components
 */
export function useErrorBoundary(): {
  resetBoundary: () => void;
} {
  const errorBoundaryRef = React.useRef<ErrorBoundary>(null);

  return {
    resetBoundary: () => {
      errorBoundaryRef.current?.resetError();
    }
  };
}