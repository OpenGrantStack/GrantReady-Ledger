import Joi from 'joi';
import { Transaction, LedgerEntry } from '../ledger/types';
import { config } from '../config';

// Joi schemas
const accountReferenceSchema = Joi.object({
  id: Joi.string().required(),
  type: Joi.string().valid('FUNDING', 'DISBURSEMENT', 'BENEFICIARY', 'ADMINISTRATIVE', 'RESERVE').required(),
  owner: Joi.object({
    id: Joi.string().required(),
    type: Joi.string().valid('ORGANIZATION', 'INDIVIDUAL', 'SYSTEM').required(),
    name: Joi.string().optional(),
  }).required(),
});

const signatureSchema = Joi.object({
  signer: Joi.string().required(),
  signature: Joi.string().required(),
  timestamp: Joi.string().isoDate().required(),
  signatureType: Joi.string().valid('ECDSA', 'EdDSA', 'RSA').required(),
});

const ledgerEntrySchema = Joi.object({
  id: Joi.string().uuid().required(),
  timestamp: Joi.string().isoDate().required(),
  grantCycleId: Joi.string().uuid().required(),
  transactionId: Joi.string().uuid().required(),
  account: accountReferenceSchema.required(),
  amount: Joi.string().pattern(/^-?\d+(\.\d{1,2})?$/).required(),
  currency: Joi.string().pattern(/^[A-Z]{3}$/).required(),
  entryType: Joi.string().valid('DEBIT', 'CREDIT', 'ADJUSTMENT').required(),
  description: Joi.string().max(1000).required(),
  metadata: Joi.object().optional(),
  previousHash: Joi.string().pattern(/^[a-fA-F0-9]{64}$/).optional(),
  hash: Joi.string().pattern(/^[a-fA-F0-9]{64}$/).required(),
  signatures: Joi.array().items(signatureSchema).min(1).required(),
  status: Joi.string().valid('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED').required(),
});

const transactionSchema = Joi.object({
  id: Joi.string().uuid().required(),
  timestamp: Joi.string().isoDate().required(),
  grantCycleId: Joi.string().uuid().required(),
  transactionType: Joi.string().valid('ALLOCATION', 'DISBURSEMENT', 'RETURN', 'ADJUSTMENT', 'CLOSURE').required(),
  description: Joi.string().max(2000).required(),
  entries: Joi.array().items(ledgerEntrySchema).min(2).required(),
  totalAmount: Joi.string().pattern(/^\d+(\.\d{1,2})?$/).required(),
  currency: Joi.string().pattern(/^[A-Z]{3}$/).required(),
  policyId: Joi.string().optional(),
  requiredSignatures: Joi.number().integer().min(1).max(10).required(),
  receivedSignatures: Joi.array().items(Joi.string()).required(),
  status: Joi.string().valid('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'EXECUTED', 'REJECTED', 'CANCELLED').required(),
  executionTimestamp: Joi.string().isoDate().optional(),
  auditTrail: Joi.array().items(
    Joi.object({
      timestamp: Joi.string().isoDate().required(),
      action: Joi.string().required(),
      actor: Joi.string().required(),
      details: Joi.object().optional(),
    })
  ).required(),
});

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a single ledger entry
 */
export async function validateLedgerEntry(entry: LedgerEntry): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Schema validation
  const { error } = ledgerEntrySchema.validate(entry, { abortEarly: false });
  if (error) {
    errors.push(...error.details.map(detail => detail.message));
  }

  // Business logic validation
  if (parseFloat(entry.amount) <= 0) {
    errors.push('Amount must be positive');
  }

  // Currency validation
  if (!config.ledger.supportedCurrencies.includes(entry.currency)) {
    warnings.push(`Currency ${entry.currency} is not in supported currencies list`);
  }

  // Check maximum transaction amount
  const amount = parseFloat(entry.amount);
  const maxAmount = parseFloat(config.ledger.maxTransactionAmount);
  if (amount > maxAmount) {
    errors.push(`Amount ${amount} exceeds maximum allowed ${maxAmount}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate a complete transaction
 */
export async function validateTransaction(transaction: Transaction): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Schema validation
  const { error } = transactionSchema.validate(transaction, { abortEarly: false });
  if (error) {
    errors.push(...error.details.map(detail => detail.message));
  }

  // Balance validation
  const total = transaction.entries.reduce((sum, entry) => {
    const amount = parseFloat(entry.amount);
    const sign = entry.entryType === 'CREDIT' ? 1 : -1;
    return sum + (amount * sign);
  }, 0);

  if (Math.abs(total) > 0.01) {
    errors.push(`Transaction entries do not balance. Net amount: ${total}`);
  }

  // Currency consistency
  const currencies = new Set(transaction.entries.map(e => e.currency));
  if (currencies.size > 1) {
    errors.push('All entries in a transaction must use the same currency');
  }

  // Signature validation
  if (transaction.receivedSignatures.length > transaction.requiredSignatures) {
    warnings.push('More signatures received than required');
  }

  // Validate each entry
  for (const entry of transaction.entries) {
    const entryValidation = await validateLedgerEntry(entry);
    if (!entryValidation.valid) {
      errors.push(...entryValidation.errors.map(e => `Entry ${entry.id}: ${e}`));
    }
    warnings.push(...entryValidation.warnings.map(w => `Entry ${entry.id}: ${w}`));
  }

  // Check if total amount matches
  const calculatedTotal = transaction.entries
    .filter(e => e.entryType === 'CREDIT')
    .reduce((sum, e) => sum + parseFloat(e.amount), 0);
  
  if (Math.abs(calculatedTotal - parseFloat(transaction.totalAmount)) > 0.01) {
    errors.push(`Total amount mismatch. Calculated: ${calculatedTotal}, Stated: ${transaction.totalAmount}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate transaction against business policies
 */
export async function validateAgainstPolicies(
  transaction: Transaction,
  policyRules: any
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check transaction type restrictions
  if (policyRules.allowedTransactionTypes) {
    if (!policyRules.allowedTransactionTypes.includes(transaction.transactionType)) {
      errors.push(`Transaction type ${transaction.transactionType} not allowed by policy`);
    }
  }

  // Check amount limits
  if (policyRules.maxTransactionAmount) {
    const maxAmount = parseFloat(policyRules.maxTransactionAmount);
    const transactionAmount = parseFloat(transaction.totalAmount);
    
    if (transactionAmount > maxAmount) {
      errors.push(`Transaction amount ${transactionAmount} exceeds policy limit ${maxAmount}`);
    }
  }

  // Check time restrictions
  if (policyRules.allowedHours) {
    const transactionTime = new Date(transaction.timestamp);
    const hour = transactionTime.getHours();
    
    if (hour < policyRules.allowedHours.start || hour > policyRules.allowedHours.end) {
      warnings.push(`Transaction executed outside normal business hours`);
    }
  }

  // Check beneficiary restrictions
  if (policyRules.restrictedBeneficiaries) {
    const beneficiaryEntries = transaction.entries.filter(
      e => e.account.type === 'BENEFICIARY'
    );
    
    for (const entry of beneficiaryEntries) {
      if (policyRules.restrictedBeneficiaries.includes(entry.account.owner.id)) {
        errors.push(`Beneficiary ${entry.account.owner.id} is restricted by policy`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
