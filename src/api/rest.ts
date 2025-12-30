import express from 'express';
import { config } from '../config';
import { ledger } from '../ledger';
import { TransactionManager } from '../transactions';
import { VerificationService } from '../verification';
import { logger } from '../utils/logger';

export function setupRestAPI(app: express.Application): void {
  const router = express.Router();
  
  // Middleware for API versioning
  router.use((req, res, next) => {
    res.setHeader('X-API-Version', config.apiVersion);
    next();
  });
  
  // Health check
  router.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: config.apiVersion,
      environment: config.nodeEnv,
    });
  });
  
  // Ledger endpoints
  router.get('/ledger/integrity', async (req, res) => {
    try {
      const result = await VerificationService.verifyLedgerIntegrity();
      res.json(result);
    } catch (error) {
      logger.error('Ledger integrity check failed:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Transaction endpoints
  router.post('/transactions', async (req, res) => {
    try {
      const {
        grantCycleId,
        transactionType,
        entries,
        description,
        policyId,
      } = req.body;
      
      const transaction = await TransactionManager.createTransaction(
        grantCycleId,
        transactionType,
        entries,
        description,
        policyId
      );
      
      res.status(201).json(transaction);
    } catch (error) {
      logger.error('Transaction creation failed:', error);
      res.status(400).json({ error: error.message });
    }
  });
  
  router.get('/transactions/:id', (req, res) => {
    try {
      const transaction = TransactionManager.getTransaction(req.params.id);
      if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
      }
      res.json(transaction);
    } catch (error) {
      logger.error('Transaction retrieval failed:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  router.post('/transactions/:id/signatures', (req, res) => {
    try {
      const { signer, signature, signatureType } = req.body;
      
      const transaction = TransactionManager.addSignature(
        req.params.id,
        signer,
        signature,
        signatureType
      );
      
      res.json(transaction);
    } catch (error) {
      logger.error('Signature addition failed:', error);
      res.status(400).json({ error: error.message });
    }
  });
  
  // Verification endpoints
  router.post('/verify', async (req, res) => {
    try {
      const { entryIds, transactionIds, proofTypes } = req.body;
      
      let results;
      if (entryIds && entryIds.length > 0) {
        results = await VerificationService.verifyEntries(entryIds);
      } else {
        results = { message: 'No specific items to verify' };
      }
      
      res.json(results);
    } catch (error) {
      logger.error('Verification failed:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  router.get('/proofs/inclusion/:entryId', (req, res) => {
    try {
      const proof = VerificationService.generateInclusionProof(req.params.entryId);
      res.json(proof);
    } catch (error) {
      logger.error('Proof generation failed:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Audit endpoints
  router.get('/audit/report', async (req, res) => {
    try {
      const report = await VerificationService.generateAuditReport(req.query);
      res.json(report);
    } catch (error) {
      logger.error('Audit report generation failed:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Balance endpoints
  router.get('/balances/:accountId/:currency', (req, res) => {
    try {
      const balance = ledger.getAccountBalance(req.params.accountId, req.params.currency);
      res.json(balance);
    } catch (error) {
      logger.error('Balance retrieval failed:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Apply routes to app
  app.use(config.api.basePath, router);
  
  // 404 handler for API routes
  app.use(config.api.basePath, (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });
  
  logger.info(`REST API initialized at ${config.api.basePath}`);
      }
