import * as allure from 'allure-js-commons';
import { PlaceDataFactory } from '../src/data/factories/place-data.factory.js';
import { expect, test } from '../src/fixtures/custom-fixtures.js';

test.describe('Maps API - Regression Test Suite', () => {
  test.beforeEach(async () => {
    await allure.epic('Google Maps API');
    await allure.feature('Regression Verification');
  });

  // --------------------------------------------------------------------------
  // Scenario 1: Step-by-Step Serial Interlinked 3-API Flow
  // Verifies state persistence across serial steps: Add -> Update -> Delete -> Delete Verify
  // --------------------------------------------------------------------------
  test.describe
    .serial('Interlinked Serial Pipeline (AddPlace -> UpdatePlace -> DeletePlace)', () => {
    let sharedPlaceId = '';
    const updatedAddress = '456 Enterprise Way, Innovation Park';

    test('Step 1: AddPlace API - Create place and capture place_id @regression', async ({
      addPlaceService,
      validator,
      logger,
    }) => {
      await allure.story('Add Place Serial Step');
      await allure.severity('critical');

      const payload = PlaceDataFactory.createValidAddPlacePayload();
      const response = await addPlaceService.addPlace(payload);

      validator.validateStatusCode(response, 200);
      validator.validateSchema(response, 'addPlace');
      expect(response.data.status).toBe('OK');
      expect(response.data.place_id).toBeTruthy();

      // Set shared state for next step in serial suite
      sharedPlaceId = response.data.place_id;
      logger.info(`[Step 1 Complete] Captured place_id: ${sharedPlaceId}`);
    });

    test('Step 2: UpdatePlace API - Update address consuming place_id from Step 1 @regression', async ({
      updatePlaceService,
      validator,
      logger,
    }) => {
      await allure.story('Update Place Serial Step');
      await allure.severity('critical');

      expect(sharedPlaceId, 'Pre-condition failed: sharedPlaceId must be populated').toBeTruthy();

      const updatePayload = PlaceDataFactory.createValidUpdatePlacePayload(sharedPlaceId, {
        address: updatedAddress,
      });

      const response = await updatePlaceService.updatePlace(updatePayload);

      validator.validateStatusCode(response, 200);
      validator.validateSchema(response, 'updatePlace');
      expect(response.data.msg).toBe('Address successfully updated');
      logger.info(`[Step 2 Complete] Updated address for place_id: ${sharedPlaceId}`);
    });

    test('Step 3: DeletePlace API - Delete place consuming place_id from Step 1 @regression', async ({
      deletePlaceService,
      validator,
      logger,
    }) => {
      await allure.story('Delete Place Serial Step');
      await allure.severity('critical');

      expect(sharedPlaceId, 'Pre-condition failed: sharedPlaceId must be populated').toBeTruthy();

      const response = await deletePlaceService.deletePlace(sharedPlaceId);

      validator.validateStatusCode(response, 200);
      validator.validateSchema(response, 'deletePlace');
      expect(response.data.status).toBe('OK');
      logger.info(`[Step 3 Complete] Deleted place_id: ${sharedPlaceId}`);
    });

    test('Step 4: DeletePlace API Verification - Re-deleting deleted place should return 404 @regression', async ({
      deletePlaceService,
      validator,
      logger,
    }) => {
      await allure.story('Verify Deletion via 404');
      await allure.severity('normal');

      // Attempting to delete an already deleted place confirms deletion
      const response = await deletePlaceService.deletePlace(sharedPlaceId);

      validator.validateStatusCode(response, 404);
      validator.validateSchema(response, 'error');
      expect((response.data as { msg?: string }).msg).toContain('Delete operation failed');
      logger.info(`[Step 4 Complete] Confirmed place deletion via 404 for: ${sharedPlaceId}`);
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Data-Driven Interlinked 3-API Workflow
  // Executes AddPlace -> UpdatePlace -> DeletePlace across multiple datasets
  // --------------------------------------------------------------------------
  const dataDrivenDatasets = [
    {
      datasetName: 'European French Locale',
      language: 'French-FR',
      types: ['boutique', 'cafe'],
      newAddress: '12 Rue de Rivoli, Paris, France',
    },
    {
      datasetName: 'Asian Japanese Locale',
      language: 'Japanese-JA',
      types: ['electronics', 'mall'],
      newAddress: '1-1 Chiyoda, Tokyo, Japan',
    },
    {
      datasetName: 'North American US Locale',
      language: 'English-US',
      types: ['tech_hub', 'coworking'],
      newAddress: '500 Silicon Way, San Jose, CA',
    },
  ];

  for (const item of dataDrivenDatasets) {
    test(`Data-Driven 3-API Chain with ${item.datasetName} @regression`, async ({
      addPlaceService,
      updatePlaceService,
      deletePlaceService,
      validator,
    }) => {
      await allure.story(`Data Driven Chain - ${item.datasetName}`);
      await allure.severity('normal');

      // 1. Add Place
      const payload = PlaceDataFactory.createValidAddPlacePayload({
        language: item.language,
        types: item.types,
      });
      const addRes = await addPlaceService.addPlace(payload);
      validator.validateStatusCode(addRes, 200);
      validator.validateSchema(addRes, 'addPlace');
      const placeId = addRes.data.place_id;

      try {
        // 2. Update Place (consuming place_id from step 1)
        const updateRes = await updatePlaceService.updatePlace(
          PlaceDataFactory.createValidUpdatePlacePayload(placeId, {
            address: item.newAddress,
          }),
        );
        validator.validateStatusCode(updateRes, 200);
        expect(updateRes.data.msg).toBe('Address successfully updated');
      } finally {
        // 3. Delete Place (consuming place_id from step 1)
        const deleteRes = await deletePlaceService.deletePlace(placeId);
        validator.validateStatusCode(deleteRes, 200);
        expect(deleteRes.data.status).toBe('OK');
      }
    });
  }

  // --------------------------------------------------------------------------
  // Scenario 3: Negative Validations for the 3 APIs
  // --------------------------------------------------------------------------
  test.describe('Negative Edge Cases for 3 APIs', () => {
    test('Negative: UpdatePlace API with non-existent place_id should return 404 @regression', async ({
      updatePlaceService,
      validator,
    }) => {
      await allure.story('UpdatePlace Non-existent ID');
      const invalidPayload = PlaceDataFactory.createValidUpdatePlacePayload(
        'non_existent_place_id_999999',
      );
      const response = await updatePlaceService.updatePlace(invalidPayload);

      validator.validateStatusCode(response, 404);
      validator.validateSchema(response, 'error');
      expect((response.data as { msg?: string }).msg).toContain('Update address operation failed');
    });

    test('Negative: DeletePlace API with non-existent place_id should return 404 @regression', async ({
      deletePlaceService,
      validator,
    }) => {
      await allure.story('DeletePlace Non-existent ID');
      const response = await deletePlaceService.deletePlace('non_existent_place_id_999999');

      validator.validateStatusCode(response, 404);
      validator.validateSchema(response, 'error');
      expect((response.data as { msg?: string }).msg).toContain('Delete operation failed');
    });

    test('Negative: DeletePlace API with empty place_id should return 404 @regression', async ({
      deletePlaceService,
      validator,
    }) => {
      await allure.story('DeletePlace Empty ID');
      const response = await deletePlaceService.deletePlace('');

      validator.validateStatusCode(response, 404);
      validator.validateSchema(response, 'error');
      expect((response.data as { msg?: string }).msg).toContain('Delete operation failed');
    });
  });
});
