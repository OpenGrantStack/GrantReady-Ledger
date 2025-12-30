export type EntryType = 'DEBIT' | 'CREDIT' | 'ADJUSTMENT';
export type TransactionType = 'ALLOCATION' | 'DISBURSEMENT' | 'RETURN' | 'ADJUSTMENT' | 'CLOSURE';
export type AccountType = 'FUNDING' | 'DISBURSEMENT' | 'BENEFICIARY' | 'ADMINISTRATIVE' | 'RESERVE';
export type OwnerType = 'ORGANIZATION' | 'INDIVIDUAL' | 'SYSTEM';
export type SignatureType = 'ECDSA' | 'EdDSA' | 'RSA';
export type ProofType = 'ZK_SNARK' | 'ZK_STARK' | 'BULLETPROOFS';
export type EntryStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED';
export type TransactionStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'EXECUTED' | 'REJECTED' | 'CANCELLED';
export type BlockchainType = 'ETHEREUM' | 'HYPERLEDGER' | 'ZKSYNC' | 'OTHER';

export interface AccountReference {
  id: string;
  type: AccountType;
  owner: {
    id: string;
    type: OwnerType;
    name?: string;
  };
}

export interface Signature {
  signer: string;
  signature: string;
  timestamp: string;
  signatureType: SignatureType;
}

export interface ZeroKnowledgeProof {
  proofType: ProofType;
  proofData: string;
  verificationKey: string;
}

export interface BlockchainMetadata {
  blockchain: BlockchainType;
  transactionHash?: string;
  blockNumber?: number;
  gasUsed?: number;
  confirmations?: number;
}

export interface LedgerEntry {
  id: string;
  timestamp: string;
  grantCycleId: string;
  transactionId: string;
  account: AccountReference;
  amount: string;
  currency: string;
  entryType: EntryType;
  description: string;
  metadata: Record<string, any>;
  previousHash?: string;
  hash: string;
  signatures: Signature[];
  proof?: ZeroKnowledgeProof;
  status: EntryStatus;
}

export interface Transaction {
  id: string;
  timestamp: string;
  grantCycleId: string;
  transactionType: TransactionType;
  description: string;
  entries: LedgerEntry[];
  totalAmount: string;
  currency: string;
  policyId?: string;
  requiredSignatures: number;
  receivedSignatures: string[];
  status: TransactionStatus;
  executionTimestamp?: string;
  blockchainMetadata?: BlockchainMetadata;
  auditTrail: Array<{
    timestamp: string;
    action: string;
    actor: string;
    details?: Record<string, any>;
  }>;
}

export interface GrantCycle {
  id: string;
  grantId: string;
  startDate: string;
  endDate: string;
  totalAmount: string;
  currency: string;
  status: 'ACTIVE' | 'CLOSED' | 'ARCHIVED';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Balance {
  accountId: string;
  balance: string;
  currency: string;
  asOf: string;
  verified: boolean;
}

export interface VerificationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  proof?: {
    verified: boolean;
    proofType?: string;
  };
  signatures?: {
    valid: boolean;
    required: number;
    received: number;
    details: Array<{
      signer: string;
      valid: boolean;
    }>;
  };
}
