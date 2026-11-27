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

// 4. Get Merchants by Service ID API (for Restaurants / Facilities list)
export const getMerchantsByServiceApi = async (serviceId, lat, long, radius = 100) => {
  if (!serviceId) {
    throw new Error("Service ID is required to fetch merchants.");
  }
  let url = `/merchant/merchants-by-service?serviceId=${serviceId}`;
  if (lat !== undefined && lat !== null && long !== undefined && long !== null) {
    url += `&lat=${lat}&long=${long}&radius=${radius}`;
  }
  return await apiRequest(url, {
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

// 7b. Get My Joined Events API (Accepted invitations)
export const getMyJoinedEventsApi = async () => {
  return await apiRequest("/event/my-joined-events", {
    method: "GET",
  });
};

// 7c. Get My Invitations API (Pending, Accepted, Declined)
export const getMyInvitationsApi = async (status) => {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return await apiRequest(`/event/my-invitations${query}`, {
    method: "GET",
  });
};

// 8. Get Event Media API
export const getEventMediaApi = async (eventId) => {
  return await apiRequest(`/event-media/media?eventId=${eventId}`, {
    method: "GET",
    skipAuthRedirect: true,
  });
};

// 9. Rate Event API
export const rateEventApi = async (payload) => {
  return await apiRequest("/event/rate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
};

// 9a-2. Get Event Ratings & Reviews API
export const getEventRatingsApi = async (eventId) => {
  if (!eventId) return { status: false, data: [] };
  return await apiRequest(`/event/ratings?eventId=${encodeURIComponent(eventId)}`, {
    method: "GET",
  });
};

// 9a-3. Get Event Rating Summary API
export const getEventRatingSummaryApi = async (eventId) => {
  if (!eventId) return { status: false, data: { avgRating: 0, count: 0 } };
  return await apiRequest(`/event/rating-summary?eventId=${encodeURIComponent(eventId)}`, {
    method: "GET",
  });
};

// 9b. Rate Merchant API
export const rateMerchantApi = async (payload) => {
  return await apiRequest("/merchant/rate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
};

// 9c. Scan Attendance QR Token API
export const scanAttendanceApi = async (token) => {
  return await apiRequest("/self-attendance/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
};

// 10. Update Event API
export const updateEventApi = async (payload) => {
  return await apiRequest("/event/update-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
};

// 11. Mark Event as Draft (Recall) API
export const markEventAsDraftApi = async (eventId) => {
  return await apiRequest(`/event/mark-draft/${eventId}`, {
    method: "POST",
  });
};

// 12. Publish Draft Event (Make Live) API
export const publishDraftEventApi = async (eventId) => {
  return await apiRequest("/event/publish-draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId }),
  });
};

// 13. Mark Manual Attendance API (Host Guest List Check-In)
export const markManualAttendanceApi = async ({ eventId, userId, attendance_status = true }) => {
  return await apiRequest("/event/mark-manual-attendance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId, userId, attendance_status }),
  });
};

// 14. Update Event Status API (pending, OngoingEvent, completed)
export const updateEventStatusApi = async ({ eventId, status }) => {
  return await apiRequest("/event/update-event-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId, status }),
  });
};

// 15. Cancel Event API
export const cancelEventApi = async (eventId) => {
  return await apiRequest(`/event/cancel-event/${eventId}`, {
    method: "POST",
  });
};

// 16. Delete Event API
export const deleteEventApi = async (eventId) => {
  return await apiRequest("/event/delete-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId }),
  });
};

// 17. Send Invitation Reminder API
export const sendInvitationReminderApi = async ({ eventId, userId }) => {
  return await apiRequest("/event/send-reminder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId, userId }),
  });
};

// 18. Get Attendance QR Code API
export const getAttendanceQrApi = async ({ eventId, userId }) => {
  return await apiRequest(`/event/attendance-qr?eventId=${encodeURIComponent(eventId)}&userId=${encodeURIComponent(userId)}`, {
    method: "GET",
  });
};

// 19. Vote on Event Poll API
export const voteEventPollApi = async ({ pollId, optionId, action = "vote" }) => {
  return await apiRequest("/event/event-poll-vote", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pollId, optionId, action }),
  });
};

// 20. Create Moyasar Payment API (iOS Payment Flow)
export const createMoyasarPaymentApi = async (payload) => {
  return await apiRequest("/payment/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
};

// 21. Update Service Booking Payment Status API
export const updateServiceBookingPaymentApi = async ({ bookingId, paymentStatus = "yes", transactionId = "" }) => {
  return await apiRequest("/event/update-service-booking-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookingId, paymentStatus, transactionId }),
  });
};

export const eventApi = {
  getEventTypes: getEventTypesApi,
  getEventCategoriesByTypeId: getEventCategoriesByTypeIdApi,
  getPlacePreferences: getPlacePreferencesApi,
  getMerchantsByService: getMerchantsByServiceApi,
  getEventNotes: getEventNotesApi,
  createEvent: createEventApi,
  updateEvent: updateEventApi,
  updateEventStatus: updateEventStatusApi,
  cancelEvent: cancelEventApi,
  deleteEvent: deleteEventApi,
  sendInvitationReminder: sendInvitationReminderApi,
  getAttendanceQr: getAttendanceQrApi,
  voteEventPoll: voteEventPollApi,
  createMoyasarPayment: createMoyasarPaymentApi,
  updateServiceBookingPayment: updateServiceBookingPaymentApi,
  getMyEvents: getMyEventsApi,
  getMyCreatedEvents: getMyCreatedEventsApi,
  getMyJoinedEvents: getMyJoinedEventsApi,
  getMyInvitations: getMyInvitationsApi,
  getEventMedia: getEventMediaApi,
  rateEvent: rateEventApi,
  getEventRatings: getEventRatingsApi,
  getEventRatingSummary: getEventRatingSummaryApi,
  rateMerchant: rateMerchantApi,
  scanAttendance: scanAttendanceApi,
  markManualAttendance: markManualAttendanceApi,
  markEventAsDraft: markEventAsDraftApi,
  publishDraftEvent: publishDraftEventApi,
};

export default eventApi;
