"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "../components/Header";
import Footer from "../components/Footer";
import SafeImage from "../components/SafeImage";
import { authService } from "../services/authService";
import { getReservationDetailsApi, cancelReservationApi, resendReservationApi, getCancelReasonsApi, makeReservationApi } from "../services/reservationApi";
import Swal from "sweetalert2";

export default function MyReservationsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [cancelModal, setCancelModal] = useState({ show: false, id: null, reservationId: null, comment: "", reason: "" });
  const [cancelSuccessPopup, setCancelSuccessPopup] = useState({ show: false, message: "" });
  const [modifySuccessPopup, setModifySuccessPopup] = useState({ show: false, message: "" });
  const [successMessage, setSuccessMessage] = useState("");
  const [modifyModal, setModifyModal] = useState({
    show: false,
    id: null,
    eventId: null,
    reservationId: null,
    adultCount: "",
    childCount: "",
    instruction: "",
    couponId: "",
    guestType: "All",
  });
  const [cancelReasonsList, setCancelReasonsList] = useState([]);
  const [resSubmitting, setResSubmitting] = useState(false);
  const [resError, setResError] = useState("");

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

    const resObj = item.makeReservation || null;
    const hasReservation = Boolean(resObj && resObj._id);

    const merchantObj = resObj?.merchantId || {};
    const locationObj = resObj?.serviceLocationId || item.serviceLocationId || {};

    let venueAddress = "Location TBD";
    if (locationObj?.addressName || locationObj?.address) {
      venueAddress = locationObj.addressName && locationObj.address
        ? `${locationObj.addressName} - ${locationObj.address}`
        : (locationObj.address || locationObj.addressName);
    }

    let displayStatus = "Rejected";
    if (hasReservation) {
      const rawStatus = (resObj.status || "active").toLowerCase();
      if (rawStatus === "cancelled" || rawStatus === "rejected") {
        displayStatus = "Cancelled";
      } else {
        displayStatus = "Reservation Confirmed";
      }
    } else {
      displayStatus = "Rejected";
    }

    const guests = resObj?.adultCount ? `${resObj.adultCount.padStart(2, '0')} Guests` : "01 Guest";

    let totalAmount = 0;
    if (Array.isArray(item.serviceBookings) && item.serviceBookings.length > 0) {
      totalAmount = item.serviceBookings.reduce((sum, sb) => sum + (sb.finalAmount || 0), 0);
    }

    return {
      id: item._id,
      hasReservation: hasReservation,
      reservationId: resObj?._id || null,
      eventTitle: item.eventTitle || merchantObj.serviceName || "Event Reservation",
      eventDate: formattedDate,
      eventStartTime: item.eventStartTime || "12:00 PM",
      eventEndTime: item.eventEndTime || "04:00 PM",
      venue: venueAddress,
      status: displayStatus,
      rawStatus: resObj?.status || item.status,
      guestsCount: guests,
      reservedOn: item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-GB", { day: 'numeric', month: 'short', year: 'numeric' }) : "Recently",
      img: item.image || merchantObj.bannerImage || "",
      eventId: item._id,
      packagePrice: totalAmount || 35,
      tax: 5,
      discount: 5,
      totalPaid: totalAmount || 35,
      tableNumber: resObj?.instruction || "Table-Standard",
      organizerName: item.eventcreator?.fullName || merchantObj.serviceName || "Event Host",
      organizerEmail: item.eventcreator?.email || merchantObj.email || "support@eventuna.com",
      organizerPhone: merchantObj.mobile || merchantObj.phone || "+91 810300655",
      attendanceQr: resObj?.attendanceQr || null,
      serviceBookings: item.serviceBookings || [],
      contactList: item.contactList || [],
      invitedUsers: item.invitedUsers || [],
      rawItem: item
    };
  };

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

  const handleCancelClick = (res) => {
    const realReservationId = res.reservationId || res.rawItem?.makeReservation?._id;
    if (!realReservationId) {
      Swal.fire({
        title: "Reservation Not Found",
        text: "This event does not have an active venue reservation record to cancel.",
        icon: "warning",
        confirmButtonColor: "#3e56f0"
      });
      return;
    }
    const defaultReason = cancelReasonsList.length > 0 ? cancelReasonsList[0]._id : "";
    setCancelModal({
      show: true,
      id: res.id,
      reservationId: realReservationId,
      comment: "",
      reason: defaultReason,
    });
  };

  const handleModifyClick = (res) => {
    const realReservationId = res.reservationId || res.rawItem?.makeReservation?._id;
    if (!realReservationId) {
      Swal.fire({
        title: "Reservation Not Found",
        text: "This event does not have an active venue reservation record to modify.",
        icon: "warning",
        confirmButtonColor: "#3e56f0"
      });
      return;
    }
    const resObj = res.rawItem?.makeReservation || {};
    setModifyModal({
      show: true,
      id: res.id,
      eventId: res.eventId || res.id,
      reservationId: realReservationId,
      adultCount: resObj.adultCount || "",
      childCount: resObj.childCount || "",
      instruction: resObj.instruction || "",
      couponId: "",
      guestType: resObj.guestType || "All",
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
        guestType: modifyModal.guestType || "All",
      };
      const res = await makeReservationApi(payload);
      if (res && res.status === true) {
        setModifyModal({ show: false, id: null, eventId: null, reservationId: null, adultCount: "", childCount: "", instruction: "", couponId: "", guestType: "All" });
        setModifySuccessPopup({ show: true, message: res.message || "Reservation update successfully" });
        // Refresh reservations
        const freshRes = await getReservationDetailsApi();
        if (freshRes && freshRes.status && Array.isArray(freshRes.data)) {
          setReservations(freshRes.data.map(mapReservationItem));
        }
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
    if (!cancelModal.reason) {
      alert("Please select a reason for cancellation.");
      return;
    }
    setResSubmitting(true);
    try {
      const payload = {
        reservationId: cancelModal.reservationId,
        cancelReason: cancelModal.reason,
      };
      if (cancelModal.comment) {
        payload.comment = cancelModal.comment;
      }

      const response = await cancelReservationApi(payload);
      if (response && response.status === true) {
        const updated = reservations.map((r) => {
          if (r.id === cancelModal.id || r.reservationId === cancelModal.reservationId) {
            return { ...r, status: "Cancelled" };
          }
          return r;
        });
        setReservations(updated);
        localStorage.setItem("eventuna-reservations", JSON.stringify(updated));
        setCancelModal({ show: false, id: null, reservationId: null, comment: "", reason: "" });
        setCancelSuccessPopup({ show: true, message: response.message || "Reservation Canceled successfully" });
      } else {
        Swal.fire({
          title: "Error",
          text: response?.message || "Failed to cancel reservation on server.",
          icon: "error",
          confirmButtonColor: "#3e56f0"
        });
      }
    } catch (err) {
      console.error("Cancel API error:", err);
      Swal.fire({
        title: "Error",
        text: err.message || "An error occurred while cancelling the reservation.",
        icon: "error",
        confirmButtonColor: "#3e56f0"
      });
    } finally {
      setResSubmitting(false);
    }
  };

  const handleViewDetails = (res) => {
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
        Swal.fire({
          title: "Error",
          text: response?.message || "Failed to resend reservation details.",
          icon: "error",
          confirmButtonColor: "#3e56f0"
        });
      }
    } catch (err) {
      console.error("Resend API error:", err);
      Swal.fire({
        title: "Error",
        text: err.message || "An error occurred while resending reservation.",
        icon: "error",
        confirmButtonColor: "#3e56f0"
      });
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
                                    <span className={`status-badge ${res.hasReservation && res.status !== "Cancelled" ? "status-confirmed" : "status-cancelled"}`}>
                                      <i className={`bi ${res.hasReservation && res.status !== "Cancelled" ? "bi-check-circle" : "bi-arrow-repeat"} me-1`}></i>
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
                                  {res.hasReservation && (
                                    <>
                                      <button
                                        className="res-btn"
                                        onClick={() => handleModifyClick(res)}
                                      >
                                        Modify
                                      </button>
                                      <button
                                        className="res-btn"
                                        onClick={() => handleResend(res)}
                                      >
                                        Resend
                                      </button>
                                      <button
                                        className="res-btn"
                                        onClick={() => handleCancelClick(res)}
                                        disabled={res.status === "Cancelled" || res.status === "Rejected"}
                                      >
                                        Cancel
                                      </button>
                                    </>
                                  )}
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

      {/* Cancel Reservation Modal */}
      {cancelModal.show && (
        <div className="modal fade show d-block" style={{ background: "rgba(0, 0, 0, 0.45)", zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered px-3" style={{ maxWidth: "420px" }}>
            <div className="modal-content border-0 rounded-4 overflow-hidden shadow-lg" style={{ background: "#fff" }}>
              <div className="modal-header border-bottom py-3 px-4 d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-2">
                  <button type="button" className="btn p-0 border-0 text-dark" onClick={() => setCancelModal({ show: false, id: null, reservationId: null, comment: "", reason: "" })}>
                    <i className="bi bi-arrow-left fs-5"></i>
                  </button>
                  <h5 className="modal-title fw-bold text-dark mb-0" style={{ fontSize: "17px" }}>Cancel Reservation</h5>
                </div>
              </div>
              <div className="modal-body p-4">
                <form onSubmit={(e) => { e.preventDefault(); confirmCancel(); }}>
                  <div className="mb-4">
                    <label className="form-label text-dark fw-medium mb-2" style={{ fontSize: "14px" }}>
                      Please select reason for cancellation
                    </label>
                    <select
                      className="form-select py-2.5 px-3 rounded-3"
                      style={{ border: "1.5px solid #dcdcdc", fontSize: "14px" }}
                      value={cancelModal.reason}
                      onChange={(e) => setCancelModal({ ...cancelModal, reason: e.target.value })}
                      required
                    >
                      {cancelReasonsList.length > 0 ? (
                        cancelReasonsList.map((r) => (
                          <option key={r._id} value={r._id}>{r.reason}</option>
                        ))
                      ) : (
                        <option value="">Change of plans</option>
                      )}
                    </select>
                  </div>

                  <div className="mb-4">
                    <label className="form-label text-dark fw-medium mb-2" style={{ fontSize: "14px" }}>
                      Provide optional suggestion or comments to helps us keep you as a customer
                    </label>
                    <textarea
                      className="form-control p-3 rounded-3"
                      style={{ border: "1.5px solid #dcdcdc", fontSize: "14px", resize: "none" }}
                      rows="4"
                      value={cancelModal.comment}
                      onChange={(e) => setCancelModal({ ...cancelModal, comment: e.target.value })}
                      placeholder="This is for test"
                    />
                  </div>

                  <div className="d-grid mt-4">
                    <button
                      type="submit"
                      className="btn py-2.5 fw-bold text-white rounded-3"
                      style={{ background: "#283b9b", fontSize: "15px", letterSpacing: "0.5px" }}
                      disabled={resSubmitting}
                    >
                      {resSubmitting ? "SUBMITTING..." : "SUBMIT"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Success Dialog Popup */}
      {cancelSuccessPopup.show && (
        <div className="modal fade show d-block" style={{ background: "rgba(0, 0, 0, 0.45)", zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered px-3" style={{ maxWidth: "340px" }}>
            <div className="modal-content border-0 rounded-4 overflow-hidden shadow-lg p-4 position-relative" style={{ background: "#fff" }}>
              <button
                type="button"
                className="btn p-0 border-0 position-absolute"
                style={{ top: "14px", left: "16px", background: "none", fontSize: "16px", color: "#333" }}
                onClick={() => setCancelSuccessPopup({ show: false, message: "" })}
              >
                <i className="bi bi-x-lg"></i>
              </button>
              <div className="text-center pt-3 pb-2">
                <h5 className="fw-bold text-dark mb-3" style={{ fontSize: "18px" }}>Reservation</h5>
                <p className="text-muted mb-0" style={{ fontSize: "14px", lineHeight: "1.4" }}>
                  {cancelSuccessPopup.message || "Reservation Canceled successfully"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modify Reservation Modal */}
      {modifyModal.show && (
        <div className="modal fade show d-block" style={{ background: "rgba(0, 0, 0, 0.45)", zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered px-3" style={{ maxWidth: "440px" }}>
            <div className="modal-content border-0 rounded-4 overflow-hidden shadow-lg" style={{ background: "#fff" }}>
              <div className="modal-header border-bottom py-3 px-4 d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-2">
                  <button type="button" className="btn p-0 border-0 text-dark" onClick={() => setModifyModal({ show: false, id: null, eventId: null, reservationId: null, adultCount: "", childCount: "", instruction: "", couponId: "", guestType: "All" })}>
                    <i className="bi bi-arrow-left fs-5"></i>
                  </button>
                  <h5 className="modal-title fw-bold text-dark mb-0" style={{ fontSize: "17px" }}>Modify Reservation</h5>
                </div>
              </div>
              <div className="modal-body p-4">
                <div className="text-primary mb-3" style={{ fontSize: "18px" }}>
                  <i className="bi bi-plus-lg"></i>
                </div>
                <form onSubmit={handleModifyReservation}>
                  <div className="mb-3">
                    <label className="form-label text-dark fw-semibold mb-1" style={{ fontSize: "14px" }}>
                      Enter the number of ADULT guests
                    </label>
                    <input
                      type="number"
                      className="form-control py-2 px-3 rounded-3"
                      style={{ border: "1.5px solid #dcdcdc", fontSize: "14px" }}
                      value={modifyModal.adultCount}
                      onChange={(e) => setModifyModal({ ...modifyModal, adultCount: e.target.value })}
                      placeholder="25"
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-dark fw-semibold mb-1" style={{ fontSize: "14px" }}>
                      Enter the number of CHILD guests
                    </label>
                    <input
                      type="number"
                      className="form-control py-2 px-3 rounded-3"
                      style={{ border: "1.5px solid #dcdcdc", fontSize: "14px" }}
                      value={modifyModal.childCount}
                      onChange={(e) => setModifyModal({ ...modifyModal, childCount: e.target.value })}
                      placeholder="25"
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-dark fw-semibold mb-1" style={{ fontSize: "14px" }}>
                      Enter Coupon
                    </label>
                    <input
                      type="text"
                      className="form-control py-2 px-3 rounded-3"
                      style={{ border: "1.5px solid #dcdcdc", fontSize: "14px" }}
                      value={modifyModal.couponId}
                      onChange={(e) => setModifyModal({ ...modifyModal, couponId: e.target.value })}
                      placeholder="Ex. ABCDES1234"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="form-label text-dark fw-semibold mb-1" style={{ fontSize: "14px" }}>
                      Any instruction or Request
                    </label>
                    <textarea
                      className="form-control p-3 rounded-3"
                      style={{ border: "1.5px solid #dcdcdc", fontSize: "14px", resize: "none" }}
                      rows="3"
                      value={modifyModal.instruction}
                      onChange={(e) => setModifyModal({ ...modifyModal, instruction: e.target.value })}
                      placeholder="Jjhhj"
                    />
                  </div>

                  <div className="d-grid mt-4">
                    <button
                      type="submit"
                      className="btn py-2.5 fw-bold text-white rounded-3"
                      style={{ background: "#495ef4", fontSize: "15px" }}
                      disabled={resSubmitting}
                    >
                      {resSubmitting ? "Modifying..." : "Modify"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modify Success Dialog Popup */}
      {modifySuccessPopup.show && (
        <div className="modal fade show d-block" style={{ background: "rgba(0, 0, 0, 0.45)", zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered px-3" style={{ maxWidth: "340px" }}>
            <div className="modal-content border-0 rounded-4 overflow-hidden shadow-lg p-4 position-relative" style={{ background: "#fff" }}>
              <button
                type="button"
                className="btn p-0 border-0 position-absolute"
                style={{ top: "14px", left: "16px", background: "none", fontSize: "16px", color: "#333" }}
                onClick={() => setModifySuccessPopup({ show: false, message: "" })}
              >
                <i className="bi bi-x-lg"></i>
              </button>
              <div className="text-center pt-3 pb-2">
                <h5 className="fw-bold text-dark mb-3" style={{ fontSize: "18px" }}>Update</h5>
                <p className="text-muted mb-0" style={{ fontSize: "14px", lineHeight: "1.4" }}>
                  {modifySuccessPopup.message || "Reservation update successfully"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}
