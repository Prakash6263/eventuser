"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "../components/Header";
import Footer from "../components/Footer";
import CountryCodePicker from "../components/CountryCodePicker";
import { authService } from "../services/authService";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [registerId, setRegisterId] = useState("34444");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleSignup = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match!");
      return;
    }

    setLoading(true);

    try {
      const res = await authService.signup({
        fullName,
        email,
        mobile,
        countryCode,
        password,
        register_id: registerId || "34444",
      });

      if (res && res.status) {
        setSuccessMsg(res.message || "OTP sent successfully!");
        const targetUserId = res.userId || "";
        setTimeout(() => {
          router.push(`/verification?userId=${encodeURIComponent(targetUserId)}&mobile=${encodeURIComponent(countryCode + " " + mobile)}`);
        }, 1200);
      } else {
        setErrorMsg(res?.message || "Registration failed. Please try again.");
      }
    } catch (err) {
      setErrorMsg("An unexpected error occurred. Please try again.");
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
            style={{ maxWidth: "480px", width: "100%" }}
          >
            {/* Back button */}
            <button
              onClick={() => router.back()}
              className="border-0 bg-transparent mb-4 p-0 text-dark fs-4"
              style={{ cursor: "pointer" }}
            >
              <i className="fa-solid fa-arrow-left"></i>
            </button>

            <h2 className="fw-bold mb-4" style={{ color: "#0c1b33", fontSize: "32px" }}>
              Sign up
            </h2>

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

            <form onSubmit={handleSignup}>
              {/* Full Name */}
              <div className="form-group mb-3 position-relative">
                <span
                  className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"
                  style={{ zIndex: 10 }}
                >
                  <i className="fa-regular fa-user"></i>
                </span>
                <input
                  type="text"
                  className="form-control rounded-pill border-light-subtle h_50 ps-5"
                  placeholder="Full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{ background: "#f8f9fa", border: "1px solid #e9ecef" }}
                  required
                />
              </div>

              {/* Email */}
              <div className="form-group mb-3 position-relative">
                <span
                  className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"
                  style={{ zIndex: 10 }}
                >
                  <i className="fa-regular fa-envelope"></i>
                </span>
                <input
                  type="email"
                  className="form-control rounded-pill border-light-subtle h_50 ps-5"
                  placeholder="abc@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ background: "#f8f9fa", border: "1px solid #e9ecef" }}
                  required
                />
              </div>

              {/* Country Code & Mobile Number */}
              <div className="row g-2 mb-3">
                <div className="col-4">
                  <CountryCodePicker
                    value={countryCode}
                    onChange={(code) => setCountryCode(code)}
                  />
                </div>
                <div className="col-8">
                  <div className="form-group position-relative">
                    <span
                      className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"
                      style={{ zIndex: 10 }}
                    >
                      <i className="fa-solid fa-phone"></i>
                    </span>
                    <input
                      type="tel"
                      className="form-control rounded-pill border-light-subtle h_50 ps-5"
                      placeholder="Mobile number"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      style={{ background: "#f8f9fa", border: "1px solid #e9ecef" }}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Password */}
              <div className="form-group mb-3 position-relative">
                <span
                  className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"
                  style={{ zIndex: 10 }}
                >
                  <i className="fa-solid fa-lock"></i>
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  className="form-control rounded-pill border-light-subtle h_50 ps-5 pe-5"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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

              {/* Confirm Password */}
              <div className="form-group mb-4 position-relative">
                <span
                  className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"
                  style={{ zIndex: 10 }}
                >
                  <i className="fa-solid fa-lock"></i>
                </span>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  className="form-control rounded-pill border-light-subtle h_50 ps-5 pe-5"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{ background: "#f8f9fa", border: "1px solid #e9ecef" }}
                  required
                />
                <span
                  className="position-absolute top-50 end-0 translate-middle-y me-3 text-muted cursor-pointer"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{ zIndex: 10 }}
                >
                  <i className={`fa-solid ${showConfirmPassword ? "fa-eye" : "fa-eye-slash"}`}></i>
                </span>
              </div>

              {/* Submit Button */}
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
                <span className="mx-auto">{loading ? "SENDING OTP..." : "SIGN UP"}</span>
                <span
                  className="bg-white rounded-circle d-flex align-items-center justify-content-center"
                  style={{ width: "30px", height: "30px", color: "#5b67f1" }}
                >
                  {loading ? (
                    <i className="fa-solid fa-spinner fa-spin"></i>
                  ) : (
                    <i className="fa-solid fa-arrow-right"></i>
                  )}
                </span>
              </button>
            </form>

            <div className="text-center mt-4">
              <span className="text-muted small">Already have an account? </span>
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
