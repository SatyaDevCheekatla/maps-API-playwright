export interface AddPlaceResponse {
  status: string;
  place_id: string;
  scope: string;
  reference: string;
  id: string;
}

export interface GetPlaceResponse {
  location: {
    latitude: string;
    longitude: string;
  };
  accuracy: string;
  name: string;
  phone_number: string;
  address: string;
  types: string;
  website: string;
  language: string;
}

export interface UpdatePlaceResponse {
  msg: string;
}

export interface DeletePlaceResponse {
  status: string;
}
