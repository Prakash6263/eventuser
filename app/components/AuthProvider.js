"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function AuthProvider({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const publicPaths = ["/login", "/signup", "/reset-password", "/verification"];
    const isPublicPath = publicPaths.includes(pathname);
    const token = typeof window !== "undefined" ? localStorage.getItem("user_token") : null;

    if (!token && !isPublicPath) {
      setAuthorized(false);
      router.push("/login");
    } else if (token && isPublicPath) {
      setAuthorized(false);
      router.push("/my-events");
    } else {
      setAuthorized(true);
    }
  }, [pathname, router, mounted]);

  const publicPaths = ["/login", "/signup", "/reset-password", "/verification"];
  const isPublicPath = publicPaths.includes(pathname);
  const hasToken = typeof window !== "undefined" && mounted ? !!localStorage.getItem("user_token") : false;

  // Render original server children during SSR/hydration to avoid DOM mismatch
  if (!mounted) {
    return children;
  }

  // Prevent flash of protected content or access to public auth pages when logged in
  if ((!authorized && !isPublicPath) || (hasToken && isPublicPath)) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light animate-fade-in" style={{ zIndex: 9999 }}>
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" role="status" style={{ width: "3rem", height: "3rem" }}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <h5 className="fw-bold text-dark m-0">Securing your session...</h5>
          <p className="text-muted small mt-1">Checking credentials and redirecting if required.</p>
        </div>
      </div>
    );
  }

  return children;
}
