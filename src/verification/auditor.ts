import CryptoJS from 'crypto-js';
import { LedgerEntry, Transaction, VerificationResult } from '../ledger/types';
import { config } from '../config';
import { logger } from '../utils/logger';

export class Auditor {
  /**
   * Verify a single ledger entry
   */
  public static async verifyEntry(entry: LedgerEntry): Promise<VerificationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Verify hash
      const calculatedHash = this.calculateEntryHash(entry);
      if (calculatedHash !== entry.hash) {
        errors.push('Hash verification failed');
      }

      // Verify signatures
      if (config.enableMultiSignature) {
        const signatureResult = await this.verifySignatures(entry);
        if (!signatureResult.valid) {
          errors.push('Signature verification failed');
        }
      }

      // Verify timestamp (not in the future)
      const entryTime = new Date(entry.timestamp).getTime();
      const currentTime = Date.now();
      if (entryTime > currentTime + 300000) { // 5 minutes tolerance
        warnings.push('Entry timestamp is in the future');
      }

      // Verify amount format
      const amount = parseFloat(entry.amount);
      if (isNaN(amount) || amount <= 0) {
        errors.push('Invalid amount');
      }

      // Verify zero-knowledge proof if present
      if (entry.proof && config.enableZKProofs) {
        try {
          const proofValid = await this.verifyZKProof(entry.proof);
          if (!proofValid) {
            errors.push('Zero-knowledge proof verification failed');
          }
        } catch (error) {
          errors.push(`Proof verification error: ${error.message}`);
        }
      }

    } catch (error) {
      errors.push(`Verification error: ${error.message}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Verify a complete transaction
   */
  public static async verifyTransaction(transaction: Transaction): Promise<VerificationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Verify each entry
      const entryResults = await Promise.all(
        transaction.entries.map(entry => this.verifyEntry(entry))
      );

      for (const result of entryResults) {
        if (!result.valid) {
          errors.push(...result.errors);
        }
        warnings.push(...result.warnings);
      }

      // Verify transaction balance
      const total = transaction.entries.reduce((sum, entry) => {
        const amount = parseFloat(entry.amount);
        const sign = entry.entryType === 'CREDIT' ? 1 : -1;
        return sum + (amount * sign);
      }, 0);

      if (Math.abs(total) > 0.01) {
        errors.push(`Transaction is unbalanced. Net amount: ${total}`);
      }

      // Verify required signatures
      if (transaction.receivedSignatures.length < transaction.requiredSignatures) {
        errors.push(`Insufficient signatures. Required: ${transaction.requiredSignatures}, Received: ${transaction.receivedSignatures.length}`);
      }

      // Verify audit trail continuity
      if (transaction.auditTrail.length > 0) {
        const sortedTrail = [...transaction.auditTrail].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        for (let i = 1; i < sortedTrail.length; i++) {
          const prevTime = new Date(sortedTrail[i - 1].timestamp).getTime();
          const currTime = new Date(sortedTrail[i].timestamp).getTime();
          
          if (currTime < prevTime) {
            warnings.push('Audit trail timestamps are not chronological');
            break;
          }
        }
      }

    } catch (error) {
      errors.push(`Transaction verification error: ${error.message}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Verify hash chain for a sequence of entries
   */
  public static verifyHashChain(entries: LedgerEntry[]): VerificationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Sort by timestamp
    const sortedEntries = [...entries].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let previousHash: string | undefined;

    for (const entry of sortedEntries) {
      // Verify entry hash
      const calculatedHash = this.calculateEntryHash(entry);
      if (calculatedHash !== entry.hash) {
        errors.push(`Invalid hash for entry ${entry.id}`);
      }

      // Verify hash chain
      if (previousHash && entry.previousHash !== previousHash) {
        errors.push(`Hash chain broken at entry ${entry.id}`);
      }

      previousHash = entry.hash;
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Verify signatures on an entry
   */
  private static async verifySignatures(entry: LedgerEntry): Promise<{
    valid: boolean;
    required: number;
    received: number;
    details: Array<{ signer: string; valid: boolean }>;
  }> {
    const details: Array<{ signer: string; valid: boolean }> = [];

    for (const signature of entry.signatures) {
      // In production, this would use proper cryptographic verification
      // For now, simulate verification
      const isValid = signature.signature.length > 0;
      
      details.push({
        signer: signature.signer,
        valid: isValid,
      });
    }

    const valid = details.every(d => d.valid);
    
    return {
      valid,
      required: config.requiredSignatures,
      received: entry.signatures.length,
      details,
    };
  }

  /**
   * Verify zero-knowledge proof
   */
  private static async verifyZKProof(proof: any): Promise<boolean> {
    // In production, this would use proper zk-SNARK/STARK verification libraries
    // For now, simulate verification
    logger.debug('Zero-knowledge proof verification simulated');
    return true;
  }

  /**
   * Calculate hash for entry verification
   */
  private static calculateEntryHash(entry: LedgerEntry): string {
    const dataToHash = {
      id: entry.id,
      timestamp: entry.timestamp,
      grantCycleId: entry.grantCycleId,
      transactionId: entry.transactionId,
      account: entry.account,
      amount: entry.amount,
      currency: entry.currency,
      entryType: entry.entryType,
      description: entry.description,
      metadata: entry.metadata,
      previousHash: entry.previousHash,
    };

    const dataString = JSON.stringify(dataToHash, Object.keys(dataToHash).sort());
    return CryptoJS.SHA256(dataString).toString(CryptoJS.enc.Hex);
  }

  /**
   * Generate merkle proof for a set of entries
   */
  public static generateMerkleProof(entries: LedgerEntry[], targetEntryId: string): string[] {
    const hashes = entries.map(entry => entry.hash);
    const targetIndex = entries.findIndex(entry => entry.id === targetEntryId);
    
    if (targetIndex === -1) {
      throw new Error('Target entry not found in provided entries');
    }

    return this.generateMerklePath(hashes, targetIndex);
  }

  private static generateMerklePath(hashes: string[], index: number): string[] {
    if (hashes.length === 1) return [];
    
    const proof: string[] = [];
    let currentIndex = index;
    let currentHashes = hashes;
    
    while (currentHashes.length > 1) {
      if (currentIndex % 2 === 1) {
        // Left sibling
        proof.push(currentHashes[currentIndex - 1]);
      } else if (currentIndex + 1 < currentHashes.length) {
        // Right sibling
        proof.push(currentHashes[currentIndex + 1]);
      }
      
      // Move to parent level
      const nextLevel: string[] = [];
      for (let i = 0; i < currentHashes.length; i += 2) {
        if (i + 1 < currentHashes.length) {
          const hash = CryptoJS.SHA256(currentHashes[i] + currentHashes[i + 1])
            .toString(CryptoJS.enc.Hex);
          nextLevel.push(hash);
        } else {
          nextLevel.push(currentHashes[i]);
        }
      }
      
      currentIndex = Math.floor(currentIndex / 2);
      currentHashes = nextLevel;
    }
    
    return proof;
  }
        }
