"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { authService } from "../services/authService";

export default function LoginPage() {
  const router = useRouter();
  const [loginType, setLoginType] = useState("email"); // "email" or "mobile"

  // Email form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Mobile OTP form state
  const [mobile, setMobile] = useState("");
  const [mobileStep, setMobileStep] = useState(1); // 1 = Send OTP, 2 = Verify OTP
  const [otp, setOtp] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleTabChange = (type) => {
    setLoginType(type);
    setErrorMsg("");
    setSuccessMsg("");
    if (type === "email") {
      setMobileStep(1);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);

    try {
      if (loginType === "email") {
        const res = await authService.login({ email, password });

        if (res && res.status) {
          setSuccessMsg(res.message || "Login successful!");
          setTimeout(() => {
            router.push("/user-profile");
          }, 1000);
        } else {
          setErrorMsg(res?.message || "Invalid credentials. Please try again.");
        }
      } else {
        // Mobile OTP Flow
        if (mobileStep === 1) {
          if (!mobile || mobile.trim().length < 5) {
            setErrorMsg("Please enter a valid mobile number.");
            setLoading(false);
            return;
          }

          const res = await authService.sendLoginOtp({ mobile });

          if (res && res.status) {
            setSuccessMsg(res.message || "OTP sent successfully to your mobile!");
            setMobileStep(2);
          } else {
            setErrorMsg(res?.message || "Failed to send OTP. Please try again.");
          }
        } else {
          // Step 2: Verify OTP
          if (!otp || otp.trim().length === 0) {
            setErrorMsg("Please enter the OTP code.");
            setLoading(false);
            return;
          }

          const res = await authService.verifyLoginOtp({
            mobile,
            otp,
            register_id: "34444",
            ios_register_id: "34444",
          });

          if (res && res.status) {
            setSuccessMsg(res.message || "Login successful!");
            setTimeout(() => {
              router.push("/user-profile");
            }, 1000);
          } else {
            setErrorMsg(res?.message || "Invalid OTP code. Please try again.");
          }
        }
      }
    } catch (err) {
      setErrorMsg("An unexpected error occurred during login.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);
    try {
      const res = await authService.sendLoginOtp({ mobile });
      if (res && res.status) {
        setSuccessMsg(res.message || "OTP resent successfully!");
      } else {
        setErrorMsg(res?.message || "Failed to resend OTP.");
      }
    } catch (err) {
      setErrorMsg("Error resending OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header />
      <div
        className="form-wrapper bg-light py-5"
        style={{ minHeight: "calc(100vh - 140px)", marginTop: "80px" }}
      >
        <div className="container d-flex justify-content-center align-items-center px-3">
          <div
            className="registration border p-4 p-md-5 rounded-4 bg-white shadow-lg position-relative"
            style={{ maxWidth: "440px", width: "100%", borderRadius: "24px" }}
          >
            {/* Top Brand Logo */}
            <div className="text-center mb-4 pt-2">
              <Link href="/">
                <img
                  src="/images/logo.png"
                  alt="EVENT UNA"
                  style={{ maxHeight: "55px", width: "auto", objectFit: "contain" }}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.style.display = "none";
                  }}
                />
              </Link>
            </div>

            {/* Tab Switcher: Email vs Mobile Number */}
            <div className="row g-2 mb-4">
              <div className="col-6">
                <button
                  type="button"
                  onClick={() => handleTabChange("email")}
                  className="btn w-100 rounded-3 py-2 fw-semibold border-0 transition-all"
                  style={{
                    backgroundColor: loginType === "email" ? "#5b67f1" : "#9ca3af",
                    color: "#ffffff",
                    fontSize: "15px",
                    height: "46px",
                    boxShadow: loginType === "email" ? "0 4px 12px rgba(91,103,241,0.3)" : "none",
                  }}
                >
                  Email
                </button>
              </div>
              <div className="col-6">
                <button
                  type="button"
                  onClick={() => handleTabChange("mobile")}
                  className="btn w-100 rounded-3 py-2 fw-semibold border-0 transition-all"
                  style={{
                    backgroundColor: loginType === "mobile" ? "#5b67f1" : "#9ca3af",
                    color: "#ffffff",
                    fontSize: "15px",
                    height: "46px",
                    boxShadow: loginType === "mobile" ? "0 4px 12px rgba(91,103,241,0.3)" : "none",
                  }}
                >
                  Mobile Number
                </button>
              </div>
            </div>

            {/* Error & Success Messages */}
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

            {/* Form */}
            <form onSubmit={handleLogin}>
              {loginType === "email" ? (
                /* EMAIL LOGIN FORM */
                <>
                  <div className="form-group mb-3 position-relative">
                    <span
                      className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"
                      style={{ zIndex: 10, fontSize: "16px" }}
                    >
                      <i className="fa-regular fa-envelope"></i>
                    </span>
                    <input
                      className="form-control rounded-4 border-light-subtle ps-5"
                      type="email"
                      placeholder="Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={{ height: "50px", background: "#ffffff", border: "1px solid #d1d5db" }}
                      required
                    />
                  </div>

                  <div className="form-group mb-2 position-relative">
                    <span
                      className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"
                      style={{ zIndex: 10, fontSize: "16px" }}
                    >
                      <i className="fa-solid fa-lock"></i>
                    </span>
                    <input
                      className="form-control rounded-4 border-light-subtle ps-5 pe-5"
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={{ height: "50px", background: "#ffffff", border: "1px solid #d1d5db" }}
                      required
                    />
                    <span
                      className="pass-show-eye position-absolute top-50 translate-middle-y me-3 end-0 cursor-pointer text-muted"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ zIndex: 10 }}
                    >
                      <i className={`fas ${showPassword ? "fa-eye" : "fa-eye-slash"}`}></i>
                    </span>
                  </div>

                  <div className="text-start mb-4">
                    <Link
                      href="/reset-password"
                      className="forgot-pass-link small text-decoration-none text-dark fw-medium"
                      style={{ fontSize: "14px" }}
                    >
                      Forgot password?
                    </Link>
                  </div>
                </>
              ) : (
                /* MOBILE OTP LOGIN FORM */
                <>
                  {mobileStep === 1 ? (
                    <div className="form-group mb-4 position-relative">
                      <span
                        className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"
                        style={{ zIndex: 10, fontSize: "16px" }}
                      >
                        <i className="fa-solid fa-mobile-screen-button"></i>
                      </span>
                      <input
                        className="form-control rounded-4 border-light-subtle ps-5"
                        type="tel"
                        placeholder="Mobile Number"
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value)}
                        style={{ height: "50px", background: "#ffffff", border: "1px solid #d1d5db" }}
                        required
                      />
                    </div>
                  ) : (
                    /* Step 2: OTP Verification */
                    <div>
                      <div className="d-flex align-items-center justify-content-between mb-3 p-2 px-3 rounded-3 bg-light border">
                        <span className="small text-muted">
                          OTP sent to <strong>{mobile}</strong>
                        </span>
                        <button
                          type="button"
                          className="btn btn-link btn-sm p-0 text-decoration-none fw-bold"
                          style={{ color: "#5b67f1" }}
                          onClick={() => setMobileStep(1)}
                        >
                          Change
                        </button>
                      </div>

                      <div className="form-group mb-3 position-relative">
                        <span
                          className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"
                          style={{ zIndex: 10, fontSize: "16px" }}
                        >
                          <i className="fa-solid fa-key"></i>
                        </span>
                        <input
                          className="form-control rounded-4 border-light-subtle ps-5"
                          type="text"
                          placeholder="Enter OTP (e.g. 123456)"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value)}
                          style={{ height: "50px", background: "#ffffff", border: "1px solid #d1d5db" }}
                          required
                          autoFocus
                        />
                      </div>

                      <div className="text-end mb-4">
                        <button
                          type="button"
                          onClick={handleResendOtp}
                          disabled={loading}
                          className="btn btn-link btn-sm text-decoration-none p-0 fw-semibold"
                          style={{ color: "#5b67f1", fontSize: "14px" }}
                        >
                          Resend OTP
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Submit Button */}
              <button
                className="btn w-100 rounded-4 d-flex align-items-center justify-content-between px-4 py-3 text-white border-0 shadow-sm transition-all"
                type="submit"
                disabled={loading}
                style={{
                  background: "#5b67f1",
                  fontSize: "16px",
                  fontWeight: "bold",
                  height: "52px",
                  opacity: loading ? 0.7 : 1,
                  boxShadow: "0 6px 18px rgba(91,103,241,0.35)",
                }}
              >
                <span className="mx-auto text-uppercase">
                  {loading
                    ? "PROCESSING..."
                    : loginType === "email"
                    ? "SIGN IN"
                    : mobileStep === 1
                    ? "SIGN IN"
                    : "VERIFY & SIGN IN"}
                </span>
                <span
                  className="rounded-circle d-flex align-items-center justify-content-center"
                  style={{
                    width: "30px",
                    height: "30px",
                    backgroundColor: "rgba(255, 255, 255, 0.25)",
                  }}
                >
                  {loading ? (
                    <i className="fa-solid fa-spinner fa-spin text-white"></i>
                  ) : (
                    <i className="fa-solid fa-arrow-right text-white" style={{ fontSize: "14px" }}></i>
                  )}
                </span>
              </button>
            </form>

            {/* Bottom Sign Up Link */}
            <div className="text-center pt-4">
              <span className="text-dark fw-medium" style={{ fontSize: "15px" }}>
                Don't have an account?{" "}
              </span>
              <Link
                href="/signup"
                className="signup-link text-decoration-underline fw-bold"
                style={{ color: "#5b67f1", fontSize: "15px" }}
              >
                Sign Up Now
              </Link>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}


