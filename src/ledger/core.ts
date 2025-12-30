import { v4 as uuidv4 } from 'uuid';
import CryptoJS from 'crypto-js';
import { 
  LedgerEntry, 
  Transaction, 
  GrantCycle, 
  Balance,
  EntryType,
  TransactionType,
  TransactionStatus,
  VerificationResult
} from './types';
import { config } from '../config';
import { logger } from '../utils/logger';
import { validateTransaction } from '../transactions/validation';
import { verifyEntry } from '../verification/auditor';

export class LedgerCore {
  private static instance: LedgerCore;
  private entries: Map<string, LedgerEntry> = new Map();
  private transactions: Map<string, Transaction> = new Map();
  private grantCycles: Map<string, GrantCycle> = new Map();
  private balances: Map<string, Balance> = new Map();
  private lastEntryHash?: string;

  private constructor() {}

  public static getInstance(): LedgerCore {
    if (!LedgerCore.instance) {
      LedgerCore.instance = new LedgerCore();
    }
    return LedgerCore.instance;
  }

  /**
   * Create a new ledger entry with cryptographic hash
   */
  public createEntry(
    grantCycleId: string,
    transactionId: string,
    accountId: string,
    accountType: string,
    ownerId: string,
    ownerType: string,
    amount: string,
    currency: string,
    entryType: EntryType,
    description: string,
    metadata: Record<string, any> = {},
    signatures: Array<{ signer: string; signature: string; signatureType: string }> = []
  ): LedgerEntry {
    const id = uuidv4();
    const timestamp = new Date().toISOString();
    
    const account = {
      id: accountId,
      type: accountType as any,
      owner: {
        id: ownerId,
        type: ownerType as any,
      },
    };

    // Prepare entry data for hashing
    const entryData = {
      id,
      timestamp,
      grantCycleId,
      transactionId,
      account,
      amount,
      currency,
      entryType,
      description,
      metadata,
      previousHash: this.lastEntryHash,
    };

    // Calculate hash
    const hash = this.calculateHash(entryData);
    
    // Create entry object
    const entry: LedgerEntry = {
      ...entryData,
      hash,
      signatures: signatures.map(sig => ({
        ...sig,
        timestamp,
        signatureType: sig.signatureType as any,
      })),
      status: 'PENDING',
    };

    // Store entry
    this.entries.set(id, entry);
    this.lastEntryHash = hash;

    logger.debug(`Created ledger entry ${id} for transaction ${transactionId}`);
    
    return entry;
  }

  /**
   * Create a complete transaction with balanced entries
   */
  public async createTransaction(
    grantCycleId: string,
    transactionType: TransactionType,
    entriesData: Array<{
      accountId: string;
      accountType: string;
      ownerId: string;
      ownerType: string;
      amount: string;
      currency: string;
      entryType: EntryType;
      description: string;
      metadata?: Record<string, any>;
    }>,
    description: string,
    policyId?: string
  ): Promise<Transaction> {
    const id = uuidv4();
    const timestamp = new Date().toISOString();

    // Validate entry balance
    const total = entriesData.reduce((sum, entry) => {
      const amount = parseFloat(entry.amount);
      const sign = entry.entryType === 'CREDIT' ? 1 : -1;
      return sum + (amount * sign);
    }, 0);

    if (Math.abs(total) > 0.01) { // Allow for small floating point errors
      throw new Error(`Transaction entries do not balance. Net amount: ${total}`);
    }

    // Create ledger entries
    const entries: LedgerEntry[] = [];
    let totalAmount = '0';

    for (const entryData of entriesData) {
      const entry = this.createEntry(
        grantCycleId,
        id,
        entryData.accountId,
        entryData.accountType,
        entryData.ownerId,
        entryData.ownerType,
        entryData.amount,
        entryData.currency,
        entryData.entryType,
        entryData.description,
        entryData.metadata || {}
      );
      
      entries.push(entry);
      
      // Calculate total amount (absolute value of credit entries)
      if (entryData.entryType === 'CREDIT') {
        totalAmount = (parseFloat(totalAmount) + parseFloat(entryData.amount)).toString();
      }
    }

    // Create transaction
    const transaction: Transaction = {
      id,
      timestamp,
      grantCycleId,
      transactionType,
      description,
      entries,
      totalAmount,
      currency: entries[0]?.currency || config.ledger.defaultCurrency,
      policyId,
      requiredSignatures: config.requiredSignatures,
      receivedSignatures: [],
      status: 'DRAFT',
      auditTrail: [{
        timestamp,
        action: 'CREATED',
        actor: 'system',
      }],
    };

    // Validate transaction
    const validation = await validateTransaction(transaction);
    if (!validation.valid) {
      throw new Error(`Transaction validation failed: ${validation.errors.join(', ')}`);
    }

    // Store transaction
    this.transactions.set(id, transaction);

    logger.info(`Created transaction ${id} of type ${transactionType} for grant cycle ${grantCycleId}`);
    
    return transaction;
  }

  /**
   * Get transaction by ID
   */
  public getTransaction(id: string): Transaction | undefined {
    return this.transactions.get(id);
  }

  /**
   * Get all transactions for a grant cycle
   */
  public getGrantCycleTransactions(grantCycleId: string): Transaction[] {
    return Array.from(this.transactions.values())
      .filter(tx => tx.grantCycleId === grantCycleId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  /**
   * Update transaction status
   */
  public updateTransactionStatus(
    transactionId: string,
    status: TransactionStatus,
    actor: string,
    details?: Record<string, any>
  ): Transaction {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    // Update status
    transaction.status = status;
    
    // Add to audit trail
    transaction.auditTrail.push({
      timestamp: new Date().toISOString(),
      action: `STATUS_CHANGE_${status}`,
      actor,
      details,
    });

    // If executing, update execution timestamp
    if (status === 'EXECUTED') {
      transaction.executionTimestamp = new Date().toISOString();
      
      // Update entry statuses
      for (const entry of transaction.entries) {
        entry.status = 'CONFIRMED';
        this.entries.set(entry.id, entry);
      }

      // Update balances
      this.updateBalances(transaction);
    }

    this.transactions.set(transactionId, transaction);
    
    logger.info(`Transaction ${transactionId} status updated to ${status} by ${actor}`);
    
    return transaction;
  }

  /**
   * Add signature to transaction
   */
  public addSignature(
    transactionId: string,
    signer: string,
    signature: string,
    signatureType: string = 'ECDSA'
  ): Transaction {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    // Check if already signed
    if (transaction.receivedSignatures.includes(signer)) {
      throw new Error(`Signer ${signer} has already signed this transaction`);
    }

    // Add signature
    transaction.receivedSignatures.push(signer);
    
    // Add signature to all entries
    for (const entry of transaction.entries) {
      entry.signatures.push({
        signer,
        signature,
        timestamp: new Date().toISOString(),
        signatureType: signatureType as any,
      });
      this.entries.set(entry.id, entry);
    }

    // Check if required signatures are met
    if (transaction.receivedSignatures.length >= transaction.requiredSignatures) {
      transaction.status = 'APPROVED';
      transaction.auditTrail.push({
        timestamp: new Date().toISOString(),
        action: 'ALL_SIGNATURES_RECEIVED',
        actor: 'system',
      });
    }

    this.transactions.set(transactionId, transaction);
    
    logger.info(`Signature added to transaction ${transactionId} by ${signer}`);
    
    return transaction;
  }

  /**
   * Get current balance for an account
   */
  public getAccountBalance(accountId: string, currency: string): Balance {
    const balanceKey = `${accountId}:${currency}`;
    let balance = this.balances.get(balanceKey);

    if (!balance) {
      // Calculate from entries
      const entries = Array.from(this.entries.values())
        .filter(entry => 
          entry.account.id === accountId && 
          entry.currency === currency && 
          entry.status === 'CONFIRMED'
        );

      let total = 0;
      for (const entry of entries) {
        const amount = parseFloat(entry.amount);
        total += entry.entryType === 'CREDIT' ? amount : -amount;
      }

      balance = {
        accountId,
        balance: total.toFixed(2),
        currency,
        asOf: new Date().toISOString(),
        verified: false,
      };

      this.balances.set(balanceKey, balance);
    }

    return balance;
  }

  /**
   * Verify ledger integrity
   */
  public async verifyIntegrity(): Promise<VerificationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check hash chain
    let previousHash: string | undefined;
    const sortedEntries = Array.from(this.entries.values())
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    for (const entry of sortedEntries) {
      // Verify hash chain
      if (previousHash && entry.previousHash !== previousHash) {
        errors.push(`Hash chain broken at entry ${entry.id}`);
      }

      // Verify entry hash
      const calculatedHash = this.calculateHash(entry);
      if (calculatedHash !== entry.hash) {
        errors.push(`Invalid hash for entry ${entry.id}`);
      }

      // Verify signatures
      const entryVerification = await verifyEntry(entry);
      if (!entryVerification.valid) {
        errors.push(`Entry ${entry.id} failed verification: ${entryVerification.errors.join(', ')}`);
      }

      previousHash = entry.hash;
    }

    // Verify transaction balances
    for (const transaction of this.transactions.values()) {
      const total = transaction.entries.reduce((sum, entry) => {
        const amount = parseFloat(entry.amount);
        const sign = entry.entryType === 'CREDIT' ? 1 : -1;
        return sum + (amount * sign);
      }, 0);

      if (Math.abs(total) > 0.01) {
        errors.push(`Transaction ${transaction.id} is unbalanced. Net amount: ${total}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Calculate cryptographic hash for entry data
   */
  private calculateHash(data: any): string {
    const dataString = JSON.stringify(data, Object.keys(data).sort());
    return CryptoJS.SHA256(dataString).toString(CryptoJS.enc.Hex);
  }

  /**
   * Update balances based on transaction
   */
  private updateBalances(transaction: Transaction): void {
    for (const entry of transaction.entries) {
      const balanceKey = `${entry.account.id}:${entry.currency}`;
      let balance = this.balances.get(balanceKey);

      if (!balance) {
        balance = {
          accountId: entry.account.id,
          balance: '0',
          currency: entry.currency,
          asOf: new Date().toISOString(),
          verified: false,
        };
      }

      const currentBalance = parseFloat(balance.balance);
      const entryAmount = parseFloat(entry.amount);
      const adjustment = entry.entryType === 'CREDIT' ? entryAmount : -entryAmount;
      
      balance.balance = (currentBalance + adjustment).toFixed(2);
      balance.asOf = new Date().toISOString();

      this.balances.set(balanceKey, balance);
    }
  }
}
