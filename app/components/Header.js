"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { authService } from "../services/authService";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [offcanvasOpen, setOffcanvasOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    setIsLoggedIn(authService.isLoggedIn());
    setUserInfo(authService.getUser());
  }, [pathname]);

  const toggleOffcanvas = () => {
    setOffcanvasOpen(!offcanvasOpen);
  };

  const handleLogout = async () => {
    const res = await authService.logout();
    setIsLoggedIn(false);
    setUserInfo(null);
    router.push("/login");
  };

  const handleCreateEventClick = (e) => {
    e.preventDefault();
    if (isLoggedIn) {
      router.push("/create-event");
    } else {
      router.push("/login");
    }
  };

  const isActive = (path) => pathname === path;

  return (
    <header className="header">
      <div className="header-inner">
        <nav className="navbar navbar-expand-lg bg-barren barren-head navbar fixed-top justify-content-sm-start pt-0 pb-0">
          <div className="container">
            <button
              className="navbar-toggler"
              type="button"
              onClick={toggleOffcanvas}
              aria-label="Toggle navigation"
            >
              <span className="navbar-toggler-icon">
                <i className="fa-solid fa-bars"></i>
              </span>
            </button>
            <Link className="navbar-brand order-1 order-lg-0 ml-lg-0 ml-2 me-auto" href="/">
              <div className="res-main-logo">
                <img src="/images/logo.png" alt="Logo" />
              </div>
              <div className="main-logo" id="logo">
                <img src="/images/logo.png" alt="Logo" />
                <img className="logo-inverse" src="/images/logo.png" alt="Logo" />
              </div>
            </Link>
            
            {/* Offcanvas Navbar */}
            <div
              className={`offcanvas offcanvas-start ${offcanvasOpen ? "show" : ""}`}
              tabIndex="-1"
              id="offcanvasNavbar"
              aria-labelledby="offcanvasNavbarLabel"
              style={{ visibility: offcanvasOpen ? "visible" : "hidden" }}
            >
              <div className="offcanvas-header">
                <div className="offcanvas-logo" id="offcanvasNavbarLabel">
                  <img src="/images/logo.png" alt="Logo" />
                </div>
                <button
                  type="button"
                  className="close-btn"
                  onClick={toggleOffcanvas}
                  aria-label="Close"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
              <div className="offcanvas-body">
                <ul className="navbar-nav justify-content-end flex-grow-1 pe_5">
                  <li className="nav-item">
                    <Link
                      className={`nav-link ${isActive("/") ? "active" : ""}`}
                      href="/"
                      onClick={() => setOffcanvasOpen(false)}
                    >
                      Home
                    </Link>
                  </li>
                  <li className="nav-item">
                    <Link
                      className={`nav-link ${isActive("/about") ? "active" : ""}`}
                      href="https://eventuna.com/about"
                      onClick={() => setOffcanvasOpen(false)}
                    >
                      About Us
                    </Link>
                  </li>
                  <li className="nav-item">
                    <Link
                      className={`nav-link ${isActive("/events") ? "active" : ""}`}
                      href="/events"
                      onClick={() => setOffcanvasOpen(false)}
                    >
                      Upcoming
                    </Link>
                  </li>

                  <li className="nav-item">
                    <Link
                      className={`nav-link ${isActive("/contact") ? "active" : ""}`}
                      href="#"
                      onClick={() => setOffcanvasOpen(false)}
                    >
                      Contact Us
                    </Link>
                  </li>
                </ul>
              </div>
              <div className="offcanvas-footer">
                <div className="offcanvas-social">
                  <h5>Follow Us</h5>
                  <ul className="social-links">
                    <li>
                      <a href="#" className="social-link">
                        <i className="fab fa-facebook-square"></i>
                      </a>
                    </li>
                    <li>
                      <a href="#" className="social-link">
                        <i className="fab fa-instagram"></i>
                      </a>
                    </li>
                    <li>
                      <a href="#" className="social-link">
                        <i className="fab fa-twitter"></i>
                      </a>
                    </li>
                    <li>
                      <a href="#" className="social-link">
                        <i className="fab fa-linkedin-in"></i>
                      </a>
                    </li>
                    <li>
                      <a href="#" className="social-link">
                        <i className="fab fa-youtube"></i>
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {offcanvasOpen && (
              <div
                className="offcanvas-backdrop fade show"
                onClick={toggleOffcanvas}
                style={{ zIndex: 1040 }}
              ></div>
            )}

            <div className="right-header order-2">
              <ul className="align-self-stretch d-flex align-items-center m-0">
                <li className="me-2">
                  <a href="/create-event" className="create-btn btn-hover" onClick={handleCreateEventClick}>
                    <i className="fa-solid fa-calendar-days"></i>
                    <span>Create Event</span>
                  </a>
                </li>
                {isLoggedIn ? (
                  <li className="d-flex align-items-center gap-2">
                    <Link href="/user-profile" className="create-btn btn-hover">
                      <i className="fa-solid fa-user me-1"></i>
                      <span>Profile</span>
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="btn btn-outline-danger btn-sm rounded-pill px-3 py-2 fw-semibold"
                      style={{ height: "40px" }}
                      title="Logout"
                    >
                      <i className="fa-solid fa-right-from-bracket"></i>
                    </button>
                  </li>
                ) : (
                  <li>
                    <Link href="/login" className="create-btn btn-hover">
                      <i className="fa-solid fa-user"></i>
                      <span>Login</span>
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </nav>
        <div className={`overlay ${offcanvasOpen ? "active" : ""}`} onClick={toggleOffcanvas}></div>
      </div>
    </header>
  );
}
