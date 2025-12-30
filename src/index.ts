import express from 'express';
import { config } from './config';
import { initializeLedger } from './ledger';
import { initializeAPI } from './api';
import { initializeVerification } from './verification';
import { logger } from './utils/logger';

class GrantReadyLedger {
  private app: express.Application;
  private server: any;

  constructor() {
    this.app = express();
    this.configureMiddleware();
  }

  private configureMiddleware(): void {
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    // Security headers
    this.app.use((req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      next();
    });
  }

  public async initialize(): Promise<void> {
    try {
      logger.info('Initializing GrantReady Ledger...');
      
      // Initialize core components
      await initializeLedger();
      await initializeVerification();
      
      // Initialize API
      initializeAPI(this.app);
      
      // Start server
      this.server = this.app.listen(config.port, () => {
        logger.info(`Server running on port ${config.port}`);
        logger.info(`Environment: ${config.nodeEnv}`);
        logger.info(`API Version: ${config.apiVersion}`);
      });
      
      this.setupGracefulShutdown();
      
    } catch (error) {
      logger.error('Failed to initialize ledger:', error);
      process.exit(1);
    }
  }

  private setupGracefulShutdown(): void {
    const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
    
    signals.forEach(signal => {
      process.on(signal, () => {
        logger.info(`Received ${signal}, shutting down gracefully...`);
        
        if (this.server) {
          this.server.close(() => {
            logger.info('HTTP server closed');
            process.exit(0);
          });
          
          // Force shutdown after 10 seconds
          setTimeout(() => {
            logger.error('Could not close connections in time, forcing shutdown');
            process.exit(1);
          }, 10000);
        } else {
          process.exit(0);
        }
      });
    });
  }
}

// Application entry point
if (require.main === module) {
  const ledger = new GrantReadyLedger();
  ledger.initialize().catch(error => {
    logger.error('Unhandled application error:', error);
    process.exit(1);
  });
}

export { GrantReadyLedger };
