export interface AuditQuery {
  startDate?: string;
  endDate?: string;
  grantCycleId?: string;
  transactionType?: string;
  accountId?: string;
  ownerId?: string;
  minAmount?: string;
  maxAmount?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface AuditReport {
  reportId: string;
  generatedAt: string;
  timeframe: {
    start: string;
    end: string;
  };
  summary: {
    totalTransactions: number;
    totalAmount: string;
    currency: string;
    byType: Record<string, { count: number; amount: string }>;
    byStatus: Record<string, number>;
    byAccount: Record<string, { count: number; amount: string }>;
  };
  anomalies: Array<{
    type: string;
    description: string;
    transactionId?: string;
    entryId?: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }>;
  verificationResults: {
    hashChainValid: boolean;
    signaturesValid: boolean;
    balancesValid: boolean;
    proofsValid: boolean;
    issuesFound: number;
  };
  recommendations: string[];
}

export interface VerificationRequest {
  entryIds?: string[];
  transactionIds?: string[];
  grantCycleId?: string;
  proofTypes?: string[];
  includeDetails?: boolean;
}

export interface VerificationResponse {
  requestId: string;
  timestamp: string;
  results: Array<{
    id: string;
    type: 'ENTRY' | 'TRANSACTION' | 'GRANT_CYCLE';
    valid: boolean;
    errors?: string[];
    warnings?: string[];
    proofs?: Array<{
      type: string;
      valid: boolean;
      data?: any;
    }>;
  }>;
  summary: {
    total: number;
    valid: number;
    invalid: number;
    warnings: number;
  };
}
