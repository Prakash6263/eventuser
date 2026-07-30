"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "../components/Header";
import Footer from "../components/Footer";
import SafeImage from "../components/SafeImage";
import { authService } from "../services/authService";
import { getReservationDetailsApi, cancelReservationApi, resendReservationApi, getCancelReasonsApi, makeReservationApi } from "../services/reservationApi";

export default function MyReservationsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [cancelModal, setCancelModal] = useState({ show: false, id: null, reservationId: null, comment: "", reason: "" });
  const [successMessage, setSuccessMessage] = useState("");
  const [modifyModal, setModifyModal] = useState({
    show: false,
    id: null,
    reservationId: null,
    adultCount: "",
    childCount: "",
    instruction: "",
    couponId: "",
    guestType: "Normal",
  });
  const [cancelReasonsList, setCancelReasonsList] = useState([]);
  const [resSubmitting, setResSubmitting] = useState(false);
  const [resError, setResError] = useState("");

  // Load profile and reservations
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

    // Map backend reservation event object to frontend format
    const mapReservationItem = (item) => {
      let formattedDate = item.eventDate || "Date TBD";
      try {
        if (item.eventDate) {
          const parts = item.eventDate.split('-');
          if (parts.length === 3) {
            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const monthStr = monthNames[parseInt(parts[1]) - 1] || parts[1];
            formattedDate = `${parts[0]} ${monthStr} ${parts[2]}`;
          }
        }
      } catch (e) { }

      const resObj = item.makeReservation || {};
      const merchantObj = resObj.merchantId || {};
      const locationObj = resObj.serviceLocationId || item.serviceLocationId || {};

      let venueAddress = "Location TBD";
      if (locationObj.addressName || locationObj.address) {
        venueAddress = locationObj.addressName && locationObj.address
          ? `${locationObj.addressName} - ${locationObj.address}`
          : (locationObj.address || locationObj.addressName);
      }

      const rawStatus = (resObj.status || item.status || "Confirmed").toLowerCase();
      let displayStatus = "Confirmed";
      if (rawStatus === "pending" || rawStatus === "requested" || rawStatus === "waiting") {
        displayStatus = "Pending";
      } else if (rawStatus === "cancelled" || rawStatus === "rejected") {
        displayStatus = "Cancelled";
      } else if (rawStatus === "completed" || rawStatus === "finished") {
        displayStatus = "Completed";
      } else if (rawStatus === "accepted" || rawStatus === "confirmed" || rawStatus === "ongoingevent") {
        displayStatus = "Confirmed";
      }

      const guests = resObj.adultCount ? `${resObj.adultCount.padStart(2, '0')} Guests` : "01 Guest";

      let totalAmount = 0;
      if (Array.isArray(item.serviceBookings) && item.serviceBookings.length > 0) {
        totalAmount = item.serviceBookings.reduce((sum, sb) => sum + (sb.finalAmount || 0), 0);
      }

      return {
        id: item._id,
        reservationId: resObj._id || item._id,
        eventTitle: item.eventTitle || merchantObj.serviceName || "Event Reservation",
        eventDate: formattedDate,
        eventStartTime: item.eventStartTime || "12:00 PM",
        eventEndTime: item.eventEndTime || "04:00 PM",
        venue: venueAddress,
        status: displayStatus,
        rawStatus: resObj.status || item.status,
        guestsCount: guests,
        reservedOn: item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-GB", { day: 'numeric', month: 'short', year: 'numeric' }) : "Recently",
        img: item.image || merchantObj.bannerImage || "",
        eventId: item._id,
        packagePrice: totalAmount || 35,
        tax: 5,
        discount: 5,
        totalPaid: totalAmount || 35,
        tableNumber: resObj.instruction || "Table-Standard",
        organizerName: item.eventcreator?.fullName || merchantObj.serviceName || "Event Host",
        organizerEmail: item.eventcreator?.email || merchantObj.email || "support@eventuna.com",
        organizerPhone: merchantObj.mobile || merchantObj.phone || "+91 810300655",
        attendanceQr: resObj.attendanceQr || null,
        serviceBookings: item.serviceBookings || [],
        contactList: item.contactList || [],
        invitedUsers: item.invitedUsers || [],
        rawItem: item
      };
    };

    // Live Reservations API load
    const fetchReservations = async () => {
      try {
        setLoading(true);
        const res = await getReservationDetailsApi();
        if (res && res.status && Array.isArray(res.data) && res.data.length > 0) {
          const mapped = res.data.map(mapReservationItem);
          setReservations(mapped);
          localStorage.setItem("eventuna-reservations", JSON.stringify(mapped));
        } else {
          setReservations([]);
          localStorage.removeItem("eventuna-reservations");
        }
      } catch (e) {
        console.error("Failed to load live reservations:", e);
        setReservations([]);
        localStorage.removeItem("eventuna-reservations");
      } finally {
        setLoading(false);
      }
    };

    fetchReservations();

    // Load cancel reasons
    const loadCancelReasons = async () => {
      try {
        const res = await getCancelReasonsApi();
        if (res && res.status === true && Array.isArray(res.data)) {
          setCancelReasonsList(res.data);
        }
      } catch (err) {
        console.error("Failed to load cancel reasons:", err);
      }
    };
    loadCancelReasons();
  }, []);

  const handleModifyClick = (res) => {
    setModifyModal({
      show: true,
      id: res.id,
      eventId: res.eventId || res.id,
      reservationId: res.reservationId || res.id,
      adultCount: res.adultCount?.toString() || "",
      childCount: res.childCount?.toString() || "",
      instruction: res.instruction || "",
      couponId: res.couponId || "",
      guestType: res.guestType || "Normal",
    });
  };

  const handleModifyReservation = async (e) => {
    e && e.preventDefault && e.preventDefault();
    setResSubmitting(true);
    try {
      const payload = {
        eventId: modifyModal.eventId,
        reservationId: modifyModal.reservationId,
        adultCount: modifyModal.adultCount,
        childCount: modifyModal.childCount,
        instruction: modifyModal.instruction,
        couponId: modifyModal.couponId,
        guestType: modifyModal.guestType,
      };
      const res = await makeReservationApi(payload);
      if (res && res.status === true) {
        setSuccessMessage("Reservation updated successfully");
        setModifyModal({ show: false, id: null, reservationId: null, adultCount: "", childCount: "", instruction: "", couponId: "", guestType: "Normal" });
        fetchReservations();
      } else {
        throw new Error(res?.message || "Failed to modify reservation.");
      }
    } catch (err) {
      setResError(err.message || "Something went wrong while modifying reservation.");
    } finally {
      setResSubmitting(false);
    }
  };

  const confirmCancel = async () => {
    try {
      const payload = {
        reservationId: cancelModal.reservationId,
        cancelReason: cancelModal.reason,
        comment: cancelModal.comment
      };

      const response = await cancelReservationApi(payload);
      if (response && response.status === true) {
        const updated = reservations.map((r) => {
          if (r.id === cancelModal.id) {
            return { ...r, status: "Cancelled" };
          }
          return r;
        });
        setReservations(updated);
        localStorage.setItem("eventuna-reservations", JSON.stringify(updated));
        setSuccessMessage(`Reservation ID ${cancelModal.id} has been cancelled successfully!`);
        setTimeout(() => setSuccessMessage(""), 5000);
      } else {
        alert(response?.message || "Failed to cancel reservation on server.");
      }
    } catch (err) {
      console.error("Cancel API error:", err);
      alert(err.message || "An error occurred while cancelling the reservation.");
    } finally {
      setCancelModal({ show: false, id: null, reservationId: null, comment: "", reason: "" });
    }
  };

  const handleViewDetails = (res) => {
    localStorage.setItem("eventuna-latest-reservation", JSON.stringify(res));
    router.push(`/reservation-details?id=${res.id}`);
  };

  const handleResend = async (res) => {
    try {
      const payload = {
        reservationId: res.reservationId || res.id
      };
      const response = await resendReservationApi(payload);
      if (response && response.status === true) {
        setSuccessMessage(`Reservation details and QR pass for "${res.eventTitle}" (ID: ${res.id}) have been resent to your registered email!`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => setSuccessMessage(""), 5000);
      } else {
        alert(response?.message || "Failed to resend reservation details.");
      }
    } catch (err) {
      console.error("Resend API error:", err);
      alert(err.message || "An error occurred while resending reservation.");
    }
  };

  // Filter reservations by search
  const filteredReservations = reservations.filter((res) => {
    const searchString = `${res.eventTitle} ${res.id} ${res.venue}`.toLowerCase();
    return searchString.includes(searchQuery.toLowerCase());
  });

  // Calculate dynamic stats
  const upcomingCount = reservations.filter((r) => r.status === "Confirmed").length;
  const completedCount = reservations.filter((r) => r.status === "Completed").length;
  const cancelledCount = reservations.filter((r) => r.status === "Cancelled").length;

  return (
    <>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css" rel="stylesheet" />
      <style>{`
        .res-btn {
          font-size: 14px;
          min-width: 80px;
          font-weight: 500;
          padding: 6px 14px;
          border-radius: 8px;
          border: 1.5px solid #3e56f0;
          color: #3e56f0 !important;
          background: #fff;
          cursor: pointer;
          transition: background 0.18s, color 0.18s;
          white-space: nowrap;
        }
        .res-btn:hover, .res-btn:focus {
          background: #e8eeff !important;
          color: #3e56f0 !important;
          border-color: #3e56f0;
          outline: none;
        }
        .res-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
      <Header />
      <div className="wrapper">
        <div className="hero-banner pb-5 pt-5">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-xl-8 col-lg-8 col-md-10">
                <div className="hero-banner-content text-center">
                  <h2>My Reservation</h2>
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
                      <SafeImage
                        alt="Profile avatar"
                        src={profile?.profilePic || "images/05.jpg"}
                        variant="profile"
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
                      <Link className="active" href="/my-reservations" style={{ color: "#fff" }}>
                        <i className="fa fa-calendar" style={{ color: "#fff" }}></i> My Reservations
                      </Link>
                    </li>
                    <li>
                      <Link href="/notifications">
                        <i className="fa fa-bell"></i> Notifications
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

              {/* Main Content Dashboard */}
              <div className="col-lg-9">
                <div className="user-profile-wrapper">

                  {/* Success Alert Banner */}
                  {successMessage && (
                    <div className="alert alert-success border-0 shadow-sm rounded-3 p-3 mb-4 d-flex align-items-center justify-content-between" role="alert">
                      <div className="d-flex align-items-center gap-2">
                        <i className="bi bi-check-circle-fill text-success fs-5"></i>
                        <span className="small text-dark fw-medium">{successMessage}</span>
                      </div>
                      <button type="button" className="btn-close" onClick={() => setSuccessMessage("")} style={{ position: "relative", top: 0, right: 0 }}></button>
                    </div>
                  )}

                  {/* Dashboard Welcome Header */}
                  <div className="welcome-section">
                    <div>
                      <h2>My Reservation</h2>
                      <p>View and manage all your event reservations in one place.</p>
                    </div>
                  </div>

                  {/* Counters Section */}
                  <div className="row g-3 mb-3">
                    {/* Counter 1: Upcoming */}
                    <div className="col-md-4">
                      <div className="reserve-card">
                        <div className="reserve-icon">
                          <i className="bi bi-calendar-check"></i>
                        </div>
                        <div>
                          <h4>{String(upcomingCount).padStart(2, "0")}</h4>
                          <p>Upcoming Reservations</p>
                        </div>
                      </div>
                    </div>

                    {/* Counter 2: Completed */}
                    <div className="col-md-4">
                      <div className="reserve-card">
                        <div className="reserve-icon">
                          <i className="bi bi-check-circle"></i>
                        </div>
                        <div>
                          <h4>{String(completedCount).padStart(2, "0")}</h4>
                          <p>Completed Reservations</p>
                        </div>
                      </div>
                    </div>

                    {/* Counter 3: Cancelled */}
                    <div className="col-md-4">
                      <div className="reserve-card">
                        <div className="reserve-icon">
                          <i className="bi bi-x-circle"></i>
                        </div>
                        <div>
                          <h4>{String(cancelledCount).padStart(2, "0")}</h4>
                          <p>Cancelled Reservations</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Search Section */}
                  <div className="row mb-3">
                    <div className="col-md-5">
                      <div className="position-relative">
                        <span className="position-absolute top-50 start-0 translate-middle-y ps-3 text-muted">
                          <i className="bi bi-search"></i>
                        </span>
                        <input
                          type="text"
                          className="form-control ps-5 py-2"
                          placeholder="Search by name, phone, or email..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Reservations Cards Feed */}
                  <div className="reservation-tab-content">
                    {filteredReservations.length > 0 ? (
                      filteredReservations.map((res) => (
                        <div key={res.id} className="reservation-card" data-search={`${res.eventTitle.toLowerCase()} ${res.id.toLowerCase()}`}>
                          <div className="reservation-main">
                            <div className="row align-items-center g-3">
                              {/* Event Image */}
                              <div className="col-lg-auto">
                                <div className="event-image1">
                                  <SafeImage
                                    src={res.img}
                                    alt={res.eventTitle}
                                    variant="reservation"
                                    fallbackLabel={res.eventTitle}
                                    fallbackSubLabel="Reservation"
                                  />
                                </div>
                              </div>

                              {/* Event Details */}
                              <div className="col-lg">
                                <div className="event-info">
                                  <div className="mb-2">
                                    <span className={`status-badge ${res.status === "Confirmed" ? "status-confirmed" : res.status === "Completed" ? "status-completed" : "status-cancelled"}`}>
                                      <i className={`bi ${res.status === "Confirmed" ? "bi-check-circle" : res.status === "Completed" ? "bi-check-circle" : "bi-x-circle"} me-1`}></i>
                                      {res.status}
                                    </span>
                                  </div>
                                  <h5>{res.eventTitle}</h5>
                                  <p>
                                    <i className="bi bi-calendar3"></i>
                                    {res.eventDate}
                                  </p>
                                  <p>
                                    <i className="bi bi-clock"></i>
                                    {res.eventStartTime} - {res.eventEndTime}
                                  </p>
                                  <p>
                                    <i className="bi bi-geo-alt"></i>
                                    {res.venue}
                                  </p>
                                </div>
                              </div>

                              {/* Action buttons */}
                              <div className="col-lg-auto">
                                <div className="reservation-actions d-flex gap-2">
                                  <button
                                    className="res-btn"
                                    onClick={() => handleViewDetails(res)}
                                  >
                                    View
                                  </button>
                                  <button
                                    className="res-btn"
                                    onClick={() => handleResend(res)}
                                  >
                                    Resend
                                  </button>
                                  <button
                                    className="res-btn"
                                    onClick={() => handleModifyClick(res)}
                                  >
                                    Modify
                                  </button>
                                  <button
                                    className="res-btn"
                                    onClick={() => handleCancelClick(res)}
                                    disabled={res.status === "Cancelled"}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Reservation Meta & Cancel Button */}
                          <div className="reservation-meta">
                            <div className="meta-item">
                              <span>Reservation ID</span>
                              <strong>{res.id}</strong>
                            </div>
                            <div className="meta-item">
                              <span>Guests</span>
                              <strong>{res.guestsCount}</strong>
                            </div>
                            <div className="meta-item">
                              <span>Reserved On</span>
                              <strong>{res.reservedOn}</strong>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="empty-state d-block">
                        <i className="bi bi-calendar-x"></i>
                        <h5>No reservations found</h5>
                        <p>Try adjusting your search criteria.</p>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog Modal */}
      {cancelModal.show && (
        <div className="modal fade show d-block" style={{ background: "rgba(5, 2, 62, 0.55)", zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered px-3" style={{ maxWidth: "450px" }}>
            <div className="modal-content border-0 rounded-4 overflow-hidden shadow-lg">
              <div className="modal-header border-bottom py-3 px-4 d-flex justify-content-between align-items-center">
                <h5 className="modal-title fw-bold text-dark" style={{ fontSize: "18px" }}>Cancel Reservation?</h5>
                <button type="button" className="btn-close" onClick={() => setCancelModal({ show: false, id: null, reservationId: null, comment: "", reason: "" })}></button>
              </div>
              <div className="modal-body p-4 text-center">
                <div className="rounded-circle bg-danger-subtle text-danger d-inline-flex align-items-center justify-content-center mb-3" style={{ width: "64px", height: "64px", fontSize: "28px" }}>
                  <i className="bi bi-exclamation-triangle"></i>
                </div>
                <p className="text-muted mb-0" style={{ fontSize: "15px", lineHeight: "1.6" }}>
                  Are you sure you want to cancel your reservation for ID <strong>{cancelModal.id}</strong>? This action cannot be undone.
                </p>
                <div className="text-start mt-3">
                  <label className="form-label small fw-semibold text-muted mb-1">Cancel Reason</label>
                  <select
                    className="form-select form-select-sm mb-2"
                    value={cancelModal.reason}
                    onChange={(e) => setCancelModal({ ...cancelModal, reason: e.target.value })}
                  >
                    <option value="">Select a reason</option>
                    {cancelReasonsList.map((r) => (
                      <option key={r._id} value={r._id}>{r.reason}</option>
                    ))}
                  </select>
                  <label className="form-label small fw-semibold text-muted mb-1">Comments</label>
                  <textarea
                    className="form-control form-select-sm"
                    rows="2"
                    value={cancelModal.comment}
                    onChange={(e) => setCancelModal({ ...cancelModal, comment: e.target.value })}
                    placeholder="Add a comment (optional)..."
                  />
                </div>
              </div>
              <div className="modal-footer py-2.5 px-3 border-top bg-light d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-secondary rounded-pill px-4" onClick={() => setCancelModal({ show: false, id: null, reservationId: null, comment: "", reason: "" })}>Keep Reservation</button>
                <button type="button" className="btn btn-danger rounded-pill px-4 fw-bold" onClick={confirmCancel} disabled={!cancelModal.reason}>Yes, Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modify Reservation Modal */}
      {modifyModal.show && (
        <div className="modal fade show d-block" style={{ background: "rgba(5, 2, 62, 0.55)", zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered px-3" style={{ maxWidth: "500px" }}>
            <div className="modal-content border-0 rounded-4 overflow-hidden shadow-lg">
              <div className="modal-header border-bottom py-3 px-4 d-flex justify-content-between align-items-center">
                <h5 className="modal-title fw-bold text-dark" style={{ fontSize: "18px" }}>Modify Reservation</h5>
                <button type="button" className="btn-close" onClick={() => setModifyModal({ show: false, id: null, eventId: null, reservationId: null, adultCount: "", childCount: "", instruction: "", couponId: "", guestType: "Normal" })}></button>
              </div>
              <div className="modal-body p-4">
                <div className="alert alert-danger border-0 bg-transparent text-danger p-0 mb-4 small fw-semibold">
                  Note : You are making reservation for All Guests
                </div>
                <form onSubmit={handleModifyReservation}>
                  <div className="mb-3">
                    <label className="form-label small fw-bold text-dark mb-1">Enter the Number of Adult</label>
                    <input type="number" className="form-control" style={{ borderRadius: "10px", padding: "10px 14px" }} value={modifyModal.adultCount} onChange={(e) => setModifyModal({ ...modifyModal, adultCount: e.target.value })} placeholder="Number" required />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-bold text-dark mb-1">Enter the Number of Kids</label>
                    <input type="number" className="form-control" style={{ borderRadius: "10px", padding: "10px 14px" }} value={modifyModal.childCount} onChange={(e) => setModifyModal({ ...modifyModal, childCount: e.target.value })} placeholder="Number" />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-bold text-dark mb-1">Enter Coupon</label>
                    <input type="text" className="form-control" style={{ borderRadius: "10px", padding: "10px 14px" }} value={modifyModal.couponId} onChange={(e) => setModifyModal({ ...modifyModal, couponId: e.target.value })} placeholder="Ex. ABCDES1234" />
                  </div>
                  <div className="mb-4">
                    <label className="form-label small fw-bold text-dark mb-1">Any instruction or Request</label>
                    <textarea className="form-control" style={{ borderRadius: "10px", padding: "10px 14px" }} rows="3" value={modifyModal.instruction} onChange={(e) => setModifyModal({ ...modifyModal, instruction: e.target.value })} placeholder="Message Details" />
                  </div>
                  <div className="d-grid">
                    <button type="submit" className="btn btn-primary fw-bold py-2.5" style={{ borderRadius: "10px", background: "#5a67f6", border: "none" }} disabled={resSubmitting}> {resSubmitting ? "Modifying..." : "Modify"} </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}
