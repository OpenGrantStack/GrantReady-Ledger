import CryptoJS from 'crypto-js';
import { config } from '../config';

export class CryptoUtils {
  private static encryptionKey: string = config.cryptoKey;

  /**
   * Encrypt sensitive data
   */
  public static encrypt(data: string): string {
    try {
      return CryptoJS.AES.encrypt(data, this.encryptionKey).toString();
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt sensitive data
   */
  public static decrypt(encryptedData: string): string {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedData, this.encryptionKey);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Hash data (one-way)
   */
  public static hash(data: string, algorithm: 'SHA256' | 'SHA512' = 'SHA256'): string {
    try {
      switch (algorithm) {
        case 'SHA256':
          return CryptoJS.SHA256(data).toString();
        case 'SHA512':
          return CryptoJS.SHA512(data).toString();
        default:
          throw new Error(`Unsupported hash algorithm: ${algorithm}`);
      }
    } catch (error) {
      throw new Error(`Hashing failed: ${error.message}`);
    }
  }

  /**
   * Generate HMAC signature
   */
  public static hmac(data: string, key: string = this.encryptionKey): string {
    try {
      return CryptoJS.HmacSHA256(data, key).toString();
    } catch (error) {
      throw new Error(`HMAC generation failed: ${error.message}`);
    }
  }

  /**
   * Generate random token
   */
  public static generateToken(length: number = 32): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    return result;
  }

  /**
   * Generate UUID v4
   */
  public static generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Generate cryptographic key pair (simplified)
   */
  public static generateKeyPair(): { publicKey: string; privateKey: string } {
    // In production, use proper cryptographic libraries
    // This is a simplified version for demonstration
    return {
      publicKey: `pub_${this.generateToken(32)}`,
      privateKey: `priv_${this.generateToken(32)}`,
    };
  }

  /**
   * Verify signature
   */
  public static verifySignature(
    data: string,
    signature: string,
    publicKey: string
  ): boolean {
    // In production, use proper signature verification
    // This is a simplified version for demonstration
    const expectedSignature = this.hmac(data, publicKey);
    return signature === expectedSignature;
  }

  /**
   * Generate merkle root from hashes
   */
  public static generateMerkleRoot(hashes: string[]): string {
    if (hashes.length === 0) {
      throw new Error('No hashes provided');
    }

    if (hashes.length === 1) {
      return hashes[0];
    }

    // Pair and hash recursively
    const newLevel: string[] = [];
    
    for (let i = 0; i < hashes.length; i += 2) {
      if (i + 1 < hashes.length) {
        const combined = hashes[i] < hashes[i + 1]
          ? hashes[i] + hashes[i + 1]
          : hashes[i + 1] + hashes[i];
        
        newLevel.push(this.hash(combined));
      } else {
        newLevel.push(hashes[i]);
      }
    }

    return this.generateMerkleRoot(newLevel);
  }

  /**
   * Generate merkle proof
   */
  public static generateMerkleProof(hashes: string[], targetIndex: number): string[] {
    const proof: string[] = [];
    
    this.generateMerkleProofRecursive(hashes, targetIndex, proof);
    
    return proof;
  }

  private static generateMerkleProofRecursive(
    hashes: string[],
    index: number,
    proof: string[]
  ): void {
    if (hashes.length === 1) return;

    if (index % 2 === 1) {
      // Left sibling
      proof.push(hashes[index - 1]);
    } else if (index + 1 < hashes.length) {
      // Right sibling
      proof.push(hashes[index + 1]);
    }

    // Move to parent level
    const parentIndex = Math.floor(index / 2);
    const nextLevel: string[] = [];
    
    for (let i = 0; i < hashes.length; i += 2) {
      if (i + 1 < hashes.length) {
        const combined = hashes[i] < hashes[i + 1]
          ? hashes[i] + hashes[i + 1]
          : hashes[i + 1] + hashes[i];
        
        nextLevel.push(this.hash(combined));
      } else {
        nextLevel.push(hashes[i]);
      }
    }

    this.generateMerkleProofRecursive(nextLevel, parentIndex, proof);
  }
      }
