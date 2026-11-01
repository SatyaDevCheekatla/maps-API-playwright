/* eslint-disable no-empty-pattern */
import { test as baseTest, expect } from '@playwright/test';
import crypto from 'crypto';
import { config, FrameworkConfig } from '../../config/config.js';
import { ApiClient, IApiClient } from '../clients/api-client.js';
import { PlaceDataFactory } from '../data/factories/place-data.factory.js';
import { AddPlaceRequest } from '../models/requests/maps-requests.model.js';
import { AddPlaceService } from '../services/maps/add-place.service.js';
import { DeletePlaceService } from '../services/maps/delete-place.service.js';
import { UpdatePlaceService } from '../services/maps/update-place.service.js';
import { ITestLogger, TestLogger } from '../utils/logger.js';
import { ApiValidator, apiValidator } from '../validators/api-validator.js';

export interface CreatedPlaceFixture {
  placeId: string;
  requestPayload: AddPlaceRequest;
}

export interface CustomFixtures {
  config: FrameworkConfig;
  correlationId: string;
  logger: ITestLogger;
  apiClient: IApiClient;
  validator: ApiValidator;
  addPlaceService: AddPlaceService;
  updatePlaceService: UpdatePlaceService;
  deletePlaceService: DeletePlaceService;
  createdPlace: CreatedPlaceFixture;
}

export const test = baseTest.extend<CustomFixtures>({
  // Global / worker config exposure
  config: async ({}, use) => {
    await use(config);
  },

  // Test-scoped unique correlation ID
  correlationId: async ({}, use) => {
    const id = crypto.randomUUID();
    await use(id);
  },

  // Test-scoped structured logger
  logger: async ({ correlationId }, use, testInfo) => {
    const loggerInstance = new TestLogger(correlationId, testInfo.title);
    loggerInstance.info(`[Test Start] ${testInfo.title}`);
    await use(loggerInstance);
    loggerInstance.info(`[Test End] ${testInfo.title} => ${testInfo.status?.toUpperCase()}`);
  },

  // Core API Client wrapping Playwright's APIRequestContext
  apiClient: async ({ request, logger, correlationId, config }, use) => {
    const client = new ApiClient(request, logger, correlationId, config.API_TIMEOUT);
    await use(client);
  },

  // Centralized Validation Engine
  validator: async ({}, use) => {
    await use(apiValidator);
  },

  // The 3 Core Maps API Services
  addPlaceService: async ({ apiClient, config }, use) => {
    const service = new AddPlaceService(apiClient, config.MAPS_API_KEY);
    await use(service);
  },

  updatePlaceService: async ({ apiClient, config }, use) => {
    const service = new UpdatePlaceService(apiClient, config.MAPS_API_KEY);
    await use(service);
  },

  deletePlaceService: async ({ apiClient, config }, use) => {
    const service = new DeletePlaceService(apiClient, config.MAPS_API_KEY);
    await use(service);
  },

  // Auto-cleanup fixture for dependent tests (uses addPlaceService & deletePlaceService)
  createdPlace: async ({ addPlaceService, deletePlaceService, logger }, use) => {
    const payload = PlaceDataFactory.createValidAddPlacePayload();
    logger.info('[Fixture Setup] Creating temporary place for test isolation');
    const response = await addPlaceService.addPlace(payload);

    if (response.status !== 200 || !response.data?.place_id) {
      throw new Error(
        `[Fixture Error] Failed to create prerequisite place: HTTP ${response.status} - ${response.rawText}`,
      );
    }

    const placeId = response.data.place_id;
    logger.info(`[Fixture Setup] Created prerequisite place with ID: ${placeId}`);

    try {
      await use({
        placeId,
        requestPayload: payload,
      });
    } finally {
      // Automatic Teardown: ensure cleanup of test data
      logger.info(`[Fixture Teardown] Cleaning up place with ID: ${placeId}`);
      try {
        await deletePlaceService.deletePlace(placeId);
        logger.info(`[Fixture Teardown] Successfully cleaned up place: ${placeId}`);
      } catch (err) {
        logger.warn(`[Fixture Teardown] Failed to delete place: ${placeId}`, {
          error: (err as Error).message,
        });
      }
    }
  },
});

export { expect };
