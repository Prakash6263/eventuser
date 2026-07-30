"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { authService } from "../services/authService";

function VerificationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const userIdFromQuery = searchParams.get("userId") || "";
  const mobileFromQuery = searchParams.get("mobile") || "+91 8052741232";

  const [otp, setOtp] = useState(["", "", "", ""]);
  const otpRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];
  const [countdown, setCountdown] = useState(20);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleOtpChange = (index, value) => {
    if (value.length > 1) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next box
    if (value !== "" && index < 3) {
      otpRefs[index + 1].current.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && otp[index] === "" && index > 0) {
      otpRefs[index - 1].current.focus();
    }
  };

  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const enteredCode = otp.join("");
    if (enteredCode.length < 4) {
      setErrorMsg("Please enter the complete 4-digit verification code.");
      return;
    }

    if (!userIdFromQuery) {
      setErrorMsg("User ID missing. Please return to signup and register again.");
      return;
    }

    setLoading(true);

    try {
      const res = await authService.verifyOtp({
        userId: userIdFromQuery,
        otp: enteredCode,
      });

      if (res && res.status) {
        setSuccessMsg(res.message || "User verified successfully!");
        setTimeout(() => {
          router.push("/login");
        }, 1200);
      } else {
        setErrorMsg(res?.message || "Invalid OTP code. Please try again.");
      }
    } catch (err) {
      setErrorMsg("An error occurred during verification. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = () => {
    setCountdown(20);
    setOtp(["", "", "", ""]);
    if (otpRefs[0].current) {
      otpRefs[0].current.focus();
    }
    setSuccessMsg("Verification code has been re-sent!");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  return (
    <div
      className="registration border p-5 rounded-4 bg-white shadow-lg position-relative"
      style={{ maxWidth: "450px", width: "100%" }}
    >
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="border-0 bg-transparent mb-4 p-0 text-dark fs-4"
        style={{ cursor: "pointer" }}
      >
        <i className="fa-solid fa-arrow-left"></i>
      </button>

      <h2 className="fw-bold mb-2" style={{ color: "#0c1b33", fontSize: "32px" }}>
        Verification
      </h2>
      <p className="text-muted small mb-4" style={{ fontSize: "15px", lineHeight: "1.5" }}>
        We&apos;ve sent you the verification code on <strong className="text-dark">{mobileFromQuery}</strong>
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

      <form onSubmit={handleVerifySubmit}>
        {/* OTP Box Inputs */}
        <div className="d-flex justify-content-center gap-3 mb-4">
          {otp.map((digit, idx) => (
            <input
              key={idx}
              ref={otpRefs[idx]}
              type="text"
              maxLength="1"
              className="form-control text-center fs-2 fw-bold"
              style={{
                width: "65px",
                height: "65px",
                borderRadius: "15px",
                background: "#f8f9fa",
                border: digit !== "" ? "2px solid #5b67f1" : "1px solid #e9ecef",
                color: digit !== "" ? "#5b67f1" : "#000",
              }}
              value={digit}
              onChange={(e) => handleOtpChange(idx, e.target.value)}
              onKeyDown={(e) => handleOtpKeyDown(idx, e)}
            />
          ))}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="btn w-100 rounded-pill d-flex align-items-center justify-content-between px-4 py-3 text-white border-0 shadow-sm transition-all mb-4"
          style={{
            background: "#5b67f1",
            fontSize: "16px",
            fontWeight: "bold",
            height: "55px",
            opacity: loading ? 0.7 : 1,
          }}
        >
          <span className="mx-auto">{loading ? "VERIFYING..." : "CONTINUE"}</span>
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

      <div className="text-center">
        {countdown > 0 ? (
          <span className="text-muted small">
            Re-send code in{" "}
            <strong className="fw-semibold" style={{ color: "#5b67f1" }}>
              0:{countdown < 10 ? `0${countdown}` : countdown}
            </strong>
          </span>
        ) : (
          <button
            type="button"
            className="btn btn-link text-decoration-none p-0 fw-bold small"
            style={{ color: "#5b67f1" }}
            onClick={handleResendCode}
          >
            Resend Code
          </button>
        )}
      </div>
    </div>
  );
}

export default function VerificationPage() {
  return (
    <>
      <Header />
      <div
        className="form-wrapper bg-light d-flex align-items-center justify-content-center"
        style={{ minHeight: "calc(100vh - 90px)", paddingTop: "100px", paddingBottom: "100px" }}
      >
        <div className="container d-flex justify-content-center align-items-center">
          <Suspense fallback={<div>Loading verification...</div>}>
            <VerificationForm />
          </Suspense>
        </div>
      </div>
      <Footer />
    </>
  );
}
