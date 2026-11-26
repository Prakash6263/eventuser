"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import Header from "../components/Header";
import Footer from "../components/Footer";
import SafeImage from "../components/SafeImage";
import { authService } from "../services/authService";
import { getUserNotificationsApi } from "../services/notificationApi";
import { rateEventApi, getEventRatingsApi } from "../services/eventApi";

export default function NotificationsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("new"); // "new", "task", "completed"

  // Raw notification groups directly from backend API
  const [notificationGroups, setNotificationGroups] = useState({
    newEvent: [],
    completeEvent: [],
    reservationUpdate: [],
    other: [],
  });

  // Rating modal states
  const [selectedRateEvent, setSelectedRateEvent] = useState(null);
  const [ratings, setRatings] = useState({ service: 5, cleanness: 5, hospitality: 5, price: 5 });
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

  // Helper: get locally stored rated event IDs
  const getLocalRatedIds = () => {
    try {
      return JSON.parse(localStorage.getItem("ratedEventIds") || "[]");
    } catch { return []; }
  };

  // Helper: save a rated event ID to localStorage
  const saveLocalRatedId = (eventId) => {
    try {
      const existing = getLocalRatedIds();
      if (!existing.includes(String(eventId))) {
        existing.push(String(eventId));
        localStorage.setItem("ratedEventIds", JSON.stringify(existing));
      }
    } catch {}
  };

  // Load profile and notifications
  useEffect(() => {
    const loadData = async () => {
      let currentUserId = "";
      try {
        const profRes = await authService.getUserProfile();
        if (profRes && profRes.status && profRes.user) {
          setProfile(profRes.user);
          currentUserId = String(profRes.user.userId || profRes.user._id || profRes.user.id || "");
        } else {
          const localUser = authService.getUser();
          if (localUser) {
            setProfile(localUser);
            currentUserId = String(localUser.userId || localUser._id || localUser.id || "");
          }
        }
      } catch (err) {
        console.error("Profile load failed:", err);
      }

      try {
        setLoading(true);
        const res = await getUserNotificationsApi();
        if (res && res.status && res.notifications) {
          const raw = res.notifications;
          let completeList = Array.isArray(raw.completeEvent) ? raw.completeEvent : [];

          // Verify actual rating status from /event/ratings so rated events never allow duplicate reviews
          // Also check localStorage backup for rated event IDs (persists across refreshes)
          const localRatedIds = getLocalRatedIds();
          if (completeList.length > 0) {
            completeList = await Promise.all(
              completeList.map(async (item) => {
                // Check localStorage first (fast, no network)
                if (item.isRated || !item.eventId) return item;
                if (localRatedIds.includes(String(item.eventId))) {
                  return { ...item, isRated: true };
                }
                if (!currentUserId) return item;
                try {
                  const rRes = await getEventRatingsApi(item.eventId);
                  const rList = Array.isArray(rRes?.data) ? rRes.data : [];
                  const alreadyRated = rList.some((r) => {
                    // Handle both: populated object {_id, fullName} and plain ID string
                    const rUserId = String(
                      r.userId?._id || r.userId?._id?.toString?.() || r.userId || ""
                    );
                    return rUserId === currentUserId;
                  });
                  if (alreadyRated) {
                    saveLocalRatedId(item.eventId); // persist locally
                    return { ...item, isRated: true };
                  }
                  return item;
                } catch {
                  return item;
                }
              })
            );
          }

          setNotificationGroups({
            newEvent: Array.isArray(raw.newEvent) ? raw.newEvent : [],
            completeEvent: completeList,
            reservationUpdate: Array.isArray(raw.reservationUpdate) ? raw.reservationUpdate : [],
            other: Array.isArray(raw.other) ? raw.other : [],
          });
        } else {
          setNotificationGroups({
            newEvent: [],
            completeEvent: [],
            reservationUpdate: [],
            other: [],
          });
        }
      } catch (err) {
        console.error("Failed to fetch notifications:", err);
        setNotificationGroups({
          newEvent: [],
          completeEvent: [],
          reservationUpdate: [],
          other: [],
        });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // 1. Group: Reservation Updates (from reservationUpdate array + any newEvent with reservationType === "1")
  const reservationEventIds = new Set();
  const newReservations = [
    ...(notificationGroups.reservationUpdate || []),
    ...(notificationGroups.newEvent || []).filter((n) => String(n.reservationType) === "1"),
  ].filter((item) => {
    const id = item.eventId ? String(item.eventId) : item.notificationId;
    if (!id || reservationEventIds.has(id)) return false;
    reservationEventIds.add(id);
    return true;
  });

  // 2. Group: Other New Invitations (upcoming events in newEvent that are not already under reservation updates)
  const newOthers = (notificationGroups.newEvent || []).filter(
    (n) => String(n.reservationType) !== "1" && !reservationEventIds.has(String(n.eventId))
  );

  // 3. Group: Tasks (items requiring user attention, where tasks !== "You're Invited!")
  const allUpcoming = [...(notificationGroups.newEvent || []), ...(notificationGroups.reservationUpdate || [])];
  const seenTaskIds = new Set();
  const taskNotifications = allUpcoming.filter((n) => {
    if (!n.tasks || n.tasks.toLowerCase() === "you're invited!") return false;
    const id = n.eventId ? String(n.eventId) : n.notificationId;
    if (seenTaskIds.has(id)) return false;
    seenTaskIds.add(id);
    return true;
  });

  // 4. Group: Completed Events (directly from backend completeEvent list)
  const completedNotifications = notificationGroups.completeEvent || [];

  const handleRatingClick = (notif) => {
    setSelectedRateEvent(notif);
    setRatings({ service: 5, cleanness: 5, hospitality: 5, price: 5 });
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
        comment: comment || "Great experience",
        rating: avg,
        eventId: selectedRateEvent.eventId,
      };

      const res = await rateEventApi(payload);
      if (res && res.status) {
        // Persist rated event ID to localStorage so it survives page refresh
        saveLocalRatedId(selectedRateEvent.eventId);

        Swal.fire({
          title: "Thank You!",
          text: res.message || "Event rated successfully",
          icon: "success",
          confirmButtonColor: "#3e56f0",
        });

        // Mark as rated locally in state
        setNotificationGroups((prev) => ({
          ...prev,
          completeEvent: prev.completeEvent.map((item) =>
            item.eventId === selectedRateEvent.eventId ? { ...item, isRated: true } : item
          ),
        }));

        setSelectedRateEvent(null);
      } else {
        if (res?.message && res.message.toLowerCase().includes("already")) {
          // Backend says already rated — persist locally too
          saveLocalRatedId(selectedRateEvent.eventId);
          setNotificationGroups((prev) => ({
            ...prev,
            completeEvent: prev.completeEvent.map((item) =>
              item.eventId === selectedRateEvent.eventId ? { ...item, isRated: true } : item
            ),
          }));
          setSelectedRateEvent(null);
        }
        Swal.fire({
          title: "Notice",
          text: res?.message || "Failed to submit rating. Please try again.",
          icon: res?.message?.toLowerCase().includes("already") ? "info" : "error",
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
          padding: 9px 22px;
          border-radius: 30px;
          border: none;
          background: #f1f5f9;
          color: #64748b;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          gap: 6px;
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
          grid-template-columns: 2.2fr 2fr 1fr;
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          color: #64748b;
          padding: 11px 18px;
          font-weight: 700;
          border-radius: 10px;
          font-size: 11.5px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          align-items: center;
        }
        .notif-header-row-2col {
          display: grid;
          grid-template-columns: 1.3fr 1fr;
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          color: #64748b;
          padding: 11px 18px;
          font-weight: 700;
          border-radius: 10px;
          font-size: 11.5px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          align-items: center;
        }
        .notif-header-row-completed {
          display: grid;
          grid-template-columns: 2.4fr 1.6fr 1.2fr;
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          color: #64748b;
          padding: 11px 18px;
          font-weight: 700;
          border-radius: 10px;
          font-size: 11.5px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          align-items: center;
        }
        .notif-row-link {
          display: grid;
          grid-template-columns: 2.2fr 2fr 1fr;
          background-color: #ffffff;
          border: 1px solid #edf2f7;
          border-radius: 10px;
          transition: all 0.2s ease;
          text-decoration: none !important;
          color: #1e293b !important;
          align-items: center;
        }
        .notif-row-link:hover {
          background-color: #f8fafc;
          border-color: #cbd5e1;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(62, 86, 240, 0.05);
        }
        .notif-row-link-2col {
          display: grid;
          grid-template-columns: 1.3fr 1fr;
          background-color: #ffffff;
          border: 1px solid #edf2f7;
          border-radius: 10px;
          transition: all 0.2s ease;
          text-decoration: none !important;
          color: #1e293b !important;
          align-items: center;
        }
        .notif-row-link-2col:hover {
          background-color: #f8fafc;
          border-color: #cbd5e1;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(62, 86, 240, 0.05);
        }
        .notif-row-completed {
          display: grid;
          grid-template-columns: 2.4fr 1.6fr 1.2fr;
          background-color: #ffffff;
          border: 1px solid #edf2f7;
          border-radius: 10px;
          transition: all 0.2s ease;
          color: #1e293b !important;
          align-items: center;
        }
        .notif-row-completed:hover {
          background-color: #f8fafc;
          border-color: #cbd5e1;
          box-shadow: 0 4px 12px rgba(62, 86, 240, 0.05);
        }
        .notif-cell {
          padding: 14px 18px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13.5px;
          color: #475569;
          min-width: 0;
          word-break: break-word;
        }
        .notif-cell-bold {
          padding: 14px 18px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 2px;
          font-size: 14px;
          color: #0f172a;
          font-weight: 600;
          min-width: 0;
          word-break: break-word;
        }
        @media (max-width: 767.98px) {
          .notif-header-row,
          .notif-header-row-2col,
          .notif-header-row-completed {
            display: none;
          }
          .notif-row-link,
          .notif-row-link-2col,
          .notif-row-completed {
            grid-template-columns: 1fr;
            padding: 12px 14px;
            gap: 8px;
          }
          .notif-cell,
          .notif-cell-bold {
            padding: 2px 0;
            justify-content: flex-start !important;
          }
        }
      `}</style>

      <Header />
      <div className="wrapper flex-grow-1" style={{ background: "#f8f9fa", flex: "1 0 auto" }}>
        <div className="hero-banner pb-5 pt-5">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-xl-8 col-lg-8 col-md-10">
                <div className="hero-banner-content text-center">
                  <h2>Notifications</h2>
                  <p className="text-white-50 small mb-0">Stay updated on your invitations, reservations, and tasks</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="event-dt-block p-80" style={{ paddingTop: "50px", paddingBottom: "70px" }}>
          <div className="container">
            <div className="row">

              {/* Left Profile Sidebar (Desktop only) */}
              <div className="col-lg-3 col-md-4 mb-4 mb-lg-0 d-none d-lg-block">
                <div className="user-profile-sidebar shadow-sm">
                  <div className="user-profile-sidebar-top text-center">
                    <div
                      className="user-profile-img"
                      style={{
                        width: "90px",
                        height: "90px",
                        borderRadius: "50%",
                        overflow: "hidden",
                        margin: "0 auto 12px",
                        border: "3px solid #3e56f0",
                        boxShadow: "0 4px 12px rgba(62, 86, 240, 0.15)",
                        position: "relative",
                      }}
                    >
                      <SafeImage
                        alt="Profile avatar"
                        src={profile?.profilePic || "/images/05.jpg"}
                        variant="profile"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                    <h5 className="fw-bold mb-1">{profile?.fullName || "User Profile"}</h5>
                    <span className="badge bg-success-subtle text-success rounded-pill px-2.5 py-1 small fw-semibold">
                      <i className="fa-solid fa-circle-check me-1"></i> Verified User
                    </span>
                  </div>

                  <ul className="user-profile-sidebar-list">
                    <li>
                      <Link href="/my-events">
                        <i className="fa fa-layer-group"></i> My Events
                      </Link>
                    </li>
                    <li>
                      <Link href="/user-profile">
                        <i className="fa fa-user"></i> Profile
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
                      <Link href="/change-password">
                        <i className="fa fa-key"></i> Change Password
                      </Link>
                    </li>
                    <li>
                      <Link href="/login" onClick={() => authService.logout && authService.logout()}>
                        <i className="fa fa-sign-out"></i> Logout
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Main Content Feed */}
              <div className="col-lg-9 col-md-8">
                <div className="user-profile-wrapper">
                  <div className="user-profile-card shadow-sm border rounded-4 bg-white p-4">
                    <div className="d-flex align-items-center justify-content-between mb-4 border-bottom pb-3 flex-wrap gap-3">
                      <div>
                        <h4 className="fw-bold text-dark mb-1">Notifications Hub</h4>
                        <span className="text-muted small">Manage your invitations, bookings, and pending actions</span>
                      </div>

                      {/* Filter Tabs */}
                      <div className="d-flex gap-2">
                        <button
                          type="button"
                          className={`notif-tab-btn ${activeTab === "new" ? "active" : ""}`}
                          onClick={() => setActiveTab("new")}
                        >
                          <span>New</span>
                          {(newReservations.length + newOthers.length) > 0 && (
                            <span className="badge bg-white text-primary rounded-pill px-2 py-0.5 small">
                              {newReservations.length + newOthers.length}
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          className={`notif-tab-btn ${activeTab === "task" ? "active" : ""}`}
                          onClick={() => setActiveTab("task")}
                        >
                          <span>Tasks</span>
                          {taskNotifications.length > 0 && (
                            <span className="badge bg-white text-primary rounded-pill px-2 py-0.5 small">
                              {taskNotifications.length}
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          className={`notif-tab-btn ${activeTab === "completed" ? "active" : ""}`}
                          onClick={() => setActiveTab("completed")}
                        >
                          <span>Completed</span>
                          {completedNotifications.length > 0 && (
                            <span className="badge bg-white text-primary rounded-pill px-2 py-0.5 small">
                              {completedNotifications.length}
                            </span>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="user-profile-form">
                      {loading ? (
                        <div className="text-center py-5">
                          <div className="spinner-border text-primary" role="status">
                            <span className="visually-hidden">Loading...</span>
                          </div>
                          <h6 className="mt-3 fw-bold text-muted">Fetching notifications...</h6>
                        </div>
                      ) : (
                        <div className="row g-3">

                          {/* ── 1. NEW TAB ── */}
                          {activeTab === "new" && (
                            <div className="col-12 animate__animated animate__fadeIn">
                              {newReservations.length === 0 && newOthers.length === 0 ? (
                                <div className="text-center py-5 bg-light rounded-4">
                                  <i className="bi bi-bell-slash fs-1 text-muted"></i>
                                  <h6 className="fw-bold mt-2 text-dark">No new notifications</h6>
                                  <p className="text-muted small mb-0">You are all caught up on new event invitations and reservation requests.</p>
                                </div>
                              ) : (
                                <>
                                  {/* Reservation Request Update Section */}
                                  {newReservations.length > 0 && (
                                    <div className="mb-4">
                                      <div className="d-flex align-items-center gap-2 mb-3">
                                        <span className="badge bg-warning-subtle text-warning-emphasis px-3 py-1 rounded-pill small fw-bold">
                                          <i className="fa-solid fa-clock me-1"></i> Booking Updates
                                        </span>
                                        <h5 className="fw-bold text-dark mb-0" style={{ fontSize: "16px" }}>Reservation Request Updates</h5>
                                      </div>

                                      <div className="notif-list">
                                        <div className="notif-header-row">
                                          <div>Event Name</div>
                                          <div>Event Date & Time</div>
                                          <div className="text-end">Seats</div>
                                        </div>
                                        {newReservations.map((notif, idx) => (
                                          <Link
                                            key={notif.notificationId || notif.eventId || idx}
                                            href={`/event-details?id=${notif.eventId}`}
                                            className="notif-row-link"
                                          >
                                            <div className="notif-cell-bold">
                                              <span>{notif.eventName || "Event Reservation"}</span>
                                              <small className="text-primary fw-medium" style={{ fontSize: "11.5px" }}>
                                                {notif.tasks || "Reservation Update"}
                                              </small>
                                            </div>
                                            <div className="notif-cell">
                                              <i className="fa-regular fa-calendar text-muted"></i>
                                              <span>{notif.eventDate} {notif.eventTime ? `• ${notif.eventTime}` : ""}</span>
                                            </div>
                                            <div className="notif-cell justify-content-end">
                                              <span className="badge bg-light text-dark border rounded-pill px-3 py-1">
                                                {notif.noSeats || "1"} Seats
                                              </span>
                                            </div>
                                          </Link>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Other Invitations Section */}
                                  {newOthers.length > 0 && (
                                    <div>
                                      <div className="d-flex align-items-center gap-2 mb-3">
                                        <span className="badge bg-primary-subtle text-primary px-3 py-1 rounded-pill small fw-bold">
                                          <i className="fa-solid fa-envelope me-1"></i> Invitations
                                        </span>
                                        <h5 className="fw-bold text-dark mb-0" style={{ fontSize: "16px" }}>Event Invitations</h5>
                                      </div>

                                      <div className="notif-list">
                                        <div className="notif-header-row">
                                          <div>Event Name</div>
                                          <div>Event Date & Time</div>
                                          <div className="text-end">Guests</div>
                                        </div>
                                        {newOthers.map((notif, idx) => (
                                          <Link
                                            key={notif.notificationId || notif.eventId || idx}
                                            href={`/event-details?id=${notif.eventId}`}
                                            className="notif-row-link"
                                          >
                                            <div className="notif-cell-bold">
                                              <span>{notif.eventName || "Event Invitation"}</span>
                                              <small className="text-success fw-medium" style={{ fontSize: "11.5px" }}>
                                                You&apos;re Invited!
                                              </small>
                                            </div>
                                            <div className="notif-cell">
                                              <i className="fa-regular fa-calendar text-muted"></i>
                                              <span>{notif.eventDate} {notif.eventTime ? `• ${notif.eventTime}` : ""}</span>
                                            </div>
                                            <div className="notif-cell justify-content-end">
                                              <span className="badge bg-light text-dark border rounded-pill px-3 py-1">
                                                {notif.noSeats || "1"} Guests
                                              </span>
                                            </div>
                                          </Link>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}

                          {/* ── 2. TASK TAB ── */}
                          {activeTab === "task" && (
                            <div className="col-12 animate__animated animate__fadeIn">
                              <div className="mb-3">
                                <h5 className="fw-bold text-dark mb-1" style={{ fontSize: "16px" }}>
                                  Tasks you need to complete
                                </h5>
                                <span className="text-muted small">Pending actions and RSVP updates</span>
                              </div>
                              <div className="notif-list">
                                <div className="notif-header-row-2col">
                                  <div>Event Name & Date</div>
                                  <div>Action Required</div>
                                </div>
                                {taskNotifications.length > 0 ? (
                                  taskNotifications.map((notif, idx) => (
                                    <Link
                                      key={notif.notificationId || notif.eventId || idx}
                                      href={`/event-details?id=${notif.eventId}`}
                                      className="notif-row-link-2col"
                                    >
                                      <div className="notif-cell-bold">
                                        <div>{notif.eventName}</div>
                                        <small className="text-muted fw-normal d-inline-flex align-items-center" style={{ gap: "6px", fontSize: "12px" }}>
                                          <i className="fa-regular fa-calendar"></i>
                                          <span>{notif.eventDate}</span>
                                        </small>
                                      </div>
                                      <div className="notif-cell text-dark fw-medium">
                                        <span className="badge bg-warning-subtle text-warning-emphasis rounded-pill px-2 py-1 small">
                                          Task
                                        </span>
                                        <span>{notif.tasks}</span>
                                      </div>
                                    </Link>
                                  ))
                                ) : (
                                  <div className="text-center py-5 bg-light rounded-4 text-muted small">
                                    <i className="fa-regular fa-circle-check fs-2 text-success d-block mb-2"></i>
                                    <h6 className="fw-bold text-dark mb-1">No Pending Tasks</h6>
                                    <span>All your event tasks and RSVP requirements are complete.</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* ── 3. COMPLETED TAB ── */}
                          {activeTab === "completed" && (
                            <div className="col-12 animate__animated animate__fadeIn">
                              <div className="mb-3">
                                <h5 className="fw-bold text-dark mb-1" style={{ fontSize: "16px" }}>
                                  Completed Events Rating & Feedback
                                </h5>
                                <span className="text-muted small">Help organizers improve by rating past events</span>
                              </div>

                              <div className="notif-list">
                                <div className="notif-header-row-completed">
                                  <div>Event Name</div>
                                  <div>Event Date</div>
                                  <div className="text-end">Rating Action</div>
                                </div>
                                {completedNotifications.length > 0 ? (
                                  completedNotifications.map((notif, idx) => (
                                    <div
                                      key={notif.notificationId || notif.eventId || idx}
                                      className="notif-row-completed"
                                    >
                                      <div className="notif-cell-bold">
                                        <span>{notif.eventName || "Completed Event"}</span>
                                        <small className="text-muted fw-normal" style={{ fontSize: "12px" }}>
                                          {notif.tasks || "Event Completed"}
                                        </small>
                                      </div>
                                      <div className="notif-cell">
                                        <i className="fa-regular fa-calendar text-muted"></i>
                                        <span>{notif.eventDate || "Date TBD"}</span>
                                      </div>
                                      <div className="notif-cell justify-content-end">
                                        {notif.isRated ? (
                                          <span
                                            className="badge bg-success-subtle text-success rounded-pill px-3 py-2 fw-semibold d-inline-flex align-items-center"
                                            style={{ gap: "6px", fontSize: "12px" }}
                                          >
                                            <i className="fa-solid fa-star text-warning"></i>
                                            <span>Rated</span>
                                          </span>
                                        ) : (
                                          <button
                                            type="button"
                                            className="btn btn-sm btn-primary rounded-pill px-3 py-1 fw-semibold d-inline-flex align-items-center"
                                            onClick={() => handleRatingClick(notif)}
                                            style={{ background: "#3e56f0", border: "none", gap: "6px" }}
                                          >
                                            <i className="fa-regular fa-star"></i>
                                            <span>Rate Event</span>
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-center py-5 bg-light rounded-4 text-muted small">
                                    <i className="fa-solid fa-clipboard-check fs-2 text-primary d-block mb-2"></i>
                                    <h6 className="fw-bold text-dark mb-1">No Completed Events</h6>
                                    <span>You do not have any past events awaiting ratings at this time.</span>
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

      {/* ── Rate Event Modal ── */}
      {selectedRateEvent && (
        <div className="modal fade show d-block" style={{ background: "rgba(5, 2, 62, 0.55)", zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered px-3" style={{ maxWidth: "480px" }}>
            <div className="modal-content border-0 rounded-4 overflow-hidden shadow-lg bg-white">
              <div className="modal-header border-bottom py-3 px-4 d-flex justify-content-between align-items-center">
                <h5 className="modal-title fw-bold text-dark d-flex align-items-center mb-0" style={{ fontSize: "17px" }}>
                  <button
                    type="button"
                    className="btn btn-link text-dark p-0 me-2 border-0"
                    onClick={() => setSelectedRateEvent(null)}
                  >
                    <i className="bi bi-arrow-left fs-4"></i>
                  </button>
                  Rate this Event
                </h5>
                <button type="button" className="btn-close" onClick={() => setSelectedRateEvent(null)}></button>
              </div>

              <div className="modal-body p-4">
                {/* Event Details Summary */}
                <div className="mb-4 bg-light p-3 rounded-3 border">
                  <div className="row g-2">
                    <div className="col-4 text-primary fw-bold small">Event Title:</div>
                    <div className="col-8 text-dark fw-bold small text-truncate">{selectedRateEvent.eventName}</div>

                    <div className="col-4 text-primary fw-bold small">Event Date:</div>
                    <div className="col-8 text-dark fw-semibold small">{selectedRateEvent.eventDate}</div>

                    <div className="col-4 text-primary fw-bold small">Status:</div>
                    <div className="col-8 text-dark small">{selectedRateEvent.tasks || "Completed Event"}</div>
                  </div>
                </div>

                {/* Star Ratings */}
                <div className="mb-4">
                  {[
                    { key: "service", label: "Service & Staff" },
                    { key: "cleanness", label: "Atmosphere & Cleanliness" },
                    { key: "hospitality", label: "Hospitality" },
                    { key: "price", label: "Value for Money" },
                  ].map(({ key, label }) => (
                    <div className="d-flex align-items-center justify-content-between mb-3" key={key}>
                      <span className="fw-semibold text-dark small">{label}</span>
                      <div className="d-flex gap-1" style={{ fontSize: "20px", cursor: "pointer" }}>
                        {[1, 2, 3, 4, 5].map((val) => (
                          <span key={val} onClick={() => handleStarClick(key, val)}>
                            <i
                              className={`bi ${ratings[key] >= val ? "bi-star-fill text-warning" : "bi-star text-secondary"}`}
                            ></i>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Suggestions / Comments */}
                <div className="mb-4">
                  <label className="form-label text-dark small fw-semibold mb-1">
                    Feedback or suggestions for the organizer (optional)
                  </label>
                  <textarea
                    className="form-control"
                    rows={3}
                    style={{ borderRadius: "10px", padding: "10px 12px", resize: "none", fontSize: "13px" }}
                    placeholder="Tell us what you liked and what could be improved..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                </div>

                {/* Submit button */}
                <div className="d-grid">
                  <button
                    type="button"
                    className="btn btn-primary fw-bold py-2.5 rounded-pill border-0 text-white shadow-sm d-flex align-items-center justify-content-center gap-2"
                    style={{ background: "#3e56f0" }}
                    onClick={handleRateSubmit}
                    disabled={rateSubmitting}
                  >
                    {rateSubmitting ? (
                      <>
                        <div className="spinner-border spinner-border-sm text-white" role="status"></div>
                        Submitting Rating...
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-paper-plane"></i> Submit Rating
                      </>
                    )}
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
