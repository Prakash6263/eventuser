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
      <main className="flex-grow-1 d-flex align-items-center justify-content-center py-4" style={{ marginTop: "80px", marginBottom: "30px" }}>
        <div className="container px-3">
          <div className="row justify-content-center">
            <div className="col-12 col-sm-10 col-md-8 col-lg-5 col-xl-4">
              <div className="bg-white rounded-4 border shadow-sm p-4">
                {/* Top header with Back arrow and Title */}
                <div className="d-flex align-items-center mb-3">
                  <button
                    type="button"
                    onClick={() => router.back()}
                    className="btn btn-light rounded-circle p-0 me-3 d-flex align-items-center justify-content-center"
                    style={{ width: "36px", height: "36px" }}
                    title="Back"
                  >
                    <i className="fa-solid fa-arrow-left text-dark"></i>
                  </button>
                  <h4 className="fw-bold mb-0" style={{ color: "#0c1b33" }}>
                    Sign up
                  </h4>
                </div>

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
                  <div className="form-group mb-2.5 position-relative">
                    <span
                      className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"
                      style={{ zIndex: 10 }}
                    >
                      <i className="fa-regular fa-user"></i>
                    </span>
                    <input
                      type="text"
                      className="form-control rounded-pill ps-5"
                      placeholder="Full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      style={{ background: "#f8f9fa", border: "1px solid #e9ecef", height: "46px" }}
                      required
                    />
                  </div>

                  {/* Email */}
                  <div className="form-group mb-2.5 position-relative">
                    <span
                      className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"
                      style={{ zIndex: 10 }}
                    >
                      <i className="fa-regular fa-envelope"></i>
                    </span>
                    <input
                      type="email"
                      className="form-control rounded-pill ps-5"
                      placeholder="Email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={{ background: "#f8f9fa", border: "1px solid #e9ecef", height: "46px" }}
                      required
                    />
                  </div>

                  {/* Mobile */}
                  <div className="form-group mb-2.5 position-relative">
                    <span
                      className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"
                      style={{ zIndex: 10 }}
                    >
                      <i className="fa-solid fa-phone"></i>
                    </span>
                    <input
                      type="tel"
                      className="form-control rounded-pill ps-5"
                      placeholder="Mobile number"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      style={{ background: "#f8f9fa", border: "1px solid #e9ecef", height: "46px" }}
                      required
                    />
                  </div>

                  {/* Password */}
                  <div className="form-group mb-2.5 position-relative">
                    <span
                      className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"
                      style={{ zIndex: 10 }}
                    >
                      <i className="fa-solid fa-lock"></i>
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      className="form-control rounded-pill ps-5 pe-5"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={{ background: "#f8f9fa", border: "1px solid #e9ecef", height: "46px" }}
                      required
                    />
                    <span
                      className="position-absolute top-50 end-0 translate-middle-y me-3 text-muted"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ zIndex: 10, cursor: "pointer" }}
                    >
                      <i className={`fa-solid ${showPassword ? "fa-eye" : "fa-eye-slash"}`}></i>
                    </span>
                  </div>

                  {/* Confirm Password */}
                  <div className="form-group mb-3 position-relative">
                    <span
                      className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"
                      style={{ zIndex: 10 }}
                    >
                      <i className="fa-solid fa-lock"></i>
                    </span>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      className="form-control rounded-pill ps-5 pe-5"
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      style={{ background: "#f8f9fa", border: "1px solid #e9ecef", height: "46px" }}
                      required
                    />
                    <span
                      className="position-absolute top-50 end-0 translate-middle-y me-3 text-muted"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={{ zIndex: 10, cursor: "pointer" }}
                    >
                      <i className={`fa-solid ${showConfirmPassword ? "fa-eye" : "fa-eye-slash"}`}></i>
                    </span>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn w-100 rounded-pill d-flex align-items-center justify-content-between px-4 text-white border-0 shadow-sm"
                    style={{
                      background: "linear-gradient(135deg, #5b67f1, #3e52e9)",
                      height: "48px",
                      fontSize: "15px",
                      fontWeight: "600",
                      opacity: loading ? 0.75 : 1,
                    }}
                  >
                    <span className="mx-auto">
                      {loading ? "Creating account..." : "SIGN UP"}
                    </span>
                    <span
                      className="bg-white rounded-circle d-flex align-items-center justify-content-center"
                      style={{ width: "28px", height: "28px", color: "#5b67f1", flexShrink: 0 }}
                    >
                      {loading ? (
                        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: "12px" }}></i>
                      ) : (
                        <i className="fa-solid fa-arrow-right" style={{ fontSize: "12px" }}></i>
                      )}
                    </span>
                  </button>
                </form>

                {/* Footer link */}
                <div className="text-center mt-3 pt-1">
                  <span className="text-muted small">Already have an account? </span>
                  <Link
                    href="/login"
                    className="fw-semibold text-decoration-none"
                    style={{ color: "#5b67f1" }}
                  >
                    Login
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
