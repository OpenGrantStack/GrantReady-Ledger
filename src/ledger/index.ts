export * from './types';
export * from './core';
export * from './blockchain-adapters';

import { LedgerCore } from './core';
import { BlockchainAdapterFactory } from './blockchain-adapters';
import { logger } from '../utils/logger';

export let ledger: LedgerCore;
export let blockchainAdapter: any;

export async function initializeLedger(): Promise<void> {
  try {
    // Initialize ledger core
    ledger = LedgerCore.getInstance();
    
    // Initialize blockchain adapter
    blockchainAdapter = BlockchainAdapterFactory.createAdapter();
    
    logger.info(`Ledger initialized with ${blockchainAdapter.type} adapter`);
    
    // Verify initial integrity
    const integrityCheck = await ledger.verifyIntegrity();
    if (!integrityCheck.valid) {
      logger.warn('Ledger integrity check found issues:', integrityCheck.errors);
    } else {
      logger.info('Ledger integrity verified');
    }
    
  } catch (error) {
    logger.error('Failed to initialize ledger:', error);
    throw error;
  }
}

export function getLedger(): LedgerCore {
  if (!ledger) {
    throw new Error('Ledger not initialized. Call initializeLedger() first.');
  }
  return ledger;
}
