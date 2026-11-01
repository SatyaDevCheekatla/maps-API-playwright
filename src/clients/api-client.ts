import { APIRequestContext, APIResponse } from '@playwright/test';
import * as allure from 'allure-js-commons';
import { redactSensitiveData } from '../../config/config.js';
import { ApiRequestOptions, ApiResponse } from '../models/common/api-response.model.js';
import { ITestLogger } from '../utils/logger.js';

export interface IApiClient {
  get<T>(endpoint: string, options?: ApiRequestOptions): Promise<ApiResponse<T>>;
  post<T>(endpoint: string, options?: ApiRequestOptions): Promise<ApiResponse<T>>;
  put<T>(endpoint: string, options?: ApiRequestOptions): Promise<ApiResponse<T>>;
  patch<T>(endpoint: string, options?: ApiRequestOptions): Promise<ApiResponse<T>>;
  delete<T>(endpoint: string, options?: ApiRequestOptions): Promise<ApiResponse<T>>;
}

export class ApiClient implements IApiClient {
  constructor(
    private readonly requestContext: APIRequestContext,
    private readonly logger: ITestLogger,
    private readonly correlationId: string,
    private readonly defaultTimeout: number = 30000,
  ) {}

  public async get<T>(endpoint: string, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
    return this.executeRequest<T>('GET', endpoint, options);
  }

  public async post<T>(endpoint: string, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
    return this.executeRequest<T>('POST', endpoint, options);
  }

  public async put<T>(endpoint: string, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
    return this.executeRequest<T>('PUT', endpoint, options);
  }

  public async patch<T>(endpoint: string, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
    return this.executeRequest<T>('PATCH', endpoint, options);
  }

  public async delete<T>(endpoint: string, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
    return this.executeRequest<T>('DELETE', endpoint, options);
  }

  private async executeRequest<T>(
    method: string,
    endpoint: string,
    options: ApiRequestOptions = {},
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Correlation-ID': this.correlationId,
      ...(options.headers || {}),
    };

    const startTime = Date.now();

    // Log request execution with masked secrets
    this.logger.info(`[HTTP Request] ${method} ${endpoint}`, {
      method,
      endpoint,
      params: options.params,
      headers,
      body: options.data,
    });

    let rawResponse: APIResponse;
    try {
      rawResponse = await this.requestContext.fetch(endpoint, {
        method,
        headers,
        params: options.params,
        data: options.data,
        timeout: options.timeout ?? this.defaultTimeout,
      });
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this.logger.error(`[HTTP Error] Failed to execute ${method} ${endpoint}`, {
        error: (error as Error).message,
        durationMs,
      });
      throw error;
    }

    const durationMs = Date.now() - startTime;
    const status = rawResponse.status();
    const statusText = rawResponse.statusText();
    const responseHeaders = rawResponse.headers();
    const rawText = await rawResponse.text();

    let parsedData: T;
    try {
      parsedData = rawText ? JSON.parse(rawText) : ({} as T);
    } catch {
      parsedData = rawText as unknown as T;
    }

    // Structured logging for response
    this.logger.info(
      `[HTTP Response] ${method} ${endpoint} => ${status} ${statusText} (${durationMs}ms)`,
      {
        status,
        statusText,
        durationMs,
        responseBody: parsedData,
      },
    );

    // Attach to Allure Report if allure context is available
    this.attachToAllure(method, endpoint, options, headers, status, durationMs, parsedData);

    return {
      status,
      statusText,
      headers: responseHeaders,
      data: parsedData,
      durationMs,
      url: rawResponse.url(),
      method,
      correlationId: this.correlationId,
      rawText,
    };
  }

  private attachToAllure(
    method: string,
    endpoint: string,
    options: ApiRequestOptions,
    headers: Record<string, string>,
    status: number,
    durationMs: number,
    data: unknown,
  ): void {
    try {
      const requestDetails = {
        method,
        endpoint,
        queryParams: redactSensitiveData(options.params),
        headers: redactSensitiveData(headers),
        body: redactSensitiveData(options.data),
      };

      const responseDetails = {
        statusCode: status,
        durationMs: `${durationMs}ms`,
        body: redactSensitiveData(data),
      };

      allure.attachment(
        `HTTP ${method} Request - ${endpoint}`,
        JSON.stringify(requestDetails, null, 2),
        'application/json',
      );

      allure.attachment(
        `HTTP ${status} Response (${durationMs}ms) - ${endpoint}`,
        JSON.stringify(responseDetails, null, 2),
        'application/json',
      );
    } catch {
      // Gracefully continue if running in an environment without Allure reporter active
    }
  }
}
