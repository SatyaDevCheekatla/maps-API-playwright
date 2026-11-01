import * as allure from 'allure-js-commons';
import { PlaceDataFactory } from '../src/data/factories/place-data.factory.js';
import { expect, test } from '../src/fixtures/custom-fixtures.js';

test.describe('Maps API - Smoke Test Suite', () => {
  test.beforeEach(async () => {
    await allure.epic('Google Maps API');
    await allure.feature('Smoke Verification');
  });

  test('SMOKE-001: End-to-End Interlinked Workflow (AddPlace -> UpdatePlace -> DeletePlace) @smoke', async ({
    addPlaceService,
    updatePlaceService,
    deletePlaceService,
    validator,
    logger,
  }) => {
    await allure.story('Interlinked 3-API Critical Path');
    await allure.severity('blocker');
    await allure.owner('SDET Architect');

    let generatedPlaceId = '';
    const updatedAddress = '70 Summer Walk, Tech Boulevard, Suite 100';

    // -------------------------------------------------------------
    // API 1: Add Place API (POST)
    // Extracts place_id to pass as data to next API
    // -------------------------------------------------------------
    const addPayload = PlaceDataFactory.createValidAddPlacePayload();
    const addResponse = await allure.step('1. AddPlace API: Create new place', async () => {
      return await addPlaceService.addPlace(addPayload);
    });

    await allure.step('Validate AddPlace API response & extract place_id', async () => {
      validator.validateStatusCode(addResponse, 200);
      validator.validateResponseTime(addResponse, 5000);
      validator.validateSchema(addResponse, 'addPlace');
      expect(addResponse.data.status).toBe('OK');
      expect(addResponse.data.place_id).toBeDefined();

      // Pass this output data to the next APIs
      generatedPlaceId = addResponse.data.place_id;
      logger.info(`[Smoke Flow] Extracted place_id: ${generatedPlaceId}`);
    });

    // -------------------------------------------------------------
    // API 2: Update Place API (PUT)
    // Consumes place_id from Add Place response
    // -------------------------------------------------------------
    const updatePayload = PlaceDataFactory.createValidUpdatePlacePayload(generatedPlaceId, {
      address: updatedAddress,
    });

    const updateResponse = await allure.step(
      `2. UpdatePlace API: Update address using place_id (${generatedPlaceId})`,
      async () => {
        return await updatePlaceService.updatePlace(updatePayload);
      },
    );

    await allure.step('Validate UpdatePlace API response', async () => {
      validator.validateStatusCode(updateResponse, 200);
      validator.validateResponseTime(updateResponse, 5000);
      validator.validateSchema(updateResponse, 'updatePlace');
      expect(updateResponse.data.msg).toBe('Address successfully updated');
      logger.info(`[Smoke Flow] Successfully updated address for place_id: ${generatedPlaceId}`);
    });

    // -------------------------------------------------------------
    // API 3: Delete Place API (POST)
    // Consumes place_id from previous step to clean up and conclude
    // -------------------------------------------------------------
    const deleteResponse = await allure.step(
      `3. DeletePlace API: Delete place using place_id (${generatedPlaceId})`,
      async () => {
        return await deletePlaceService.deletePlace(generatedPlaceId);
      },
    );

    await allure.step('Validate DeletePlace API response', async () => {
      validator.validateStatusCode(deleteResponse, 200);
      validator.validateResponseTime(deleteResponse, 5000);
      validator.validateSchema(deleteResponse, 'deletePlace');
      expect(deleteResponse.data.status).toBe('OK');
      logger.info(`[Smoke Flow] Successfully deleted place_id: ${generatedPlaceId}`);
    });
  });
});
