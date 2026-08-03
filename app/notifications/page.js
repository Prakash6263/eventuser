"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { authService } from "../services/authService";
import { getUserNotificationsApi } from "../services/notificationApi";
import { rateEventApi } from "../services/eventApi";

export default function NotificationsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("new"); // "new", "task", "completed"

  // Rating modal states
  const [selectedRateEvent, setSelectedRateEvent] = useState(null);
  const [ratings, setRatings] = useState({ service: 1, cleanness: 1, hospitality: 1, price: 1 });
  const [comment, setComment] = useState("");
  const [rateSubmitting, setRateSubmitting] = useState(false);

  // Helper to parse "dd-mm-yyyy" to Date object safely
  const parseEventDate = (dateStr) => {
    if (!dateStr) return new Date();
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      }
      return new Date(dateStr);
    } catch (e) {
      return new Date();
    }
  };

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

    // Fetch user notifications from API
    const fetchNotifications = async () => {
      try {
        setLoading(true);
        const res = await getUserNotificationsApi();
        if (res && res.status && res.notifications && Array.isArray(res.notifications.newEvent)) {
          setNotifications(res.notifications.newEvent);
        } else {
          setNotifications([]);
        }
      } catch (err) {
        console.error("Failed to fetch notifications:", err);
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    };
    fetchNotifications();
  }, []);

  // Filter notifications for tabs
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // 1. Task Tab: where tasks !== "You're Invited!" and is not empty
  const taskNotifications = notifications.filter(
    (n) => n.tasks && n.tasks.toLowerCase() !== "you're invited!"
  );

  // Helper to check if event date is in the past
  const isPastEvent = (n) => {
    const eventDate = parseEventDate(n.eventDate);
    eventDate.setHours(0, 0, 0, 0);
    return eventDate < now;
  };

  // 2. Completed Tab: past events (that do not fall under Task tab)
  const completedNotifications = notifications.filter(
    (n) => isPastEvent(n) && (!n.tasks || n.tasks.toLowerCase() === "you're invited!")
  );

  // 3. New Tab: upcoming events/invitations (that do not fall under Task tab)
  const newNotifications = notifications.filter(
    (n) => !isPastEvent(n) && (!n.tasks || n.tasks.toLowerCase() === "you're invited!")
  );

  // Categorize New notifications:
  // - Reservation Request Update: reservationType === "1"
  const newReservations = newNotifications.filter((n) => n.reservationType === "1");
  // - Other: reservationType !== "1"
  const newOthers = newNotifications.filter((n) => n.reservationType !== "1");

  const handleRatingClick = (notif) => {
    setSelectedRateEvent(notif);
    setRatings({ service: 1, cleanness: 1, hospitality: 1, price: 1 });
    setComment("");
  };

  const handleStarClick = (category, value) => {
    setRatings((prev) => ({
      ...prev,
      [category]: value,
    }));
  };

  const handleRateSubmit = async () => {
    if (!selectedRateEvent) return;
    setRateSubmitting(true);
    try {
      const avg = Math.round((ratings.service + ratings.cleanness + ratings.hospitality + ratings.price) / 4);
      const payload = {
        comment: comment || "Good",
        rating: avg,
        eventId: selectedRateEvent.eventId
      };
      
      const res = await rateEventApi(payload);
      if (res && res.status) {
        Swal.fire({
          title: "Thank You!",
          text: res.message || "Event rated successfully",
          icon: "success",
          confirmButtonColor: "#3e56f0",
        });
        setSelectedRateEvent(null);
      } else {
        Swal.fire({
          title: "Error",
          text: res?.message || "Failed to submit rating. Please try again.",
          icon: "error",
          confirmButtonColor: "#3e56f0",
        });
      }
    } catch (err) {
      console.error("Rate event error:", err);
      Swal.fire({
        title: "Error",
        text: err.message || "An unexpected error occurred.",
        icon: "error",
        confirmButtonColor: "#3e56f0",
      });
    } finally {
      setRateSubmitting(false);
    }
  };

  return (
    <>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css" rel="stylesheet" />
      <style>{`
        .notif-tab-btn {
          font-size: 14px;
          font-weight: 600;
          padding: 10px 24px;
          border-radius: 30px;
          border: none;
          background: #f1f5f9;
          color: #64748b;
          transition: all 0.2s ease;
        }
        .notif-tab-btn.active {
          background: #3e56f0 !important;
          color: #ffffff !important;
          box-shadow: 0 4px 12px rgba(62, 86, 240, 0.2);
        }
        .notif-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 100%;
        }
        .notif-header-row {
          display: grid;
          grid-template-columns: 2fr 2fr 1fr;
          background-color: #4f46e5;
          color: #ffffff;
          padding: 14px 16px;
          font-weight: 600;
          border-radius: 10px;
          font-size: 14px;
        }
        .notif-header-row-2col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          background-color: #4f46e5;
          color: #ffffff;
          padding: 14px 16px;
          font-weight: 600;
          border-radius: 10px;
          font-size: 14px;
        }
        .notif-row-link {
          display: grid;
          grid-template-columns: 2fr 2fr 1fr;
          background-color: #f8fafc;
          border-radius: 8px;
          transition: all 0.2s ease;
          text-decoration: none !important;
          color: #1e293b !important;
        }
        .notif-row-link:hover {
          background-color: #f1f5f9;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(62, 86, 240, 0.04);
        }
        .notif-row-link-2col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          background-color: #f8fafc;
          border-radius: 8px;
          transition: all 0.2s ease;
          text-decoration: none !important;
          color: #1e293b !important;
          cursor: pointer;
        }
        .notif-row-link-2col:hover {
          background-color: #f1f5f9;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(62, 86, 240, 0.04);
        }
        .notif-cell {
          padding: 14px 16px;
          display: flex;
          align-items: center;
          font-size: 14px;
          color: #1e293b;
          min-width: 0;
          word-break: break-word;
        }
        .notif-cell-bold {
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          font-size: 14px;
          color: #1e293b;
          font-weight: 600;
          min-width: 0;
          word-break: break-word;
        }
      `}</style>
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
                        <div className="d-flex align-items-center justify-content-between mb-4 border-bottom pb-3 flex-wrap gap-3">
                          <h4 className="user-profile-card-title mb-0">Notifications</h4>
                          
                          {/* Tabs list */}
                          <div className="d-flex gap-2">
                            <button
                              className={`notif-tab-btn ${activeTab === "new" ? "active" : ""}`}
                              onClick={() => setActiveTab("new")}
                            >
                              New
                            </button>
                            <button
                              className={`notif-tab-btn ${activeTab === "task" ? "active" : ""}`}
                              onClick={() => setActiveTab("task")}
                            >
                              Task
                            </button>
                            <button
                              className={`notif-tab-btn ${activeTab === "completed" ? "active" : ""}`}
                              onClick={() => setActiveTab("completed")}
                            >
                              Completed
                            </button>
                          </div>
                        </div>

                        <div className="user-profile-form">
                          {loading ? (
                            <div className="text-center py-5">
                              <div className="spinner-border text-primary" role="status">
                                <span className="visually-hidden">Loading...</span>
                              </div>
                              <h5 className="mt-3 fw-bold text-muted">Loading notifications...</h5>
                            </div>
                          ) : (
                            <div className="row g-3">
                              {/* 1. New Tab */}
                              {activeTab === "new" && (
                                <div className="col-12 animate__animated animate__fadeIn">
                                  {newReservations.length === 0 && newOthers.length === 0 ? (
                                    <div className="text-center py-5">
                                      <i className="bi bi-bell-slash fs-1 text-muted"></i>
                                      <h5 className="fw-bold mt-2">No new notifications</h5>
                                      <p className="text-muted small">We'll let you know when you receive new invitations.</p>
                                    </div>
                                  ) : (
                                    <>
                                      {/* Reservation Request Update Section */}
                                      {newReservations.length > 0 && (
                                        <div className="mb-4">
                                          <h5 className="fw-bold text-dark mb-2" style={{ fontSize: "16px" }}>Reservation Request Update</h5>
                                          <div className="notif-list">
                                            <div className="notif-header-row">
                                              <div>Event name</div>
                                              <div>Tasks</div>
                                              <div>No seats</div>
                                            </div>
                                            {newReservations.map((notif, idx) => (
                                              <Link
                                                key={notif.notificationId || idx}
                                                href={`/event-details?id=${notif.eventId}`}
                                                className="notif-row-link"
                                              >
                                                <div className="notif-cell-bold">{notif.eventName}</div>
                                                <div className="notif-cell">{notif.eventDate}</div>
                                                <div className="notif-cell">{notif.noSeats || "-"}</div>
                                              </Link>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {/* Other Section */}
                                      {newOthers.length > 0 && (
                                        <div>
                                          <h5 className="fw-bold text-dark mb-2" style={{ fontSize: "16px" }}>Other</h5>
                                          <div className="notif-list">
                                            <div className="notif-header-row">
                                              <div>Event name</div>
                                              <div>Tasks</div>
                                              <div>No seats</div>
                                            </div>
                                            {newOthers.map((notif, idx) => (
                                              <Link
                                                key={notif.notificationId || idx}
                                                href={`/event-details?id=${notif.eventId}`}
                                                className="notif-row-link"
                                              >
                                                <div className="notif-cell-bold">{notif.eventName}</div>
                                                <div className="notif-cell">{notif.eventDate}</div>
                                                <div className="notif-cell">{notif.noSeats || "-"}</div>
                                              </Link>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}

                              {/* 2. Task Tab */}
                              {activeTab === "task" && (
                                <div className="col-12 animate__animated animate__fadeIn">
                                  <h5 className="fw-bold text-dark mb-2" style={{ fontSize: "16px" }}>Tasks you need to complete</h5>
                                  <div className="notif-list">
                                    <div className="notif-header-row-2col">
                                      <div>Event name</div>
                                      <div>Tasks</div>
                                    </div>
                                    {taskNotifications.length > 0 ? (
                                      taskNotifications.map((notif, idx) => (
                                        <Link
                                          key={notif.notificationId || idx}
                                          href={`/event-details?id=${notif.eventId}`}
                                          className="notif-row-link-2col"
                                        >
                                          <div className="notif-cell-bold">
                                            <div>{notif.eventName}</div>
                                            <div className="small text-muted fw-normal mt-1">{notif.eventDate}</div>
                                          </div>
                                          <div className="notif-cell text-muted">{notif.tasks}</div>
                                        </Link>
                                      ))
                                    ) : (
                                      <div className="text-center py-4 text-muted bg-white border rounded-3 small">
                                        No tasks found.
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* 3. Completed Tab */}
                              {activeTab === "completed" && (
                                <div className="col-12 animate__animated animate__fadeIn">
                                  <h5 className="fw-bold text-dark mb-2" style={{ fontSize: "16px" }}>Complete events Rating Request</h5>
                                  <div className="notif-list">
                                    <div className="notif-header-row-2col">
                                      <div>Event name</div>
                                      <div>Tasks</div>
                                    </div>
                                    {completedNotifications.length > 0 ? (
                                      completedNotifications.map((notif, idx) => (
                                        <div
                                          key={notif.notificationId || idx}
                                          className="notif-row-link-2col"
                                          onClick={() => handleRatingClick(notif)}
                                        >
                                          <div className="notif-cell-bold">{notif.eventName}</div>
                                          <div className="notif-cell">{notif.eventDate}</div>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="text-center py-4 text-muted bg-white border rounded-3 small">
                                        No completed events found.
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
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

      {/* Rate Event Modal */}
      {selectedRateEvent && (
        <div className="modal fade show d-block" style={{ background: "rgba(5, 2, 62, 0.55)", zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered px-3" style={{ maxWidth: "480px" }}>
            <div className="modal-content border-0 rounded-4 overflow-hidden shadow-lg">
              <div className="modal-header border-bottom py-3 px-4 d-flex justify-content-between align-items-center">
                <h5 className="modal-title fw-bold text-dark d-flex align-items-center" style={{ fontSize: "18px" }}>
                  <button type="button" className="btn btn-link text-dark p-0 me-2 border-0" onClick={() => setSelectedRateEvent(null)}>
                    <i className="bi bi-arrow-left fs-4"></i>
                  </button>
                  Please Rate this Event
                </h5>
                <button type="button" className="btn-close" onClick={() => setSelectedRateEvent(null)}></button>
              </div>
              <div className="modal-body p-4">
                {/* Event Details Summary */}
                <div className="mb-4 bg-light p-3 rounded-3">
                  <div className="row g-2">
                    <div className="col-4 text-primary fw-bold" style={{ fontSize: "14px" }}>Event Date:</div>
                    <div className="col-8 text-dark fw-bold" style={{ fontSize: "14px" }}>{selectedRateEvent.eventDate}</div>
                    
                    <div className="col-4 text-primary fw-bold" style={{ fontSize: "14px" }}>Event Title:</div>
                    <div className="col-8 text-dark fw-bold" style={{ fontSize: "14px" }}>{selectedRateEvent.eventName}</div>
                    
                    <div className="col-4 text-primary fw-bold" style={{ fontSize: "14px" }}>Facility:</div>
                    <div className="col-8 text-dark fw-bold" style={{ fontSize: "14px" }}>{selectedRateEvent.tasks || "You're Invited!"}</div>
                  </div>
                </div>

                {/* Star Ratings */}
                <div className="mb-4">
                  {["service", "cleanness", "hospitality", "price"].map((cat) => (
                    <div className="d-flex align-items-center justify-content-between mb-3" key={cat}>
                      <span className="fw-semibold text-dark text-capitalize" style={{ fontSize: "15px" }}>{cat}</span>
                      <div className="d-flex gap-1" style={{ fontSize: "22px", cursor: "pointer" }}>
                        {[1, 2, 3, 4, 5].map((val) => (
                          <span key={val} onClick={() => handleStarClick(cat, val)}>
                            <i className={`bi ${ratings[cat] >= val ? "bi-star-fill text-warning" : "bi-star text-secondary"}`}></i>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Suggestions / Comments */}
                <div className="mb-4">
                  <label className="form-label text-primary small fw-semibold mb-2" style={{ lineHeight: "1.4" }}>
                    Please provide optional suggestion or comments to improve the service
                  </label>
                  <textarea
                    className="form-control"
                    rows="3"
                    style={{ borderRadius: "10px", padding: "12px 14px", resize: "none" }}
                    placeholder="Type Here..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                </div>

                {/* Submit button */}
                <div className="d-grid">
                  <button
                    type="button"
                    className="btn btn-primary fw-bold py-2.5 rounded-pill border-0 text-white"
                    style={{ background: "#4f46e5" }}
                    onClick={handleRateSubmit}
                    disabled={rateSubmitting}
                  >
                    {rateSubmitting ? "Submitting..." : "Submit"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </>
  );
}
