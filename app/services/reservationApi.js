import { apiRequest } from "./apiClient";

// 1. Get Reservation Details API
export const getReservationDetailsApi = async () => {
  return await apiRequest("/event/reservation-details", {
    method: "GET",
  });
};

// 2. Make Reservation API
export const makeReservationApi = async (payload) => {
  return await apiRequest("/event/make-reservation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
};

// 3. Cancel Reservation API
export const cancelReservationApi = async (payload) => {
  return await apiRequest("/event/cancel-reservation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
};

// 4. Resend Reservation API
export const resendReservationApi = async (payload) => {
  return await apiRequest("/event/resend-reservation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
};

// 5. Get Cancel Reasons API
export const getCancelReasonsApi = async () => {
  return await apiRequest("/event/get-cancel-reasons", {
    method: "GET",
  });
};

export const reservationApi = {
  getReservationDetails: getReservationDetailsApi,
  makeReservation: makeReservationApi,
  cancelReservation: cancelReservationApi,
  resendReservation: resendReservationApi,
  getCancelReasons: getCancelReasonsApi,
};

export default reservationApi;
