import { apiRequest } from "./apiClient";

// 1. Get Event Media API
export const getEventMediaApi = async (eventId) => {
  return await apiRequest(`/event-media/media?eventId=${eventId}`, {
    method: "GET",
  });
};

// 2. Like Media API
export const likeMediaApi = async (mediaId) => {
  return await apiRequest("/event-media/media/like", {
    method: "POST",
    body: JSON.stringify({ mediaId }),
  });
};

// 3. Post Comment on Media API
export const commentMediaApi = async ({ mediaId, comment }) => {
  return await apiRequest("/event-media/media/comment", {
    method: "POST",
    body: JSON.stringify({ mediaId, comment }),
  });
};

// 4. Delete Media API
export const deleteMediaApi = async (mediaId) => {
  return await apiRequest("/event-media/media", {
    method: "DELETE",
    body: JSON.stringify({ mediaId }),
  });
};

// 5. Delete Comment API
export const deleteCommentApi = async (commentId) => {
  return await apiRequest("/event-media/media/comment", {
    method: "DELETE",
    body: JSON.stringify({ commentId }),
  });
};

// 6. Like Comment API
export const likeCommentApi = async (commentId) => {
  return await apiRequest("/event-media/media/comment/like", {
    method: "POST",
    body: JSON.stringify({ commentId }),
  });
};

// 7. Get Media Comments API
export const getMediaCommentsApi = async ({ mediaId, page = 1, limit = 20 }) => {
  return await apiRequest(`/event-media/media/comments?mediaId=${mediaId}&page=${page}&limit=${limit}`, {
    method: "GET",
  });
};

// 8. Upload Media API (Multipart Form Data)
export const uploadMediaApi = async ({ eventId, caption, mediaFile }) => {
  const formData = new FormData();
  if (eventId) formData.append("eventId", eventId);
  if (caption) formData.append("caption", caption);
  if (mediaFile) formData.append("media", mediaFile);

  return await apiRequest("/event-media/upload", {
    method: "POST",
    body: formData,
  });
};

export const eventMediaApi = {
  getEventMedia: getEventMediaApi,
  likeMedia: likeMediaApi,
  commentMedia: commentMediaApi,
  deleteMedia: deleteMediaApi,
  deleteComment: deleteCommentApi,
  likeComment: likeCommentApi,
  getMediaComments: getMediaCommentsApi,
  uploadMedia: uploadMediaApi,
};

export default eventMediaApi;
