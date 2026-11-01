export const MAPS_ENDPOINTS = {
  ADD_PLACE: '/maps/api/place/add/json',
  GET_PLACE: '/maps/api/place/get/json',
  UPDATE_PLACE: '/maps/api/place/update/json',
  DELETE_PLACE: '/maps/api/place/delete/json',
} as const;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;
