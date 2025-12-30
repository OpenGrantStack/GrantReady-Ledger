import dotenv from 'dotenv';
import Joi from 'joi';

dotenv.config();

// Environment variable schema
const envSchema = Joi.object({
  // Server
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  API_VERSION: Joi.string().pattern(/^v\d+$/).default('v1'),
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug', 'trace')
    .default('info'),
  
  // Security
  JWT_SECRET: Joi.string().min(32).required(),
  CRYPTO_KEY: Joi.string().min(32).required(),
  API_KEY_HASH: Joi.string().required(),
  
  // Database
  MONGODB_URI: Joi.string().uri().required(),
  REDIS_URI: Joi.string().uri().required(),
  
  // Blockchain
  BLOCKCHAIN_PROVIDER: Joi.string()
    .valid('ethereum', 'hyperledger', 'zksync', 'other')
    .default('ethereum'),
  ETHEREUM_RPC_URL: Joi.string().uri().when('BLOCKCHAIN_PROVIDER', {
    is: 'ethereum',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  CONTRACT_ADDRESS: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).optional(),
  WALLET_PRIVATE_KEY: Joi.string().optional(),
  
  // Audit
  AUDIT_LOG_RETENTION_DAYS: Joi.number().integer().min(1).default(365),
  REQUIRED_SIGNATURES: Joi.number().integer().min(1).max(10).default(2),
  AUDIT_COMMITTEE_ADDRESSES: Joi.string().optional(),
  
  // Features
  ENABLE_ZK_PROOFS: Joi.boolean().default(false),
  ENABLE_REAL_TIME_VERIFICATION: Joi.boolean().default(true),
  ENABLE_MULTI_SIGNATURE: Joi.boolean().default(true),
}).unknown(true);

const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

// Parse comma-separated lists
const parseCommaList = (str: string | undefined): string[] => {
  if (!str) return [];
  return str.split(',').map(item => item.trim()).filter(item => item.length > 0);
};

export const config = {
  // Server
  nodeEnv: envVars.NODE_ENV,
  port: envVars.PORT,
  apiVersion: envVars.API_VERSION,
  logLevel: envVars.LOG_LEVEL,
  isProduction: envVars.NODE_ENV === 'production',
  isDevelopment: envVars.NODE_ENV === 'development',
  isTest: envVars.NODE_ENV === 'test',
  
  // Security
  jwtSecret: envVars.JWT_SECRET,
  cryptoKey: envVars.CRYPTO_KEY,
  apiKeyHash: envVars.API_KEY_HASH,
  
  // Database
  mongodbUri: envVars.MONGODB_URI,
  redisUri: envVars.REDIS_URI,
  
  // Blockchain
  blockchainProvider: envVars.BLOCKCHAIN_PROVIDER,
  ethereumRpcUrl: envVars.ETHEREUM_RPC_URL,
  contractAddress: envVars.CONTRACT_ADDRESS,
  walletPrivateKey: envVars.WALLET_PRIVATE_KEY,
  
  // Audit
  auditLogRetentionDays: envVars.AUDIT_LOG_RETENTION_DAYS,
  requiredSignatures: envVars.REQUIRED_SIGNATURES,
  auditCommitteeAddresses: parseCommaList(envVars.AUDIT_COMMITTEE_ADDRESSES),
  
  // Features
  enableZKProofs: envVars.ENABLE_ZK_PROOFS,
  enableRealTimeVerification: envVars.ENABLE_REAL_TIME_VERIFICATION,
  enableMultiSignature: envVars.ENABLE_MULTI_SIGNATURE,
  
  // Derived configurations
  api: {
    basePath: `/api/${envVars.API_VERSION}`,
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: envVars.NODE_ENV === 'production' ? 100 : 1000,
    },
    cors: {
      origin: envVars.NODE_ENV === 'production' 
        ? ['https://grantready.com'] 
        : ['http://localhost:3000', 'http://localhost:8080'],
    },
  },
  
  ledger: {
    maxTransactionAmount: '1000000000', // 1 billion max per transaction
    defaultCurrency: 'USD',
    supportedCurrencies: ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'],
  },
} as const;

export type Config = typeof config;
