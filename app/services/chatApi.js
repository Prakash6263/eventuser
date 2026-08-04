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

// 4. Fetch (or create) Merchant 1:1 Chat + messages
export const getMerchantChatApi = async (eventId, merchantId) => {
  return await apiRequest(
    `/chat/merchant-chat?eventId=${eventId}&merchantId=${merchantId}`,
    { method: "GET" }
  );
};

// 5. Send Merchant Chat Message
export const sendMerchantChatMessageApi = async (chatId, content) => {
  return await apiRequest("/chat/merchant-chat/send", {
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
  getMerchantChat: getMerchantChatApi,
  sendMerchantChatMessage: sendMerchantChatMessageApi,
};

export default chatApi;
