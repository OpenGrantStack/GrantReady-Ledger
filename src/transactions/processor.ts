import { Transaction, TransactionStatus } from '../ledger/types';
import { ledger, blockchainAdapter } from '../ledger';
import { config } from '../config';
import { logger } from '../utils/logger';
import { validateTransaction } from './validation';

export class TransactionProcessor {
  private processingQueue: Map<string, Transaction> = new Map();
  private isProcessing: boolean = false;

  /**
   * Submit transaction for processing
   */
  public async submitTransaction(transaction: Transaction): Promise<Transaction> {
    // Validate transaction
    const validation = await validateTransaction(transaction);
    if (!validation.valid) {
      throw new Error(`Transaction validation failed: ${validation.errors.join(', ')}`);
    }

    // Check if already in queue
    if (this.processingQueue.has(transaction.id)) {
      throw new Error(`Transaction ${transaction.id} is already being processed`);
    }

    // Add to queue
    this.processingQueue.set(transaction.id, transaction);
    
    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }

    logger.info(`Transaction ${transaction.id} submitted for processing`);
    
    return transaction;
  }

  /**
   * Process all transactions in queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    try {
      while (this.processingQueue.size > 0) {
        const [transactionId, transaction] = this.processingQueue.entries().next().value;
        this.processingQueue.delete(transactionId);
        
        await this.processTransaction(transaction);
      }
    } catch (error) {
      logger.error('Error processing transaction queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single transaction
   */
  private async processTransaction(transaction: Transaction): Promise<void> {
    try {
      // Update status to pending approval
      ledger.updateTransactionStatus(
        transaction.id,
        'PENDING_APPROVAL',
        'transaction-processor'
      );

      // Check if signatures are required
      if (config.enableMultiSignature && transaction.requiredSignatures > 0) {
        logger.info(`Transaction ${transaction.id} requires ${transaction.requiredSignatures} signatures`);
        
        // Wait for required signatures (in real implementation, this would be event-driven)
        // For now, we assume signatures are already added
        
        if (transaction.receivedSignatures.length < transaction.requiredSignatures) {
          logger.warn(`Transaction ${transaction.id} lacks required signatures`);
          return;
        }
      }

      // Update status to approved
      ledger.updateTransactionStatus(
        transaction.id,
        'APPROVED',
        'transaction-processor'
      );

      // Submit to blockchain
      const txHash = await blockchainAdapter.submitTransaction(transaction);
      
      // Verify on blockchain
      const verified = await blockchainAdapter.verifyTransaction(txHash);
      
      if (verified) {
        // Update status to executed
        ledger.updateTransactionStatus(
          transaction.id,
          'EXECUTED',
          'transaction-processor',
          { blockchainTxHash: txHash }
        );
        
        logger.info(`Transaction ${transaction.id} successfully executed on blockchain: ${txHash}`);
      } else {
        throw new Error(`Transaction ${transaction.id} failed blockchain verification`);
      }
      
    } catch (error) {
      logger.error(`Failed to process transaction ${transaction.id}:`, error);
      
      // Update status to rejected
      ledger.updateTransactionStatus(
        transaction.id,
        'REJECTED',
        'transaction-processor',
        { error: error.message }
      );
    }
  }

  /**
   * Get transaction processing status
   */
  public getTransactionStatus(transactionId: string): TransactionStatus | null {
    const transaction = ledger.getTransaction(transactionId);
    return transaction?.status || null;
  }

  /**
   * Get all pending transactions
   */
  public getPendingTransactions(): Transaction[] {
    return Array.from(this.processingQueue.values());
  }

  /**
   * Cancel a pending transaction
   */
  public cancelTransaction(transactionId: string, reason: string): boolean {
    if (!this.processingQueue.has(transactionId)) {
      return false;
    }
    
    this.processingQueue.delete(transactionId);
    
    // Update ledger status
    try {
      ledger.updateTransactionStatus(
        transactionId,
        'CANCELLED',
        'transaction-processor',
        { reason }
      );
    } catch {
      // Transaction might not exist in ledger yet
    }
    
    logger.info(`Transaction ${transactionId} cancelled: ${reason}`);
    
    return true;
  }
}

// Singleton instance
export const transactionProcessor = new TransactionProcessor();
