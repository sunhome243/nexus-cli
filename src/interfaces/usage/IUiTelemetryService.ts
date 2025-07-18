/**
 * UI Telemetry Service Interface
 * Defines the contract for UI telemetry tracking
 */

// Telemetry data types for better type safety
export interface TelemetryEventData {
  timestamp?: Date;
  sessionId?: string;
  userId?: string;
  provider?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface TelemetryInteractionData {
  timestamp?: Date;
  element?: string;
  action?: string;
  duration?: number;
  value?: string | number;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface TelemetryData {
  events: Array<{
    name: string;
    data: TelemetryEventData;
    timestamp: Date;
  }>;
  interactions: Array<{
    name: string;
    data: TelemetryInteractionData;
    timestamp: Date;
  }>;
  sessionInfo: {
    sessionId: string;
    startTime: Date;
    endTime?: Date;
    provider?: string;
    userAgent?: string;
  };
  summary: {
    totalEvents: number;
    totalInteractions: number;
    sessionDuration: number;
    uniqueEvents: number;
  };
}

export interface IUiTelemetryService {
  /**
   * Initialize the service
   */
  initialize(): Promise<void>;

  /**
   * Cleanup the service
   */
  cleanup(): Promise<void>;

  /**
   * Track UI event
   */
  trackEvent(event: string, data?: TelemetryEventData): void;

  /**
   * Track user interaction
   */
  trackInteraction(interaction: string, data?: TelemetryInteractionData): void;

  /**
   * Get telemetry data
   */
  getTelemetryData(): TelemetryData;

  /**
   * Clear telemetry data
   */
  clearData(): void;
}