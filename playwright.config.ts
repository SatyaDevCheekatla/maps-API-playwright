import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Pre-load env before reading playwright configuration
const envFile = process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const baseURL = process.env.BASE_URL || 'https://rahulshettyacademy.com';
const timeout = process.env.API_TIMEOUT ? parseInt(process.env.API_TIMEOUT, 10) : 30000;
const workers = process.env.WORKERS ? parseInt(process.env.WORKERS, 10) : (process.env.CI ? 2 : 2);

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers,
  timeout,
  expect: {
    timeout: 10000,
  },
  reporter: [
    ['list'],
    [
      'allure-playwright',
      {
        detail: true,
        outputFolder: 'allure-results',
        suiteTitle: true,
        environmentInfo: {
          ENVIRONMENT: process.env.ENVIRONMENT || 'development',
          BASE_URL: baseURL,
          NODE_VERSION: process.version,
          OS: process.platform,
        },
      },
    ],
    ['./src/reporters/emailable-reporter.ts'],
  ],
  use: {
    baseURL,
    extraHTTPHeaders: {
      Accept: 'application/json',
    },
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'Maps-API',
      testMatch: /.*\.spec\.ts/,
    },
  ],
});
