import { apiRequest } from "./apiClient";

// 1. Fetch Event Group Chat Details
export const getEventGroupChatApi = async (eventId) => {
  return await apiRequest(`/chat/event-group-chat?eventId=${eventId}`, {
    method: "GET",
  });
};

// 2. Fetch Chat Messages List
export const getChatMessagesApi = async (chatId) => {
  return await apiRequest(`/chat/messages?chatId=${chatId}`, {
    method: "GET",
  });
};

// 3. Send Chat Message
export const sendChatMessageApi = async (chatId, content) => {
  return await apiRequest("/chat/send-message", {
    method: "POST",
    body: JSON.stringify({
      chatId,
      content,
    }),
  });
};

export const chatApi = {
  getEventGroupChat: getEventGroupChatApi,
  getChatMessages: getChatMessagesApi,
  sendChatMessage: sendChatMessageApi,
};

export default chatApi;
