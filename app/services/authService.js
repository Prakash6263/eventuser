import { getToken, getUser, saveAuthData, clearAuthData, isLoggedIn } from "./apiClient";
import {
  authApi,
  signupApi,
  verifyOtpApi,
  loginApi,
  logoutApi,
  deleteUserApi,
  forgotPasswordApi,
  resetPasswordApi,
  changePasswordApi,
  getUserProfileApi,
  updateProfileApi,
} from "./authApi";

export {
  getToken,
  getUser,
  saveAuthData,
  clearAuthData,
  isLoggedIn,
  authApi,
  signupApi,
  verifyOtpApi,
  loginApi,
  logoutApi,
  deleteUserApi,
  forgotPasswordApi,
  resetPasswordApi,
  changePasswordApi,
  getUserProfileApi,
  updateProfileApi,
};

export const authService = {
  getToken,
  getUser,
  saveAuthData,
  clearAuthData,
  isLoggedIn,
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
};

export default authApi;
