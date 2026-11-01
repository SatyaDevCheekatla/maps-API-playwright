import { MAPS_ENDPOINTS } from '../../constants/endpoints.js';
import { IApiClient } from '../../clients/api-client.js';
import { ApiResponse } from '../../models/common/api-response.model.js';
import { UpdatePlaceRequest } from '../../models/requests/maps-requests.model.js';
import { UpdatePlaceResponse } from '../../models/responses/maps-responses.model.js';

export class UpdatePlaceService {
  constructor(
    private readonly client: IApiClient,
    private readonly defaultApiKey: string,
  ) {}

  /**
   * Updates an existing location address
   * @param payload UpdatePlaceRequest body
   * @param queryApiKey Optional query parameter key override
   */
  public async updatePlace(
    payload: UpdatePlaceRequest,
    queryApiKey?: string,
  ): Promise<ApiResponse<UpdatePlaceResponse>> {
    const key = queryApiKey ?? this.defaultApiKey;
    return this.client.put<UpdatePlaceResponse>(MAPS_ENDPOINTS.UPDATE_PLACE, {
      params: key ? { key } : {},
      data: payload,
    });
  }
}
