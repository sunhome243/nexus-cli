/**
 * Service Provider Context
 * Provides access to DI services in React components
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { Container } from 'inversify';
import { TYPES } from '../../infrastructure/di/types.js';
import { ILoggerService } from '../../interfaces/core/ILoggerService.js';
import { ILocalStorageService } from '../../interfaces/storage/ILocalStorageService.js';
import { IAppEventBusService } from '../../interfaces/events/IAppEventBusService.js';

interface ServiceContextType {
  logger: ILoggerService;
  storage: ILocalStorageService;
  eventBus: IAppEventBusService;
}

const ServiceContext = createContext<ServiceContextType | null>(null);

interface ServiceProviderProps {
  container: Container;
  children: ReactNode;
}

export const ServiceProvider: React.FC<ServiceProviderProps> = ({ container, children }) => {
  const logger = container.get<ILoggerService>(TYPES.LoggerService);
  const storage = container.get<ILocalStorageService>(TYPES.LocalStorageService);
  const eventBus = container.get<IAppEventBusService>(TYPES.AppEventBusService);

  return (
    <ServiceContext.Provider value={{ logger, storage, eventBus }}>
      {children}
    </ServiceContext.Provider>
  );
};

export const useServices = (): ServiceContextType => {
  const context = useContext(ServiceContext);
  if (!context) {
    throw new Error('useServices must be used within a ServiceProvider');
  }
  return context;
};