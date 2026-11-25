"use client";

import { useEffect, useState } from "react";
import { CirclesWithBar } from "react-loader-spinner";

export default function Preloader() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Hide preloader once component hydrates and page loads
    const timer = setTimeout(() => {
      setLoading(false);
    }, 600);
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
        right: 0,
        bottom: 0,
        width: "100vw",
        height: "100dvh",
        backgroundColor: "#ffffff",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999999,
        overflow: "hidden",
        margin: 0,
        padding: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
          padding: 0,
        }}
      >
        <CirclesWithBar
          height="72"
          width="72"
          color="#3e56f0"
          outerCircleColor="#3e56f0"
          innerCircleColor="#3e56f0"
          barColor="#3e56f0"
          ariaLabel="circles-with-bar-loading"
          visible={true}
        />
      </div>
    </div>
  );
}
