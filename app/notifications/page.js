"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { authService } from "../services/authService";

const defaultNotifications = [
  {
    id: "notif-1",
    title: "Upcoming Event: DJ Night Fever",
    description: "Don’t forget! The event starts on Nov 18, 2025 at 10:00 PM at The Rooftop, Pune.",
    time: "2 days left",
    icon: "fa-calendar",
    bgClass: "bg-primary"
  },
  {
    id: "notif-2",
    title: "Event Cancelled: Anniversary Celebration",
    description: "The event planned for Oct 10, 2025 at Hyatt Regency, Bangalore has been cancelled.",
    time: "3 hours ago",
    icon: "fa-times",
    bgClass: "bg-danger"
  },
  {
    id: "notif-3",
    title: "Event Approved: New Year Party",
    description: "Your event has been approved and published successfully.",
    time: "Today at 9:30 AM",
    icon: "fa-check",
    bgClass: "bg-success"
  },
  {
    id: "notif-4",
    title: "Event Rejected: Music Fest 2025",
    description: "Please review your submission and resubmit with corrected details.",
    time: "Yesterday",
    icon: "fa-exclamation-circle",
    bgClass: "bg-warning text-dark"
  },
  {
    id: "notif-5",
    title: "Reminder: Update Your Event Banner",
    description: "Your event \"Wedding Ceremony\" still has a placeholder image. Please upload a banner.",
    time: "30 minutes ago",
    icon: "fa-bell",
    bgClass: "bg-info"
  }
];

export default function NotificationsPage() {
  const [profile, setProfile] = useState(null);
  const [notifications, setNotifications] = useState([]);

  // Load profile and notifications
  useEffect(() => {
    // Profile load
    const loadProfile = async () => {
      try {
        const profRes = await authService.getUserProfile();
        if (profRes && profRes.status && profRes.user) {
          setProfile(profRes.user);
        } else {
          const localUser = authService.getUser();
          if (localUser) setProfile(localUser);
        }
      } catch (err) {
        console.error("Profile load failed:", err);
      }
    };
    loadProfile();

    setNotifications(defaultNotifications);
  }, []);

  return (
    <>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css" rel="stylesheet" />
      <Header />
      <div className="wrapper">
        <div className="hero-banner pb-5 pt-5">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-xl-8 col-lg-8 col-md-10">
                <div className="hero-banner-content text-center">
                  <h2>Notifications</h2>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="event-dt-block p-80">
          <div className="container">
            <div className="row">
              {/* Profile Sidebar */}
              <div className="col-lg-3">
                <div className="user-profile-sidebar">
                  <div className="user-profile-sidebar-top">
                    <div className="user-profile-img" style={{ overflow: "hidden" }}>
                      <img
                        alt="Profile avatar"
                        src={profile?.profilePic || "images/05.jpg"}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                    <h5>{profile?.fullName || "User Profile"}</h5>
                  </div>
                  <ul className="user-profile-sidebar-list">
                    <li>
                      <Link href="/user-profile">
                        <i className="fa fa-user"></i> My Profile
                      </Link>
                    </li>
                    <li>
                      <Link href="/my-events">
                        <i className="fa fa-layer-group"></i> My Events
                      </Link>
                    </li>
                    <li>
                      <Link href="/my-reservations">
                        <i className="fa fa-calendar"></i> My Reservations
                      </Link>
                    </li>
                    <li>
                      <Link className="active" href="/notifications" style={{ color: "#fff" }}>
                        <i className="fa fa-bell" style={{ color: "#fff" }}></i> Notifications
                      </Link>
                    </li>
                    <li>
                      <Link href="#">
                        <i className="fa fa-gear"></i> Settings
                      </Link>
                    </li>
                    <li>
                      <Link href="/login">
                        <i className="fa fa-sign-out"></i> Logout
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Main Content Feed */}
              <div className="col-lg-9">
                <div className="user-profile-wrapper">
                  <div className="row">
                    <div className="col-lg-12">
                      <div className="user-profile-card">
                        <h4 className="user-profile-card-title">Notifications</h4>
                        <div className="user-profile-form">
                          <div className="row g-4">
                            {notifications.length > 0 ? (
                              notifications.map((notif) => (
                                <div key={notif.id} className="notification-item">
                                  <div className={`notification-icon ${notif.bgClass}`}>
                                    <i className={`fa ${notif.icon}`}></i>
                                  </div>
                                  <div className="flex-grow-1">
                                    <h6 className="mb-1">{notif.title}</h6>
                                    <p className="mb-1">{notif.description}</p>
                                    <div className="notification-time">{notif.time}</div>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-center py-5">
                                <i className="bi bi-bell-slash fs-1 text-muted"></i>
                                <h5 className="fw-bold mt-2">No notifications yet</h5>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
