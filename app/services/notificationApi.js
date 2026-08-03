import { apiRequest } from "./apiClient";

// Get User Event Notifications API
export const getUserNotificationsApi = async () => {
  return await apiRequest("/notifications/user-event-notification", {
    method: "GET",
  });
};

export const notificationApi = {
  getUserNotifications: getUserNotificationsApi,
};

export default notificationApi;
