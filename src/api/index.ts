export * from './rest';
export * from './websocket';

import express from 'express';
import { setupRestAPI } from './rest';
import { WebSocketServer } from './websocket';
import { config } from '../config';
import { logger } from '../utils/logger';

export let webSocketServer: WebSocketServer;

export function initializeAPI(app: express.Application): void {
  try {
    // Setup REST API
    setupRestAPI(app);
    
    // Setup WebSocket server (will be attached when HTTP server starts)
    logger.info('API layer initialized');
    
  } catch (error) {
    logger.error('Failed to initialize API:', error);
    throw error;
  }
}

export function attachWebSocketServer(server: any): void {
  webSocketServer = new WebSocketServer(server);
}
