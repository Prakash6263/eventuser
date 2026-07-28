import { apiRequest, getToken, saveAuthData, clearAuthData } from "./apiClient";

// 1. Signup API
export const signupApi = async ({
  fullName,
  email,
  mobile,
  countryCode = "+91",
  password,
  register_id = "34444",
}) => {
  return await apiRequest("/auth/signup", {
    method: "POST",
    body: JSON.stringify({
      fullName,
      email,
      mobile,
      countryCode,
      password,
      register_id,
    }),
  });
};

// 2. Verify OTP API
export const verifyOtpApi = async ({ userId, otp }) => {
  return await apiRequest("/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({
      userId,
      otp,
    }),
  });
};

// 3. Login API
export const loginApi = async ({ email, password }) => {
  const data = await apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
    }),
  });

  if (data && data.status && data.token) {
    saveAuthData({
      token: data.token,
      userId: data.userId,
      role: data.role,
      register_id: data.register_id,
      email,
    });
  }

  return data;
};

// 4. Logout API
export const logoutApi = async (credentials = null) => {
  try {
    const data = await apiRequest("/auth/logout", {
      method: "POST",
      body: JSON.stringify(credentials || {}),
    });

    clearAuthData();
    return data;
  } catch (error) {
    clearAuthData();
    return { status: false, message: error.message || "Logout completed locally" };
  }
};

// 5. Delete User API
export const deleteUserApi = async () => {
  try {
    const data = await apiRequest("/auth/delete-user", {
      method: "POST",
    });

    clearAuthData();
    return data;
  } catch (error) {
    clearAuthData();
    return { status: false, message: error.message || "Failed to delete user" };
  }
};

// 6. Forgot Password API
export const forgotPasswordApi = async ({ email }) => {
  return await apiRequest("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({
      email,
    }),
  });
};

// 7. Reset Password API
export const resetPasswordApi = async ({ userId, otp, newPassword }) => {
  return await apiRequest("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({
      userId,
      otp,
      newPassword,
    }),
  });
};

// 8. Change Password API
export const changePasswordApi = async ({ newPassword }) => {
  return await apiRequest("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({
      newPassword,
    }),
  });
};

// 9. Get User Profile API
export const getUserProfileApi = async () => {
  const data = await apiRequest("/auth/user-profile", {
    method: "GET",
  });

  if (data && data.status && data.user) {
    saveAuthData({ userProfile: data.user });
  }

  return data;
};

// 10. Update Profile API (Supports FormData for profilePic, dob, gender, etc.)
export const updateProfileApi = async (payload) => {
  let body;
  if (payload instanceof FormData) {
    body = payload;
  } else {
    const formData = new FormData();
    Object.keys(payload).forEach((key) => {
      if (payload[key] !== undefined && payload[key] !== null) {
        formData.append(key, payload[key]);
      }
    });
    body = formData;
  }

  const data = await apiRequest("/auth/update-profile", {
    method: "PUT",
    body,
  });

  return data;
};

// 11. Sync Contacts API
export const syncContactsApi = async ({ contacts }) => {
  return await apiRequest("/auth/sync-contacts", {
    method: "POST",
    body: JSON.stringify({ contacts }),
  });
};

// 12. Get All Users API
export const getAllUsersApi = async () => {
  return await apiRequest("/auth/all-users", {
    method: "GET",
  });
};

export const authApi = {
  signup: signupApi,
  verifyOtp: verifyOtpApi,
  login: loginApi,
  logout: logoutApi,
  deleteUser: deleteUserApi,
  forgotPassword: forgotPasswordApi,
  resetPassword: resetPasswordApi,
  changePassword: changePasswordApi,
  getUserProfile: getUserProfileApi,
  updateProfile: updateProfileApi,
  syncContacts: syncContactsApi,
  getAllUsers: getAllUsersApi,
};
