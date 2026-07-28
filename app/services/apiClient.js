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

export const saveAuthData = (authData) => {
  if (typeof window !== "undefined") {
    if (authData.token) {
      localStorage.setItem("user_token", authData.token);
    }
    const currentUser = getUser() || {};
    const updatedUser = { ...currentUser, ...authData };
    localStorage.setItem("user_info", JSON.stringify(updatedUser));
  }
};

export const clearAuthData = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("user_token");
    localStorage.removeItem("user_info");
  }
};

export const isLoggedIn = () => {
  if (typeof window !== "undefined") {
    return !!localStorage.getItem("user_token");
  }
  return false;
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

    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options.headers || {}),
      },
    };

    const response = await fetch(`${BASE_URL}${endpoint}`, config);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`API Request Error [${endpoint}]:`, error);
    return {
      status: false,
      message: error.message || "Network error. Please try again.",
    };
  }
};
