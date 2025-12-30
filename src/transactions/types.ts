// Re-export from ledger types
export * from '../ledger/types';

// Additional transaction-specific types
export interface ProcessingOptions {
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  timeoutMs?: number;
  retryAttempts?: number;
  requireManualApproval?: boolean;
}

export interface ProcessingResult {
  success: boolean;
  transactionId: string;
  blockchainTxHash?: string;
  timestamp: string;
  durationMs: number;
  errors?: string[];
  warnings?: string[];
}

export interface BatchProcessingResult {
  batchId: string;
  totalTransactions: number;
  successful: number;
  failed: number;
  results: ProcessingResult[];
  startedAt: string;
  completedAt: string;
}

export interface TransactionQuery {
  grantCycleId?: string;
  transactionType?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  minAmount?: string;
  maxAmount?: string;
  accountId?: string;
  ownerId?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'amount' | 'status';
  sortOrder?: 'ASC' | 'DESC';
}
