/* eslint-disable no-console */
import {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import { execSync } from 'child_process';
import path from 'path';

/**
 * Playwright Custom Reporter for Standalone Emailable HTML Report
 * Automatically generates a self-contained, CORS-free HTML report under reports/
 * after every test execution.
 */
export default class EmailableReporter implements Reporter {
  private scriptPath: string;

  constructor() {
    this.scriptPath = path.resolve(process.cwd(), 'scripts', 'generate-emailable-report.js');
  }

  onBegin(_config: FullConfig, _suite: Suite): void {
    // Session initialization
  }

  onTestEnd(_test: TestCase, _result: TestResult): void {
    // Test completed
  }

  async onEnd(_result: FullResult): Promise<void> {
    try {
      // Small pause to allow concurrent file writers (like allure-playwright) to flush buffers
      await new Promise((resolve) => setTimeout(resolve, 500));
      execSync(`node "${this.scriptPath}"`, { stdio: 'inherit' });
    } catch (error) {
      console.error('[EmailableReporter] Error generating standalone emailable report:', error);
    }
  }
}
