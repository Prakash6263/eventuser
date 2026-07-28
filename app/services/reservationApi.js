import { apiRequest } from "./apiClient";

// 1. Get Reservation Details API
export const getReservationDetailsApi = async () => {
  return await apiRequest("/event/reservation-details", {
    method: "GET",
  });
};

export const reservationApi = {
  getReservationDetails: getReservationDetailsApi,
};

export default reservationApi;
