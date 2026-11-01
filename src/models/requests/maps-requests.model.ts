export interface LocationCoordinates {
  lat: number;
  lng: number;
}

export interface AddPlaceRequest {
  location: LocationCoordinates;
  accuracy: number;
  name: string;
  phone_number: string;
  address: string;
  types: string[];
  website: string;
  language: string;
}

export interface UpdatePlaceRequest {
  place_id: string;
  address: string;
  key: string;
}

export interface DeletePlaceRequest {
  place_id: string;
}

export interface GetPlaceParams {
  key?: string;
  place_id: string;
}
