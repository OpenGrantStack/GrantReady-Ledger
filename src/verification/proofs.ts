import { logger } from '../utils/logger';

export interface ProofRequest {
  entryId: string;
  proofType: 'INCLUSION' | 'BALANCE' | 'COMPLIANCE' | 'SIGNATURE';
  parameters: Record<string, any>;
}

export interface ProofResponse {
  requestId: string;
  entryId: string;
  proofType: string;
  proofData: string;
  verificationKey?: string;
  timestamp: string;
  validUntil?: string;
}

export class ProofGenerator {
  /**
   * Generate inclusion proof for an entry
   */
  public static generateInclusionProof(
    entryHash: string,
    merkleRoot: string,
    merklePath: string[]
  ): ProofResponse {
    const proofData = JSON.stringify({
      entryHash,
      merkleRoot,
      merklePath,
      algorithm: 'SHA256',
    });

    return {
      requestId: this.generateId(),
      entryId: entryHash,
      proofType: 'INCLUSION',
      proofData,
      timestamp: new Date().toISOString(),
      validUntil: this.getFutureDate(30), // Valid for 30 days
    };
  }

  /**
   * Generate balance proof for a transaction
   */
  public static generateBalanceProof(
    transactionId: string,
    entries: Array<{ amount: string; entryType: string }>
  ): ProofResponse {
    const total = entries.reduce((sum, entry) => {
      const amount = parseFloat(entry.amount);
      const sign = entry.entryType === 'CREDIT' ? 1 : -1;
      return sum + (amount * sign);
    }, 0);

    const proofData = JSON.stringify({
      transactionId,
      entries: entries.map(e => ({ amount: e.amount, type: e.entryType })),
      netAmount: total,
      balanced: Math.abs(total) < 0.01,
      verifiedAt: new Date().toISOString(),
    });

    return {
      requestId: this.generateId(),
      entryId: transactionId,
      proofType: 'BALANCE',
      proofData,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Generate compliance proof
   */
  public static generateComplianceProof(
    transactionId: string,
    policyId: string,
    complianceChecks: Array<{
      check: string;
      passed: boolean;
      evidence?: any;
    }>
  ): ProofResponse {
    const allPassed = complianceChecks.every(check => check.passed);

    const proofData = JSON.stringify({
      transactionId,
      policyId,
      complianceChecks,
      compliant: allPassed,
      verifiedAt: new Date().toISOString(),
    });

    return {
      requestId: this.generateId(),
      entryId: transactionId,
      proofType: 'COMPLIANCE',
      proofData,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Generate signature proof
   */
  public static generateSignatureProof(
    entryId: string,
    signatures: Array<{
      signer: string;
      signature: string;
      signatureType: string;
      timestamp: string;
    }>,
    requiredCount: number
  ): ProofResponse {
    const proofData = JSON.stringify({
      entryId,
      signatures: signatures.map(sig => ({
        signer: sig.signer,
        signatureType: sig.signatureType,
        timestamp: sig.timestamp,
      })),
      requiredSignatures: requiredCount,
      receivedSignatures: signatures.length,
      sufficient: signatures.length >= requiredCount,
      verifiedAt: new Date().toISOString(),
    });

    return {
      requestId: this.generateId(),
      entryId,
      proofType: 'SIGNATURE',
      proofData,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Verify a proof
   */
  public static verifyProof(proofResponse: ProofResponse): boolean {
    try {
      const proofData = JSON.parse(proofResponse.proofData);
      
      switch (proofResponse.proofType) {
        case 'INCLUSION':
          return this.verifyInclusionProof(proofData);
        case 'BALANCE':
          return this.verifyBalanceProof(proofData);
        case 'COMPLIANCE':
          return this.verifyComplianceProof(proofData);
        case 'SIGNATURE':
          return this.verifySignatureProof(proofData);
        default:
          logger.warn(`Unknown proof type: ${proofResponse.proofType}`);
          return false;
      }
    } catch (error) {
      logger.error('Proof verification failed:', error);
      return false;
    }
  }

  private static verifyInclusionProof(proofData: any): boolean {
    // Verify merkle path
    const { entryHash, merklePath, merkleRoot } = proofData;
    
    let currentHash = entryHash;
    for (const siblingHash of merklePath) {
      // Determine order (implementation depends on merkle tree structure)
      const combined = currentHash < siblingHash 
        ? currentHash + siblingHash 
        : siblingHash + currentHash;
      
      currentHash = require('crypto')
        .createHash('sha256')
        .update(combined)
        .digest('hex');
    }
    
    return currentHash === merkleRoot;
  }

  private static verifyBalanceProof(proofData: any): boolean {
    return proofData.balanced === true;
  }

  private static verifyComplianceProof(proofData: any): boolean {
    return proofData.compliant === true;
  }

  private static verifySignatureProof(proofData: any): boolean {
    return proofData.sufficient === true;
  }

  private static generateId(): string {
    return require('crypto').randomBytes(16).toString('hex');
  }

  private static getFutureDate(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString();
  }
}
