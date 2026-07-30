export const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://eventuna.com/api";

export const getToken = () => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("user_token") || "";
  }
  return "";
};

export const getUser = () => {
  if (typeof window !== "undefined") {
    const userStr = localStorage.getItem("user_info");
    return userStr ? JSON.parse(userStr) : null;
  }
  return null;
};

export const clearUserScopedData = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("eventuna-latest-event");
    localStorage.removeItem("eventuna-latest-event-id");
    localStorage.removeItem("eventuna-contacts");
    localStorage.removeItem("eventuna-reservations");
    localStorage.removeItem("eventuna-latest-reservation");
    localStorage.removeItem("event-details-back-url");
    localStorage.removeItem("event-details-back-label");
  }
};

export const saveAuthData = (authData) => {
  if (typeof window !== "undefined") {
    const currentUser = getUser() || {};
    const isAuthSessionUpdate = !!(authData.token || authData.userId || authData.email);

    if (isAuthSessionUpdate) {
      clearUserScopedData();
    }

    if (authData.token) {
      localStorage.setItem("user_token", authData.token);
    }
    const updatedUser = isAuthSessionUpdate ? { ...authData } : { ...currentUser, ...authData };
    localStorage.setItem("user_info", JSON.stringify(updatedUser));
  }
};

export const clearAuthData = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("user_token");
    localStorage.removeItem("user_info");
    clearUserScopedData();
  }
};

export const isLoggedIn = () => {
  if (typeof window !== "undefined") {
    return !!localStorage.getItem("user_token");
  }
  return false;
};

export const isAuthFailureResponse = (response, data) => {
  const message = String(data?.message || data?.error || "").toLowerCase();
  return response?.status === 401 ||
    response?.status === 403 ||
    message.includes("invalid token") ||
    message.includes("token expired") ||
    message.includes("jwt expired") ||
    message.includes("unauthorized");
};

export const handleAuthFailure = () => {
  if (typeof window === "undefined") return;

  clearAuthData();

  if (window.location.pathname !== "/login") {
    window.location.replace("/login");
  }
};

export const apiRequest = async (endpoint, options = {}) => {
  try {
    const isFormData = options.body instanceof FormData;
    const defaultHeaders = {};

    if (!isFormData) {
      defaultHeaders["Content-Type"] = "application/json";
    }

    const token = getToken();
    if (token) {
      defaultHeaders["Authorization"] = `Bearer ${token}`;
    }

    // Automatically stringify body if it's an object and not FormData
    let requestBody = options.body;
    if (requestBody && !isFormData && typeof requestBody === "object") {
      requestBody = JSON.stringify(requestBody);
    }

    const config = {
      ...options,
      body: requestBody,
      headers: {
        ...defaultHeaders,
        ...(options.headers || {}),
      },
    };

    const response = await fetch(`${BASE_URL}${endpoint}`, config);
    const data = await response.json();

    if (isAuthFailureResponse(response, data)) {
      handleAuthFailure();
      return {
        status: false,
        message: data?.message || "Session expired. Please login again.",
      };
    }

    return data;
  } catch (error) {
    console.error(`API Request Error [${endpoint}]:`, error);
    return {
      status: false,
      message: error.message || "Network error. Please try again.",
    };
  }
};
