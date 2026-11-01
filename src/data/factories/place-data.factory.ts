import { AddPlaceRequest, UpdatePlaceRequest } from '../../models/requests/maps-requests.model.js';
import defaultPlaceJson from '../static/default-place.json';

export class PlaceDataFactory {
  /**
   * Generates a valid Add Place request payload with unique identifiers
   * to guarantee test isolation during parallel execution.
   */
  public static createValidAddPlacePayload(overrides?: Partial<AddPlaceRequest>): AddPlaceRequest {
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 10000);

    const basePayload: AddPlaceRequest = {
      location: {
        lat: -38.383494 + (Math.random() - 0.5) * 0.01,
        lng: 33.427362 + (Math.random() - 0.5) * 0.01,
      },
      accuracy: 50,
      name: `Automation Hub ${timestamp}-${randomSuffix}`,
      phone_number: `(+91) 983 ${Math.floor(100 + Math.random() * 900)} ${Math.floor(1000 + Math.random() * 9000)}`,
      address: `${randomSuffix}, Enterprise Boulevard, Suite ${Math.floor(Math.random() * 500)}`,
      types: ['shoe park', 'shop'],
      website: 'https://rahulshettyacademy.com',
      language: 'English-US',
    };

    return {
      ...basePayload,
      ...overrides,
    };
  }

  /**
   * Returns standard static test payload matching legacy AddPlace.json
   */
  public static getStaticAddPlacePayload(): AddPlaceRequest {
    return JSON.parse(JSON.stringify(defaultPlaceJson)) as AddPlaceRequest;
  }

  /**
   * Generates a valid Update Place payload
   */
  public static createValidUpdatePlacePayload(
    placeId: string,
    overrides?: Partial<UpdatePlaceRequest>,
  ): UpdatePlaceRequest {
    const randomNum = Math.floor(Math.random() * 1000);
    return {
      place_id: placeId,
      address: `${randomNum} Modern Automation Way, Tech Valley, CA`,
      key: 'qaclick123',
      ...overrides,
    };
  }

  /**
   * Generates invalid payloads for negative testing
   */
  public static createInvalidPayload(
    scenario: 'empty_name' | 'missing_location' | 'invalid_accuracy' | 'missing_address',
  ): Record<string, unknown> {
    const base = this.createValidAddPlacePayload();
    const payload: Record<string, unknown> = { ...base };

    switch (scenario) {
      case 'empty_name':
        payload['name'] = '';
        break;
      case 'missing_location':
        delete payload['location'];
        break;
      case 'invalid_accuracy':
        payload['accuracy'] = 'INVALID_STRING_ACCURACY';
        break;
      case 'missing_address':
        delete payload['address'];
        break;
    }

    return payload;
  }
}
