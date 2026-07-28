import { apiRequest } from "./apiClient";

// 1. Get Event Types API (includes categories)
export const getEventTypesApi = async () => {
  return await apiRequest("/event/event-type", {
    method: "GET",
  });
};

// 2. Get Event Categories by Event Type ID API
export const getEventCategoriesByTypeIdApi = async (eventTypeId) => {
  if (!eventTypeId) return { status: false, data: [] };
  return await apiRequest(`/event/event-category/${eventTypeId}`, {
    method: "GET",
  });
};

// 3. Get Place Preferences API
export const getPlacePreferencesApi = async () => {
  return await apiRequest("/event/place-preferences", {
    method: "GET",
  });
};

// 4. Get Merchants by Service ID API (for Restaurants list)
export const getMerchantsByServiceApi = async (serviceId) => {
  if (!serviceId) {
    throw new Error("Service ID is required to fetch merchants.");
  }
  return await apiRequest(`/merchant/merchants-by-service?serviceId=${serviceId}`, {
    method: "GET",
  });
};

// 5. Get Event Notes API
export const getEventNotesApi = async () => {
  return await apiRequest("/event/notes", {
    method: "GET",
  });
};

export const createEventApi = async (formData) => {
  return await apiRequest("/event/create-event", {
    method: "POST",
    body: formData,
  });
};

// 6. Get My Events API
export const getMyEventsApi = async () => {
  return await apiRequest("/event/events", {
    method: "GET",
  });
};

// 7. Get My Created Events API
export const getMyCreatedEventsApi = async () => {
  return await apiRequest("/event/my-created-events", {
    method: "GET",
  });
};

// 8. Get Event Media API
export const getEventMediaApi = async (eventId) => {
  return await apiRequest(`/event-media/media?eventId=${eventId}`, {
    method: "GET",
  });
};

export const eventApi = {
  getEventTypes: getEventTypesApi,
  getEventCategoriesByTypeId: getEventCategoriesByTypeIdApi,
  getPlacePreferences: getPlacePreferencesApi,
  getMerchantsByService: getMerchantsByServiceApi,
  getEventNotes: getEventNotesApi,
  createEvent: createEventApi,
  getMyEvents: getMyEventsApi,
  getMyCreatedEvents: getMyCreatedEventsApi,
  getEventMedia: getEventMediaApi,
};

export default eventApi;
