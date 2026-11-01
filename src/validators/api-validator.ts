import { expect } from '@playwright/test';
import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { ApiResponse } from '../models/common/api-response.model.js';
import addPlaceSchema from '../data/schemas/add-place-schema.json';
import updateLocationSchema from '../data/schemas/update-location-schema.json';
import deletePlaceSchema from '../data/schemas/delete-place-schema.json';
import errorSchema from '../data/schemas/error-schema.json';

export type SchemaName = 'addPlace' | 'updatePlace' | 'updateLocation' | 'deletePlace' | 'error';

export class ApiValidator {
  private readonly ajv: Ajv;
  private readonly validators: Map<SchemaName, ValidateFunction>;

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false,
    });
    addFormats(this.ajv);

    this.validators = new Map<SchemaName, ValidateFunction>();
    this.validators.set('addPlace', this.ajv.compile(addPlaceSchema));
    this.validators.set('updatePlace', this.ajv.compile(updateLocationSchema));
    this.validators.set('updateLocation', this.ajv.compile(updateLocationSchema));
    this.validators.set('deletePlace', this.ajv.compile(deletePlaceSchema));
    this.validators.set('error', this.ajv.compile(errorSchema));
  }

  /**
   * Asserts HTTP Status Code matches expected value
   */
  public validateStatusCode(response: ApiResponse<unknown>, expectedStatus: number): void {
    expect(
      response.status,
      `Expected HTTP status [${expectedStatus}] for [${response.method} ${response.url}], but received [${response.status}] with body: ${response.rawText}`,
    ).toBe(expectedStatus);
  }

  /**
   * Asserts API Response Time does not exceed threshold
   */
  public validateResponseTime(response: ApiResponse<unknown>, maxDurationMs: number): void {
    expect(
      response.durationMs,
      `API response time for [${response.method} ${response.url}] was ${response.durationMs}ms, exceeding maximum threshold of ${maxDurationMs}ms`,
    ).toBeLessThanOrEqual(maxDurationMs);
  }

  /**
   * Asserts header presence and value
   */
  public validateHeader(
    response: ApiResponse<unknown>,
    headerName: string,
    expectedValuePattern: string | RegExp,
  ): void {
    const actualHeader = response.headers[headerName.toLowerCase()];
    expect(
      actualHeader,
      `Header [${headerName}] not found in response from [${response.url}]`,
    ).toBeDefined();

    if (typeof expectedValuePattern === 'string') {
      expect(actualHeader).toContain(expectedValuePattern);
    } else {
      expect(actualHeader).toMatch(expectedValuePattern);
    }
  }

  /**
   * Validates response against compiled JSON Schema using Ajv
   */
  public validateSchema(response: ApiResponse<unknown>, schemaName: SchemaName): void {
    const validator = this.validators.get(schemaName);
    if (!validator) {
      throw new Error(`Schema validator for [${schemaName}] is not registered.`);
    }

    const isValid = validator(response.data);
    if (!isValid) {
      const formattedErrors = (validator.errors || [])
        .map(
          (err) =>
            `  - Path: "${err.instancePath}" | Keyword: "${err.keyword}" | Message: ${err.message}`,
        )
        .join('\n');

      throw new Error(
        `JSON Schema Validation Failed for schema [${schemaName}] on [${response.method} ${response.url}]:\n${formattedErrors}\nResponse Payload:\n${JSON.stringify(response.data, null, 2)}`,
      );
    }
  }

  /**
   * Validates a specific field inside the response body
   */
  public validateBodyProperty<T>(
    response: ApiResponse<Record<string, unknown>>,
    propertyPath: string,
    expectedValue: T,
  ): void {
    const value = propertyPath.split('.').reduce((obj: unknown, key: string) => {
      if (obj && typeof obj === 'object') {
        return (obj as Record<string, unknown>)[key];
      }
      return undefined;
    }, response.data);

    expect(
      value,
      `Property [${propertyPath}] mismatch on [${response.url}]. Expected: "${String(expectedValue)}", Actual: "${String(value)}"`,
    ).toEqual(expectedValue);
  }
}

export const apiValidator = new ApiValidator();
