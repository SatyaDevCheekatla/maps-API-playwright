import { MAPS_ENDPOINTS } from '../../constants/endpoints.js';
import { IApiClient } from '../../clients/api-client.js';
import { ApiResponse } from '../../models/common/api-response.model.js';
import { DeletePlaceRequest } from '../../models/requests/maps-requests.model.js';
import { DeletePlaceResponse } from '../../models/responses/maps-responses.model.js';

export class DeletePlaceService {
  constructor(
    private readonly client: IApiClient,
    private readonly defaultApiKey: string,
  ) {}

  /**
   * Deletes a place by place_id
   * @param placeId Unique identifier of the place to delete
   * @param apiKey Optional API key override
   */
  public async deletePlace(
    placeId: string,
    apiKey?: string,
  ): Promise<ApiResponse<DeletePlaceResponse>> {
    const key = apiKey ?? this.defaultApiKey;
    const payload: DeletePlaceRequest = { place_id: placeId };
    return this.client.post<DeletePlaceResponse>(MAPS_ENDPOINTS.DELETE_PLACE, {
      params: key ? { key } : {},
      data: payload,
    });
  }
}
