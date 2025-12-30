export * from './types';
export * from './processor';
export * from './validation';

import { transactionProcessor } from './processor';
import { ledger } from '../ledger';

/**
 * Transaction management facade
 */
export class TransactionManager {
  /**
   * Create and submit a new transaction
   */
  public static async createTransaction(
    grantCycleId: string,
    transactionType: string,
    entriesData: Array<{
      accountId: string;
      accountType: string;
      ownerId: string;
      ownerType: string;
      amount: string;
      currency: string;
      entryType: string;
      description: string;
      metadata?: Record<string, any>;
    }>,
    description: string,
    policyId?: string
  ) {
    const transaction = await ledger.createTransaction(
      grantCycleId,
      transactionType as any,
      entriesData,
      description,
      policyId
    );
    
    return await transactionProcessor.submitTransaction(transaction);
  }

  /**
   * Get transaction by ID
   */
  public static getTransaction(transactionId: string) {
    return ledger.getTransaction(transactionId);
  }

  /**
   * Get transactions by grant cycle
   */
  public static getGrantCycleTransactions(grantCycleId: string) {
    return ledger.getGrantCycleTransactions(grantCycleId);
  }

  /**
   * Add signature to transaction
   */
  public static addSignature(
    transactionId: string,
    signer: string,
    signature: string,
    signatureType: string = 'ECDSA'
  ) {
    return ledger.addSignature(transactionId, signer, signature, signatureType);
  }

  /**
   * Update transaction status
   */
  public static updateTransactionStatus(
    transactionId: string,
    status: string,
    actor: string,
    details?: Record<string, any>
  ) {
    return ledger.updateTransactionStatus(
      transactionId,
      status as any,
      actor,
      details
    );
  }

  /**
   * Get transaction processing status
   */
  public static getProcessingStatus(transactionId: string) {
    return transactionProcessor.getTransactionStatus(transactionId);
  }

  /**
   * Cancel a pending transaction
   */
  public static cancelTransaction(transactionId: string, reason: string) {
    return transactionProcessor.cancelTransaction(transactionId, reason);
  }
  }
