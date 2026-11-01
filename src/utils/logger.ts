import pino from 'pino';
import { config, redactSensitiveData } from '../../config/config.js';

// Base Pino logger instance with ISO timestamp and configured log level
export const rootLogger = pino({
  level: config.LOG_LEVEL,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label) {
      return { level: label.toUpperCase() };
    },
  },
  // Redact secrets at logger serializer level as an extra defense layer
  redact: {
    paths: [
      'key',
      '*.key',
      'params.key',
      'query.key',
      'headers.authorization',
      'headers.Authorization',
      'password',
      'token',
      'secret',
    ],
    censor: '***REDACTED***',
  },
});

export interface ITestLogger {
  info(msg: string, data?: unknown): void;
  debug(msg: string, data?: unknown): void;
  warn(msg: string, data?: unknown): void;
  error(msg: string, data?: unknown): void;
  fatal(msg: string, data?: unknown): void;
}

/**
 * Creates a scoped structured logger for an individual test case,
 * binding correlation ID and test name to every logged event.
 */
export class TestLogger implements ITestLogger {
  private readonly logger: pino.Logger;

  constructor(
    private readonly correlationId: string,
    private readonly testName: string,
  ) {
    this.logger = rootLogger.child({
      correlationId: this.correlationId,
      testName: this.testName,
    });
  }

  public info(msg: string, data?: unknown): void {
    if (data !== undefined) {
      this.logger.info({ details: redactSensitiveData(data) }, msg);
    } else {
      this.logger.info(msg);
    }
  }

  public debug(msg: string, data?: unknown): void {
    if (data !== undefined) {
      this.logger.debug({ details: redactSensitiveData(data) }, msg);
    } else {
      this.logger.debug(msg);
    }
  }

  public warn(msg: string, data?: unknown): void {
    if (data !== undefined) {
      this.logger.warn({ details: redactSensitiveData(data) }, msg);
    } else {
      this.logger.warn(msg);
    }
  }

  public error(msg: string, data?: unknown): void {
    if (data !== undefined) {
      this.logger.error({ details: redactSensitiveData(data) }, msg);
    } else {
      this.logger.error(msg);
    }
  }

  public fatal(msg: string, data?: unknown): void {
    if (data !== undefined) {
      this.logger.fatal({ details: redactSensitiveData(data) }, msg);
    } else {
      this.logger.fatal(msg);
    }
  }
}
