import { config } from '../config';
import { logger } from '../utils/logger';
import { Transaction, BlockchainMetadata, BlockchainType } from './types';

export interface BlockchainAdapter {
  type: BlockchainType;
  submitTransaction(transaction: Transaction): Promise<string>;
  verifyTransaction(txHash: string): Promise<boolean>;
  getTransactionMetadata(txHash: string): Promise<BlockchainMetadata>;
}

export class EthereumAdapter implements BlockchainAdapter {
  public readonly type: BlockchainType = 'ETHEREUM';
  private web3: any;

  constructor() {
    // Initialize Web3
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      this.web3 = new (require('web3').default)((window as any).ethereum);
    } else if (config.ethereumRpcUrl) {
      this.web3 = new (require('web3').default)(config.ethereumRpcUrl);
    } else {
      throw new Error('Ethereum RPC URL not configured');
    }
  }

  async submitTransaction(transaction: Transaction): Promise<string> {
    try {
      logger.info(`Submitting transaction ${transaction.id} to Ethereum`);
      
      // In production, this would interact with a smart contract
      // For now, simulate with a mock transaction
      const mockTxHash = `0x${Buffer.from(transaction.id).toString('hex').padStart(64, '0')}`;
      
      // Store minimal metadata on-chain (merkle root of transaction)
      const merkleRoot = this.calculateMerkleRoot(transaction);
      
      logger.debug(`Transaction ${transaction.id} submitted with hash ${mockTxHash}`);
      
      return mockTxHash;
    } catch (error) {
      logger.error(`Failed to submit transaction to Ethereum:`, error);
      throw error;
    }
  }

  async verifyTransaction(txHash: string): Promise<boolean> {
    try {
      // Check if transaction exists and is confirmed
      const receipt = await this.web3.eth.getTransactionReceipt(txHash);
      return receipt && receipt.status === true;
    } catch (error) {
      logger.error(`Failed to verify transaction ${txHash}:`, error);
      return false;
    }
  }

  async getTransactionMetadata(txHash: string): Promise<BlockchainMetadata> {
    try {
      const tx = await this.web3.eth.getTransaction(txHash);
      const receipt = await this.web3.eth.getTransactionReceipt(txHash);
      
      return {
        blockchain: 'ETHEREUM',
        transactionHash: txHash,
        blockNumber: tx.blockNumber,
        gasUsed: receipt?.gasUsed,
        confirmations: await this.getConfirmations(tx.blockNumber),
      };
    } catch (error) {
      logger.error(`Failed to get metadata for transaction ${txHash}:`, error);
      throw error;
    }
  }

  private async getConfirmations(blockNumber: number): Promise<number> {
    try {
      const currentBlock = await this.web3.eth.getBlockNumber();
      return currentBlock - blockNumber;
    } catch {
      return 0;
    }
  }

  private calculateMerkleRoot(transaction: Transaction): string {
    // Simplified merkle root calculation
    const entryHashes = transaction.entries.map(entry => entry.hash);
    return require('crypto').createHash('sha256')
      .update(entryHashes.join(''))
      .digest('hex');
  }
}

export class HyperledgerAdapter implements BlockchainAdapter {
  public readonly type: BlockchainType = 'HYPERLEDGER';
  private contract: any;

  constructor() {
    // Initialize Hyperledger connection
    // This is a placeholder - actual implementation would use Hyperledger Fabric SDK
    this.contract = null;
  }

  async submitTransaction(transaction: Transaction): Promise<string> {
    logger.info(`Submitting transaction ${transaction.id} to Hyperledger`);
    // Implementation would submit to Hyperledger Fabric chaincode
    return `hl_${transaction.id}`;
  }

  async verifyTransaction(txHash: string): Promise<boolean> {
    // Verify transaction on Hyperledger
    return true;
  }

  async getTransactionMetadata(txHash: string): Promise<BlockchainMetadata> {
    return {
      blockchain: 'HYPERLEDGER',
      transactionHash: txHash,
    };
  }
}

export class BlockchainAdapterFactory {
  static createAdapter(): BlockchainAdapter {
    switch (config.blockchainProvider) {
      case 'ethereum':
        return new EthereumAdapter();
      case 'hyperledger':
        return new HyperledgerAdapter();
      case 'zksync':
        // Implementation for zkSync
        throw new Error('zkSync adapter not yet implemented');
      default:
        throw new Error(`Unsupported blockchain provider: ${config.blockchainProvider}`);
    }
  }
}
