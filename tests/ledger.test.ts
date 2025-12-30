import { LedgerCore } from '../src/ledger/core';
import { CryptoUtils } from '../src/utils/crypto';

describe('LedgerCore', () => {
  let ledger: LedgerCore;

  beforeEach(() => {
    ledger = LedgerCore.getInstance();
  });

  describe('Entry Creation', () => {
    it('should create a valid ledger entry', () => {
      const entry = ledger.createEntry(
        'grant-cycle-1',
        'tx-1',
        'account-1',
        'FUNDING',
        'org-1',
        'ORGANIZATION',
        '1000.00',
        'USD',
        'CREDIT',
        'Initial funding allocation',
        { note: 'Test entry' }
      );

      expect(entry.id).toBeDefined();
      expect(entry.hash).toBeDefined();
      expect(entry.hash).toHaveLength(64); // SHA-256 hex
      expect(entry.status).toBe('PENDING');
      expect(parseFloat(entry.amount)).toBe(1000.00);
    });

    it('should chain entry hashes', () => {
      const entry1 = ledger.createEntry(
        'grant-cycle-1',
        'tx-1',
        'account-1',
        'FUNDING',
        'org-1',
        'ORGANIZATION',
        '1000.00',
        'USD',
        'CREDIT',
        'First entry'
      );

      const entry2 = ledger.createEntry(
        'grant-cycle-1',
        'tx-1',
        'account-2',
        'DISBURSEMENT',
        'org-2',
        'ORGANIZATION',
        '1000.00',
        'USD',
        'DEBIT',
        'Second entry'
      );

      expect(entry2.previousHash).toBe(entry1.hash);
    });
  });

  describe('Transaction Creation', () => {
    it('should create a balanced transaction', async () => {
      const transaction = await ledger.createTransaction(
        'grant-cycle-1',
        'ALLOCATION',
        [
          {
            accountId: 'account-1',
            accountType: 'FUNDING',
            ownerId: 'org-1',
            ownerType: 'ORGANIZATION',
            amount: '1000.00',
            currency: 'USD',
            entryType: 'CREDIT',
            description: 'Funds allocated',
          },
          {
            accountId: 'account-2',
            accountType: 'DISBURSEMENT',
            ownerId: 'org-2',
            ownerType: 'ORGANIZATION',
            amount: '1000.00',
            currency: 'USD',
            entryType: 'DEBIT',
            description: 'Funds received',
          },
        ],
        'Test allocation'
      );

      expect(transaction.id).toBeDefined();
      expect(transaction.entries).toHaveLength(2);
      expect(transaction.totalAmount).toBe('1000.00');
      expect(transaction.status).toBe('DRAFT');
    });

    it('should reject unbalanced transactions', async () => {
      await expect(
        ledger.createTransaction(
          'grant-cycle-1',
          'ALLOCATION',
          [
            {
              accountId: 'account-1',
              accountType: 'FUNDING',
              ownerId: 'org-1',
              ownerType: 'ORGANIZATION',
              amount: '1000.00',
              currency: 'USD',
              entryType: 'CREDIT',
              description: 'Funds allocated',
            },
            {
              accountId: 'account-2',
              accountType: 'DISBURSEMENT',
              ownerId: 'org-2',
              ownerType: 'ORGANIZATION',
              amount: '900.00', // Different amount
              currency: 'USD',
              entryType: 'DEBIT',
              description: 'Funds received',
            },
          ],
          'Unbalanced test'
        )
      ).rejects.toThrow('Transaction entries do not balance');
    });
  });

  describe('Balance Management', () => {
    it('should calculate account balances correctly', async () => {
      // Create a transaction
      const transaction = await ledger.createTransaction(
        'grant-cycle-1',
        'ALLOCATION',
        [
          {
            accountId: 'funding-account',
            accountType: 'FUNDING',
            ownerId: 'org-1',
            ownerType: 'ORGANIZATION',
            amount: '1000.00',
            currency: 'USD',
            entryType: 'CREDIT',
            description: 'Funds allocated',
          },
          {
            accountId: 'disbursement-account',
            accountType: 'DISBURSEMENT',
            ownerId: 'org-2',
            ownerType: 'ORGANIZATION',
            amount: '1000.00',
            currency: 'USD',
            entryType: 'DEBIT',
            description: 'Funds received',
          },
        ],
        'Test allocation'
      );

      // Execute transaction
      ledger.updateTransactionStatus(transaction.id, 'EXECUTED', 'test');

      // Check balances
      const fundingBalance = ledger.getAccountBalance('funding-account', 'USD');
      const disbursementBalance = ledger.getAccountBalance('disbursement-account', 'USD');

      expect(parseFloat(fundingBalance.balance)).toBe(-1000.00);
      expect(parseFloat(disbursementBalance.balance)).toBe(1000.00);
    });
  });

  describe('Integrity Verification', () => {
    it('should verify ledger integrity', async () => {
      // Create some transactions
      await ledger.createTransaction(
        'grant-cycle-1',
        'ALLOCATION',
        [
          {
            accountId: 'account-1',
            accountType: 'FUNDING',
            ownerId: 'org-1',
            ownerType: 'ORGANIZATION',
            amount: '500.00',
            currency: 'USD',
            entryType: 'CREDIT',
            description: 'Test',
          },
          {
            accountId: 'account-2',
            accountType: 'DISBURSEMENT',
            ownerId: 'org-2',
            ownerType: 'ORGANIZATION',
            amount: '500.00',
            currency: 'USD',
            entryType: 'DEBIT',
            description: 'Test',
          },
        ],
        'Test'
      );

      const result = await ledger.verifyIntegrity();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

describe('CryptoUtils', () => {
  describe('Encryption/Decryption', () => {
    it('should encrypt and decrypt data', () => {
      const original = 'sensitive-data';
      const encrypted = CryptoUtils.encrypt(original);
      const decrypted = CryptoUtils.decrypt(encrypted);

      expect(encrypted).not.toBe(original);
      expect(decrypted).toBe(original);
    });
  });

  describe('Hashing', () => {
    it('should generate consistent hashes', () => {
      const data = 'test-data';
      const hash1 = CryptoUtils.hash(data);
      const hash2 = CryptoUtils.hash(data);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex length
    });

    it('should generate different hashes for different data', () => {
      const hash1 = CryptoUtils.hash('data1');
      const hash2 = CryptoUtils.hash('data2');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Merkle Tree', () => {
    it('should generate merkle root', () => {
      const hashes = [
        CryptoUtils.hash('data1'),
        CryptoUtils.hash('data2'),
        CryptoUtils.hash('data3'),
        CryptoUtils.hash('data4'),
      ];

      const root = CryptoUtils.generateMerkleRoot(hashes);
      expect(root).toBeDefined();
      expect(root).toHaveLength(64);
    });

    it('should generate merkle proof', () => {
      const hashes = [
        CryptoUtils.hash('data1'),
        CryptoUtils.hash('data2'),
        CryptoUtils.hash('data3'),
        CryptoUtils.hash('data4'),
      ];

      const proof = CryptoUtils.generateMerkleProof(hashes, 0);
      expect(Array.isArray(proof)).toBe(true);
    });
  });
});
