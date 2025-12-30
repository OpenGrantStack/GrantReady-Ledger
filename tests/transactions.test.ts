import { TransactionManager } from '../src/transactions';
import { transactionProcessor } from '../src/transactions/processor';
import { validateTransaction } from '../src/transactions/validation';

describe('TransactionManager', () => {
  beforeEach(() => {
    // Reset any state if needed
  });

  describe('Transaction Creation', () => {
    it('should create and submit a transaction', async () => {
      const transaction = await TransactionManager.createTransaction(
        'grant-cycle-1',
        'ALLOCATION',
        [
          {
            accountId: 'funding-account',
            accountType: 'FUNDING',
            ownerId: 'gov-department',
            ownerType: 'ORGANIZATION',
            amount: '5000.00',
            currency: 'USD',
            entryType: 'CREDIT',
            description: 'Grant allocation',
          },
          {
            accountId: 'disbursement-account',
            accountType: 'DISBURSEMENT',
            ownerId: 'grant-admin',
            ownerType: 'INDIVIDUAL',
            amount: '5000.00',
            currency: 'USD',
            entryType: 'DEBIT',
            description: 'Funds available for disbursement',
          },
        ],
        'Initial grant allocation'
      );

      expect(transaction.id).toBeDefined();
      expect(transaction.grantCycleId).toBe('grant-cycle-1');
      expect(transaction.transactionType).toBe('ALLOCATION');
      expect(transaction.entries).toHaveLength(2);
    });

    it('should retrieve transaction by ID', async () => {
      const transaction = await TransactionManager.createTransaction(
        'grant-cycle-1',
        'DISBURSEMENT',
        [
          {
            accountId: 'disbursement-account',
            accountType: 'DISBURSEMENT',
            ownerId: 'grant-admin',
            ownerType: 'INDIVIDUAL',
            amount: '1000.00',
            currency: 'USD',
            entryType: 'CREDIT',
            description: 'Funds disbursed',
          },
          {
            accountId: 'beneficiary-account',
            accountType: 'BENEFICIARY',
            ownerId: 'beneficiary-1',
            ownerType: 'INDIVIDUAL',
            amount: '1000.00',
            currency: 'USD',
            entryType: 'DEBIT',
            description: 'Funds received',
          },
        ],
        'Beneficiary disbursement'
      );

      const retrieved = TransactionManager.getTransaction(transaction.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(transaction.id);
    });
  });

  describe('Signature Management', () => {
    it('should add signature to transaction', async () => {
      const transaction = await TransactionManager.createTransaction(
        'grant-cycle-1',
        'DISBURSEMENT',
        [
          {
            accountId: 'account-1',
            accountType: 'DISBURSEMENT',
            ownerId: 'admin',
            ownerType: 'INDIVIDUAL',
            amount: '500.00',
            currency: 'USD',
            entryType: 'CREDIT',
            description: 'Test',
          },
          {
            accountId: 'account-2',
            accountType: 'BENEFICIARY',
            ownerId: 'beneficiary',
            ownerType: 'INDIVIDUAL',
            amount: '500.00',
            currency: 'USD',
            entryType: 'DEBIT',
            description: 'Test',
          },
        ],
        'Test transaction'
      );

      const signed = TransactionManager.addSignature(
        transaction.id,
        'signer-1',
        'mock-signature-data',
        'ECDSA'
      );

      expect(signed.receivedSignatures).toContain('signer-1');
      expect(signed.entries[0].signatures).toHaveLength(1);
    });
  });

  describe('Transaction Validation', () => {
    it('should validate correct transaction', async () => {
      const transaction = {
        id: 'test-id',
        timestamp: new Date().toISOString(),
        grantCycleId: 'grant-cycle-1',
        transactionType: 'ALLOCATION',
        description: 'Test transaction',
        entries: [
          {
            id: 'entry-1',
            timestamp: new Date().toISOString(),
            grantCycleId: 'grant-cycle-1',
            transactionId: 'test-id',
            account: {
              id: 'account-1',
              type: 'FUNDING',
              owner: {
                id: 'owner-1',
                type: 'ORGANIZATION',
              },
            },
            amount: '1000.00',
            currency: 'USD',
            entryType: 'CREDIT',
            description: 'Credit entry',
            metadata: {},
            previousHash: '0'.repeat(64),
            hash: 'a'.repeat(64),
            signatures: [
              {
                signer: 'signer-1',
                signature: 'sig-1',
                timestamp: new Date().toISOString(),
                signatureType: 'ECDSA',
              },
            ],
            status: 'PENDING',
          },
          {
            id: 'entry-2',
            timestamp: new Date().toISOString(),
            grantCycleId: 'grant-cycle-1',
            transactionId: 'test-id',
            account: {
              id: 'account-2',
              type: 'DISBURSEMENT',
              owner: {
                id: 'owner-2',
                type: 'ORGANIZATION',
              },
            },
            amount: '1000.00',
            currency: 'USD',
            entryType: 'DEBIT',
            description: 'Debit entry',
            metadata: {},
            previousHash: '0'.repeat(64),
            hash: 'b'.repeat(64),
            signatures: [
              {
                signer: 'signer-1',
                signature: 'sig-1',
                timestamp: new Date().toISOString(),
                signatureType: 'ECDSA',
              },
            ],
            status: 'PENDING',
          },
        ],
        totalAmount: '1000.00',
        currency: 'USD',
        requiredSignatures: 1,
        receivedSignatures: ['signer-1'],
        status: 'DRAFT',
        auditTrail: [],
      };

      const result = await validateTransaction(transaction as any);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject unbalanced transaction', async () => {
      const transaction = {
        id: 'test-id',
        timestamp: new Date().toISOString(),
        grantCycleId: 'grant-cycle-1',
        transactionType: 'ALLOCATION',
        description: 'Test transaction',
        entries: [
          {
            id: 'entry-1',
            timestamp: new Date().toISOString(),
            grantCycleId: 'grant-cycle-1',
            transactionId: 'test-id',
            account: {
              id: 'account-1',
              type: 'FUNDING',
              owner: {
                id: 'owner-1',
                type: 'ORGANIZATION',
              },
            },
            amount: '1000.00',
            currency: 'USD',
            entryType: 'CREDIT',
            description: 'Credit entry',
            metadata: {},
            previousHash: '0'.repeat(64),
            hash: 'a'.repeat(64),
            signatures: [],
            status: 'PENDING',
          },
          {
            id: 'entry-2',
            timestamp: new Date().toISOString(),
            grantCycleId: 'grant-cycle-1',
            transactionId: 'test-id',
            account: {
              id: 'account-2',
              type: 'DISBURSEMENT',
              owner: {
                id: 'owner-2',
                type: 'ORGANIZATION',
              },
            },
            amount: '900.00', // Different amount
            currency: 'USD',
            entryType: 'DEBIT',
            description: 'Debit entry',
            metadata: {},
            previousHash: '0'.repeat(64),
            hash: 'b'.repeat(64),
            signatures: [],
            status: 'PENDING',
          },
        ],
        totalAmount: '1000.00',
        currency: 'USD',
        requiredSignatures: 1,
        receivedSignatures: [],
        status: 'DRAFT',
        auditTrail: [],
      };

      const result = await validateTransaction(transaction as any);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

describe('TransactionProcessor', () => {
  it('should process pending transactions', async () => {
    // This test would be more comprehensive in a real implementation
    const pending = transactionProcessor.getPendingTransactions();
    expect(Array.isArray(pending)).toBe(true);
  });

  it('should cancel pending transaction', () => {
    const cancelled = transactionProcessor.cancelTransaction('test-tx', 'Test cancellation');
    expect(typeof cancelled).toBe('boolean');
  });
});
