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
```

Account Types

1. Funding Account: Source of grant funds
2. Disbursement Account: Intermediate holding account
3. Beneficiary Account: Recipient account
4. Administrative Account: Overhead and fees
5. Reserve Account: Contingency funds

Transaction Types

1. Allocation: Moving funds from funding to disbursement account
2. Disbursement: Transfer to beneficiary
3. Return: Funds returned from beneficiary
4. Adjustment: Correction of previous entries
5. Closure: Final settlement of grant cycle

Balancing Rules

Every transaction must satisfy:

```
Σ(DEBIT entries) + Σ(CREDIT entries) = 0
```

Privacy Controls

Public Data

· Transaction existence
· Timestamps
· Account references (pseudonymous)
· Amounts (within ranges for large transactions)
· Cryptographic proofs

Private Data

· Beneficiary personal information
· Exact amounts for sensitive grants
· Internal memos
· Contact information

Zero-Knowledge Proofs

For privacy-sensitive operations, ZK proofs verify:

· Amount is within approved range
· Recipient is eligible
· Transaction follows policy rules
  Without revealing underlying data.

Immutability Guarantees

1. Chained Hashing: Each entry references previous entry's hash
2. Blockchain Anchoring: Periodic merkle roots stored on-chain
3. Multi-Signature: Critical entries require multiple signatures
4. Time-Stamping: External trusted timestamp service

Consensus Model

The ledger uses a hybrid consensus approach:

On-Chain Consensus

· Determined by underlying blockchain
· Ethereum: Proof of Stake
· Hyperledger: Practical Byzantine Fault Tolerance

Off-Chain Validation

· Business logic validation
· Policy compliance checks
· Multi-signature requirements
· Audit committee approval
