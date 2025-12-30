import { config } from '../config';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: Error;
}

export class Logger {
  private static levelOrder: Record<LogLevel, number> = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    trace: 4,
  };

  private static currentLevel: LogLevel = config.logLevel as LogLevel;

  /**
   * Set log level
   */
  public static setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  /**
   * Log error message
   */
  public static error(message: string, context?: Record<string, any>, error?: Error): void {
    this.log('error', message, context, error);
  }

  /**
   * Log warning message
   */
  public static warn(message: string, context?: Record<string, any>): void {
    this.log('warn', message, context);
  }

  /**
   * Log info message
   */
  public static info(message: string, context?: Record<string, any>): void {
    this.log('info', message, context);
  }

  /**
   * Log debug message
   */
  public static debug(message: string, context?: Record<string, any>): void {
    this.log('debug', message, context);
  }

  /**
   * Log trace message
   */
  public static trace(message: string, context?: Record<string, any>): void {
    this.log('trace', message, context);
  }

  /**
   * Internal logging method
   */
  private static log(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error
  ): void {
    // Check if level is enabled
    if (this.levelOrder[level] > this.levelOrder[this.currentLevel]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error,
    };

    // Format output
    const formatted = this.formatEntry(entry);
    
    // Output to console with appropriate method
    switch (level) {
      case 'error':
        console.error(formatted);
        if (error && config.isDevelopment) {
          console.error(error.stack);
        }
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'info':
        console.info(formatted);
        break;
      case 'debug':
      case 'trace':
        console.debug(formatted);
        break;
    }

    // In production, you might want to send to a logging service
    if (config.isProduction && level === 'error') {
      this.sendToLoggingService(entry);
    }
  }

  /**
   * Format log entry for output
   */
  private static formatEntry(entry: LogEntry): string {
    const timestamp = entry.timestamp.slice(11, 23); // HH:MM:SS.sss
    const level = entry.level.toUpperCase().padEnd(5);
    const message = entry.message;
    
    let formatted = `[${timestamp}] ${level} ${message}`;
    
    if (entry.context) {
      formatted += ` ${JSON.stringify(entry.context)}`;
    }
    
    if (entry.error && config.isDevelopment) {
      formatted += `\n${entry.error.stack}`;
    }
    
    return formatted;
  }

  /**
   * Send error to external logging service
   */
  private static async sendToLoggingService(entry: LogEntry): Promise<void> {
    // Implementation for sending to external service (e.g., Sentry, DataDog)
    // This is a placeholder for production implementation
    try {
      // Example: Send to external service
      // await fetch('https://logs.example.com', {
      //   method: 'POST',
      //   body: JSON.stringify(entry),
      // });
    } catch (error) {
      // Don't throw from logger
      console.error('Failed to send log to external service:', error);
    }
  }

  /**
   * Create a child logger with additional context
   */
  public static child(context: Record<string, any>): Logger {
    return new ChildLogger(context);
  }
}

class ChildLogger {
  constructor(private context: Record<string, any>) {}

  error(message: string, context?: Record<string, any>, error?: Error): void {
    Logger.error(message, { ...this.context, ...context }, error);
  }

  warn(message: string, context?: Record<string, any>): void {
    Logger.warn(message, { ...this.context, ...context });
  }

  info(message: string, context?: Record<string, any>): void {
    Logger.info(message, { ...this.context, ...context });
  }

  debug(message: string, context?: Record<string, any>): void {
    Logger.debug(message, { ...this.context, ...context });
  }

  trace(message: string, context?: Record<string, any>): void {
    Logger.trace(message, { ...this.context, ...context });
  }
}

// Export singleton instance
export const logger = Logger;
