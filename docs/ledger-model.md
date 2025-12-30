# Ledger Model

## Overview

The GrantReady Ledger uses a double-entry accounting model adapted for blockchain, providing complete transparency while maintaining necessary privacy controls.

## Core Concepts

### Ledger Entry
The fundamental unit representing a financial movement or state change in the grant lifecycle.

### Transaction
A collection of related ledger entries that must balance (sum to zero).

### Grant Cycle
A temporal boundary for grant activities, containing multiple transactions.

### Cryptographic Seal
A digital signature ensuring entry immutability and authenticity.

## Data Structures

### Ledger Entry
```typescript
interface LedgerEntry {
  id: string;                    // Unique identifier (UUID v4)
  timestamp: string;            // ISO 8601 timestamp
  grantCycleId: string;         // Reference to grant cycle
  transactionId: string;        // Parent transaction
  account: AccountReference;    // Account identifier
  amount: string;               // Decimal amount (positive/negative)
  currency: string;             // ISO 4217 currency code
  entryType: EntryType;         // DEBIT | CREDIT | ADJUSTMENT
  description: string;          // Human-readable description
  metadata: Record<string, any>; // Additional context
  previousHash?: string;        // Hash of previous entry
  hash: string;                 // Cryptographic hash of this entry
  signatures: Signature[];      // Required signatures
  proof?: ZeroKnowledgeProof;   // Optional ZK proof for sensitive data
}
