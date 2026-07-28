"use client";

import { useEffect, useState } from "react";
import { CirclesWithBar } from "react-loader-spinner";

export default function Preloader() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Hide preloader once component hydrates and page loads
    const timer = setTimeout(() => {
      setLoading(false);
    }, 700);
    return () => clearTimeout(timer);
  }, []);

  if (!loading) return null;

  return (
    <div
      className="preloader-overlay"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "#ffffff",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 999999,
      }}
    >
      <div className="text-center">
        <CirclesWithBar
          height="100"
          width="100"
          color="#3e56f0"
          outerCircleColor="#3e56f0"
          innerCircleColor="#3e56f0"
          barColor="#3e56f0"
          ariaLabel="circles-with-bar-loading"
          visible={true}
        />
        <h5 className="mt-3 fw-bold text-muted" style={{ fontSize: "16px", letterSpacing: "1px" }}>
          Loading Eventuna...
        </h5>
      </div>
    </div>
  );
}
