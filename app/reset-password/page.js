"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { authService } from "../services/authService";

export default function ResetPasswordPage() {
  const router = useRouter();
  
  // Step 1: Forgot Password (Email), Step 2: Reset Password (OTP + New Password)
  const [step, setStep] = useState(1);
  
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Step 1: Submit Email -> Request Forgot Password
  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);

    try {
      const res = await authService.forgotPassword({ email });
      if (res && res.status) {
        setSuccessMsg(res.message || "OTP code sent to your email!");
        if (res.userId) {
          setUserId(res.userId);
        }
        setTimeout(() => {
          setStep(2);
          setSuccessMsg("");
        }, 1200);
      } else {
        setErrorMsg(res?.message || "Failed to send reset code. Please check your email.");
      }
    } catch (err) {
      setErrorMsg("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Submit OTP & New Password -> Reset Password
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!otp) {
      setErrorMsg("Please enter the OTP code.");
      return;
    }
    if (!newPassword || newPassword.length < 4) {
      setErrorMsg("Please enter a valid new password.");
      return;
    }

    setLoading(true);

    try {
      const res = await authService.resetPassword({
        userId: userId || "68ca7751a59eed28516eaf3b",
        otp,
        newPassword,
      });

      if (res && res.status) {
        setSuccessMsg(res.message || "Password reset successfully!");
        setTimeout(() => {
          router.push("/login");
        }, 1200);
      } else {
        setErrorMsg(res?.message || "Invalid OTP code or request. Please try again.");
      }
    } catch (err) {
      setErrorMsg("An error occurred during password reset.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header />
      <div className="form-wrapper bg-light d-flex align-items-center justify-content-center" style={{ minHeight: "calc(100vh - 90px)", paddingTop: "100px", paddingBottom: "100px" }}>
        <div className="container d-flex justify-content-center align-items-center">
          <div
            className="registration border p-5 rounded-4 bg-white shadow-lg position-relative"
            style={{ maxWidth: "450px", width: "100%" }}
          >
            {/* Back button */}
            <button
              onClick={() => (step === 2 ? setStep(1) : router.back())}
              className="border-0 bg-transparent mb-4 p-0 text-dark fs-4"
              style={{ cursor: "pointer" }}
            >
              <i className="fa-solid fa-arrow-left"></i>
            </button>

            <h2 className="fw-bold mb-2" style={{ color: "#0c1b33", fontSize: "32px" }}>
              {step === 1 ? "Forgot Password" : "Reset Password"}
            </h2>
            <p className="text-muted small mb-4" style={{ fontSize: "15px", lineHeight: "1.5" }}>
              {step === 1
                ? "Please enter your email address to receive a verification OTP."
                : `Enter the OTP sent to ${email || "your email"} and set a new password.`}
            </p>

            {errorMsg && (
              <div className="alert alert-danger py-2 fs-6 rounded-3 mb-3" role="alert">
                <i className="fa-solid fa-circle-exclamation me-2"></i>
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="alert alert-success py-2 fs-6 rounded-3 mb-3" role="alert">
                <i className="fa-solid fa-circle-check me-2"></i>
                {successMsg}
              </div>
            )}

            {step === 1 ? (
              /* STEP 1 FORM */
              <form onSubmit={handleForgotPasswordSubmit}>
                <div className="form-group mb-4 position-relative">
                  <span
                    className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"
                    style={{ zIndex: 10 }}
                  >
                    <i className="fa-regular fa-envelope"></i>
                  </span>
                  <input
                    type="email"
                    className="form-control rounded-pill border-light-subtle h_50 ps-5"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{ background: "#f8f9fa", border: "1px solid #e9ecef" }}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn w-100 rounded-pill d-flex align-items-center justify-content-between px-4 py-3 text-white border-0 shadow-sm transition-all"
                  style={{
                    background: "#5b67f1",
                    fontSize: "16px",
                    fontWeight: "bold",
                    height: "55px",
                    opacity: loading ? 0.7 : 1,
                  }}
                >
                  <span className="mx-auto">{loading ? "SENDING..." : "SEND OTP"}</span>
                  <span
                    className="bg-white rounded-circle d-flex align-items-center justify-content-center"
                    style={{ width: "30px", height: "30px", color: "#5b67f1" }}
                  >
                    {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-arrow-right"></i>}
                  </span>
                </button>
              </form>
            ) : (
              /* STEP 2 FORM */
              <form onSubmit={handleResetPasswordSubmit}>
                {/* OTP Input */}
                <div className="form-group mb-3 position-relative">
                  <span
                    className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"
                    style={{ zIndex: 10 }}
                  >
                    <i className="fa-solid fa-key"></i>
                  </span>
                  <input
                    type="text"
                    className="form-control rounded-pill border-light-subtle h_50 ps-5"
                    placeholder="Enter OTP (e.g. 0000)"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    style={{ background: "#f8f9fa", border: "1px solid #e9ecef" }}
                    required
                  />
                </div>

                {/* New Password Input */}
                <div className="form-group mb-4 position-relative">
                  <span
                    className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"
                    style={{ zIndex: 10 }}
                  >
                    <i className="fa-solid fa-lock"></i>
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    className="form-control rounded-pill border-light-subtle h_50 ps-5 pe-5"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={{ background: "#f8f9fa", border: "1px solid #e9ecef" }}
                    required
                  />
                  <span
                    className="position-absolute top-50 end-0 translate-middle-y me-3 text-muted cursor-pointer"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ zIndex: 10 }}
                  >
                    <i className={`fa-solid ${showPassword ? "fa-eye" : "fa-eye-slash"}`}></i>
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn w-100 rounded-pill d-flex align-items-center justify-content-between px-4 py-3 text-white border-0 shadow-sm transition-all"
                  style={{
                    background: "#5b67f1",
                    fontSize: "16px",
                    fontWeight: "bold",
                    height: "55px",
                    opacity: loading ? 0.7 : 1,
                  }}
                >
                  <span className="mx-auto">{loading ? "RESETTING..." : "RESET PASSWORD"}</span>
                  <span
                    className="bg-white rounded-circle d-flex align-items-center justify-content-center"
                    style={{ width: "30px", height: "30px", color: "#5b67f1" }}
                  >
                    {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-arrow-right"></i>}
                  </span>
                </button>
              </form>
            )}

            <div className="text-center mt-4">
              <span className="text-muted small">Remember your password? </span>
              <Link href="/login" className="signup-link text-decoration-none fw-bold" style={{ color: "#5b67f1" }}>
                Login
              </Link>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
