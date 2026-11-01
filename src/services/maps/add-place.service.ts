import { MAPS_ENDPOINTS } from '../../constants/endpoints.js';
import { IApiClient } from '../../clients/api-client.js';
import { ApiResponse } from '../../models/common/api-response.model.js';
import { AddPlaceRequest } from '../../models/requests/maps-requests.model.js';
import { AddPlaceResponse } from '../../models/responses/maps-responses.model.js';

export class AddPlaceService {
  constructor(
    private readonly client: IApiClient,
    private readonly defaultApiKey: string,
  ) {}

  /**
   * Sends Add Place POST request
   * @param payload AddPlaceRequest body
   * @param apiKey Optional API key override (for negative testing)
   */
  public async addPlace(
    payload: AddPlaceRequest,
    apiKey?: string,
  ): Promise<ApiResponse<AddPlaceResponse>> {
    const key = apiKey ?? this.defaultApiKey;
    return this.client.post<AddPlaceResponse>(MAPS_ENDPOINTS.ADD_PLACE, {
      params: key ? { key } : {},
      data: payload,
    });
  }
}
