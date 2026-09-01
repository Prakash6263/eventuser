"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { authService } from "../services/authService";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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
        password,
        register_id: "34444",
      });

      if (res && res.status) {
        setSuccessMsg(res.message || "OTP sent successfully!");
        const targetUserId = res.userId || "";
        setTimeout(() => {
          router.push(
            `/verification?userId=${encodeURIComponent(targetUserId)}&mobile=${encodeURIComponent(mobile)}`
          );
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
    <div className="d-flex flex-column min-vh-100 bg-light">
      <Header />
      <main className="flex-grow-1 d-flex align-items-center justify-content-center py-5" style={{ marginTop: "75px" }}>
        <div className="container px-3">
          <div className="row justify-content-center">
            <div className="col-12 col-sm-10 col-md-8 col-lg-6 col-xl-5">
              <div
                className="registration border p-4 p-md-5 rounded-4 bg-white shadow-sm"
                style={{ borderRadius: "16px" }}
              >
                {/* Brand Logo */}
                <div className="text-center mb-3">
                  <Link href="/">
                    <img
                      src="/images/logo.png"
                      alt="EVENTUNA"
                      style={{ maxHeight: "50px", width: "auto", objectFit: "contain" }}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.style.display = "none";
                      }}
                    />
                  </Link>
                </div>

                {/* Heading */}
                <h2 className="registration-title text-center mt-0 mb-1" style={{ fontSize: "24px", color: "#0c1b33" }}>
                  Sign Up
                </h2>
                <p className="text-center text-muted mb-4" style={{ fontSize: "14px" }}>
                  Create your Eventuna account
                </p>

                {/* Alerts */}
                {errorMsg && (
                  <div className="alert alert-danger py-2 px-3 small rounded-3 mb-3" role="alert">
                    <i className="fa-solid fa-circle-exclamation me-2"></i>
                    {errorMsg}
                  </div>
                )}
                {successMsg && (
                  <div className="alert alert-success py-2 px-3 small rounded-3 mb-3" role="alert">
                    <i className="fa-solid fa-circle-check me-2"></i>
                    {successMsg}
                  </div>
                )}

                {/* Signup Form */}
                <form onSubmit={handleSignup}>
                  {/* Full Name */}
                  <div className="form-group mb-3">
                    <label className="form-label text-secondary small fw-medium mb-1">Full Name*</label>
                    <input
                      type="text"
                      className="form-control rounded-3 h_50"
                      placeholder="Enter your full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>

                  {/* Email */}
                  <div className="form-group mb-3">
                    <label className="form-label text-secondary small fw-medium mb-1">Email Address*</label>
                    <input
                      type="email"
                      className="form-control rounded-3 h_50"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  {/* Mobile Number */}
                  <div className="form-group mb-3">
                    <label className="form-label text-secondary small fw-medium mb-1">Mobile Number*</label>
                    <input
                      type="tel"
                      className="form-control rounded-3 h_50"
                      placeholder="Enter mobile number"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      required
                    />
                  </div>

                  {/* Password */}
                  <div className="form-group mb-3">
                    <label className="form-label text-secondary small fw-medium mb-1">Password*</label>
                    <div className="position-relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        className="form-control rounded-3 h_50 pe-5"
                        placeholder="Enter password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <span
                        className="position-absolute top-50 end-0 translate-middle-y me-3 text-muted"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{ cursor: "pointer", zIndex: 10 }}
                      >
                        <i className={`fa-solid ${showPassword ? "fa-eye" : "fa-eye-slash"}`}></i>
                      </span>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className="form-group mb-4">
                    <label className="form-label text-secondary small fw-medium mb-1">Confirm Password*</label>
                    <div className="position-relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        className="form-control rounded-3 h_50 pe-5"
                        placeholder="Re-enter password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                      />
                      <span
                        className="position-absolute top-50 end-0 translate-middle-y me-3 text-muted"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        style={{ cursor: "pointer", zIndex: 10 }}
                      >
                        <i className={`fa-solid ${showConfirmPassword ? "fa-eye" : "fa-eye-slash"}`}></i>
                      </span>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn w-100 rounded-3 text-white fw-semibold border-0 transition-all py-2.5"
                    style={{
                      backgroundColor: "#3e56f0",
                      height: "48px",
                      fontSize: "16px",
                      opacity: loading ? 0.75 : 1,
                    }}
                  >
                    {loading ? (
                      <span>
                        <i className="fa-solid fa-spinner fa-spin me-2"></i>Creating Account...
                      </span>
                    ) : (
                      "Sign Up"
                    )}
                  </button>
                </form>

                {/* Footer link */}
                <div className="text-center mt-4 pt-2 border-top">
                  <span className="text-muted small">Already have an account? </span>
                  <Link href="/login" className="signup-link text-decoration-none fw-semibold">
                    Sign In
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
