"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { getMerchantsByServiceApi } from "../services/eventApi";
import { apiRequest } from "../services/apiClient";
import Swal from "sweetalert2";

const mapEventData = (data, loggedInUser) => {
  if (!data) return null;
  
  let selectedDate = 15;
  let month = 6;
  try {
    if (data.eventDate) {
      const parts = data.eventDate.split('-');
      if (parts.length === 3) {
        selectedDate = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1; // 0-indexed month
      } else {
        const d = new Date(data.eventDate);
        if (!isNaN(d.getTime())) {
          selectedDate = d.getDate();
          month = d.getMonth();
        }
      }
    }
  } catch (e) {
    console.error("Error parsing eventDate:", e);
  }

  const selectedGuests = (data.invitedUsers || []).map((guest, idx) => {
    return {
      id: guest.userId?._id || idx.toString(),
      name: guest.userId?.fullName || "Guest",
      profilePic: guest.userId?.profilePic || null,
      status: guest.status || "pending",
      email: guest.userId?.email || null,
      mobile: guest.userId?.mobile || null,
    };
  });

  const isMyEvent = loggedInUser && data.eventcreator && (
    (data.eventcreator._id && (data.eventcreator._id === loggedInUser.userId || data.eventcreator._id === loggedInUser._id || data.eventcreator._id === loggedInUser.id)) ||
    (data.eventcreator.id && (data.eventcreator.id === loggedInUser.userId || data.eventcreator.id === loggedInUser._id || data.eventcreator.id === loggedInUser.id)) ||
    (typeof data.eventcreator === "string" && (data.eventcreator === loggedInUser.userId || data.eventcreator === loggedInUser._id || data.eventcreator === loggedInUser.id))
  );

  let rawStatus = data.myInvitationStatus || data.status || data.eventCurrentStatus || "pending";
  const statusLower = rawStatus.toLowerCase();
  if (statusLower === "ongoingevent" || statusLower === "ongoing") {
    rawStatus = "Upcoming";
  }

  return {
    eventId: data._id,
    eventTitle: data.eventTitle || "Untitled Event",
    invitationMessage: data.description || "No description provided.",
    eventImage: data.image || null,
    selectedDate: selectedDate,
    month: month,
    startTime: data.eventStartTime || "",
    endTime: data.eventEndTime || "",
    selectedRestaurant: data.merchantId?._id || data.merchantId || (data.serviceLocationId?.merchantId?._id || data.serviceLocationId?.merchantId || ""),
    selectedGuests: selectedGuests,
    bringGuests: data.bringaLongGuest || "No",
    maxGuests: data.bringaLongNumber || "0",
    rsvp: data.rvsp || "No",
    rsvpBy: data.eventDate || "",
    selectedNotes: (data.noteId || []).map((n) => n.notes || n),
    registryUrl: typeof data.registryUrl === "object" && data.registryUrl !== null
      ? (data.registryUrl.registryUrl || data.registryUrl.registryName || "")
      : (data.registryUrl || ""),
    place: data.placeId?.preferences || "At a participating restaurant",
    selectedLocation: data.serviceLocationId
      ? {
          addressName: data.serviceLocationId.addressName || "",
          address: data.serviceLocationId.address || "",
        }
      : null,
    category: data.eventCategory?.category || "",
    eventType: data.eventType?.eventType || "",
    organizerName: data.eventcreator?.fullName || "Organizer",
    eventAttendanceQr: data.eventAttendanceQr || data.attendanceQrToken || null,
    status: rawStatus,
    isMyEvent: !!isMyEvent,
  };
};

function EventDetailsContent() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get("id");

  const [event, setEvent] = useState(null);
  const [detailsLoaded, setDetailsLoaded] = useState(false);
  const [merchants, setMerchants] = useState([]);
  const [showVenueModal, setShowVenueModal] = useState(false);
  const [backUrl, setBackUrl] = useState("/my-events");
  const [backLabel, setBackLabel] = useState("Back to My Events");

  // Accept Invitation Modal inputs & loading
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [thanksMessage, setThanksMessage] = useState("");
  const [suggestionMessage, setSuggestionMessage] = useState("");
  const [alongGuest, setAlongGuest] = useState("ye");

  // Decline Invitation Modal inputs & loading
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [declineSuggestion, setDeclineSuggestion] = useState("");
  const [forceDetailsView, setForceDetailsView] = useState(false);
  const [hasJustDeclined, setHasJustDeclined] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [apiMessage, setApiMessage] = useState({ type: "", text: "" });

  // Load event details that were selected from an event list or created event flow.
  useEffect(() => {
    setForceDetailsView(false);
    setHasJustDeclined(false);
    try {
      const savedUrl = window.localStorage.getItem("event-details-back-url");
      const savedLabel = window.localStorage.getItem("event-details-back-label");
      if (savedUrl) setBackUrl(savedUrl);
      if (savedLabel) setBackLabel(savedLabel);
    } catch (e) {
      console.error("Error reading back redirection url:", e);
    }

    const fetchEventDetails = async () => {
      if (!eventId) {
        setDetailsLoaded(true);
        return;
      }
      try {
        setDetailsLoaded(false);
        const res = await apiRequest(`/event/eventbyId?id=${eventId}`);
        if (res && res.status && res.data) {
          const userObj = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user_info")) : null;
          const mapped = mapEventData(res.data, userObj);
          setEvent(mapped);
        } else {
          setApiMessage({ type: "danger", text: res?.message || "Failed to load event details." });
        }
      } catch (err) {
        console.error("Failed to fetch event details:", err);
        setApiMessage({ type: "danger", text: "Network error loading event details." });
      } finally {
        setDetailsLoaded(true);
      }
    };

    fetchEventDetails();

    // Load merchants list to display venue info details
    const fetchMerchants = async () => {
      try {
        const res = await getMerchantsByServiceApi("686fb6ced46e9740ee8277ec");
        if (res && res.status && Array.isArray(res.data)) {
          setMerchants(res.data);
        } else {
          console.error("Failed to load merchants list: API returned an error status.", res);
        }
      } catch (err) {
        console.error("Failed to load merchants list:", err.message || err);
      }
    };
    fetchMerchants();
  }, [eventId]);

  const handleConfirmAccept = async (e) => {
    e.preventDefault();
    if (!event || !event.eventId) {
      setApiMessage({ type: "danger", text: "Error: Could not identify the event ID. Please reload and try again." });
      return;
    }

    try {
      setSubmitting(true);
      setApiMessage({ type: "", text: "" });

      const payload = {
        status: "accepted",
        along_guest: String(alongGuest || "ye").toLowerCase(),
        thanks_message: thanksMessage || "",
        suggestion_message: suggestionMessage || "",
        eventId: event.eventId
      };

      const res = await apiRequest("/event/respond-to-invitation", {
        method: "POST",
        body: payload
      });

      if (res && res.status) {
        setApiMessage({ type: "success", text: res.message || "Invitation accepted successfully!" });
        // Update local event status state to trigger UI update
        const updatedEvent = { ...event, status: "accepted" };
        setEvent(updatedEvent);
        
        setTimeout(() => {
          setShowAcceptModal(false);
          setApiMessage({ type: "", text: "" });
        }, 2000);
      } else {
        setApiMessage({ type: "danger", text: res?.message || "Failed to respond to invitation." });
      }
    } catch (err) {
      setApiMessage({ type: "danger", text: err.message || "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDecline = async (e) => {
    e.preventDefault();
    if (!event || !event.eventId) {
      setApiMessage({ type: "danger", text: "Error: Could not identify the event ID. Please reload and try again." });
      return;
    }

    try {
      setSubmitting(true);
      setApiMessage({ type: "", text: "" });

      const payload = {
        status: "declined",
        along_guest: "",
        thanks_message: declineReason || "",
        suggestion_message: declineSuggestion || "",
        eventId: event.eventId
      };

      const res = await apiRequest("/event/respond-to-invitation", {
        method: "POST",
        body: payload
      });

      if (res && res.status) {
        setApiMessage({ type: "success", text: res.message || "Invitation declined successfully!" });
        // Update local event status state to trigger UI update
        const updatedEvent = { ...event, status: "declined" };
        setEvent(updatedEvent);
        setHasJustDeclined(true);
        
        setTimeout(() => {
          setShowDeclineModal(false);
          setApiMessage({ type: "", text: "" });
        }, 2000);
      } else {
        setApiMessage({ type: "danger", text: res?.message || "Failed to respond to invitation." });
      }
    } catch (err) {
      setApiMessage({ type: "danger", text: err.message || "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetReminder = async () => {
    if (!event || !event.eventId) {
      setApiMessage({ type: "danger", text: "Error: Could not identify the event ID." });
      return;
    }

    try {
      setSubmitting(true);
      setApiMessage({ type: "", text: "" });

      const res = await apiRequest("/event/set-reminder", {
        method: "POST",
        body: { eventId: event.eventId }
      });

      if (res && res.status) {
        setApiMessage({ type: "success", text: res.message || "Reminder set successfully" });
        Swal.fire({
          title: "Event UNA",
          text: "Set reminder successfully",
          icon: "success",
          confirmButtonText: "Ok",
          confirmButtonColor: "#4f46e5",
          customClass: {
            popup: "rounded-4 border-0 shadow",
            confirmButton: "btn btn-primary rounded-pill px-4"
          }
        });
      } else {
        setApiMessage({ type: "danger", text: res?.message || "Failed to set reminder." });
      }
    } catch (err) {
      setApiMessage({ type: "danger", text: err.message || "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  if (!detailsLoaded) {
    return (
      <>
        <Header />
        <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light">
          <div className="text-center">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading event...</span>
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  if (!event) {
    return (
      <>
        <Header />
        <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light">
          <div className="text-center bg-white rounded-4 shadow-sm p-5 mx-3" style={{ maxWidth: "520px" }}>
            <div className="mb-3 text-primary" style={{ fontSize: "42px" }}>
              <i className="fa-regular fa-calendar-xmark"></i>
            </div>
            <h2 className="fw-bold mb-2" style={{ color: "#0c1b33" }}>No event selected</h2>
            <p className="text-muted mb-4">
              Choose an event from your event list to view its details.
            </p>
            <Link href="/my-events" className="main-btn btn-hover d-inline-flex align-items-center gap-2 text-decoration-none">
              <i className="fa-solid fa-arrow-left"></i>
              Go to My Events
            </Link>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  // If user declined the invitation, show the sad state screen
  if (hasJustDeclined && !forceDetailsView) {
    return (
      <>
        <Header />
        <div className="bg-white min-vh-100 d-flex align-items-center justify-content-center py-5" style={{ minHeight: "calc(100vh - 120px)" }}>
          <div className="container px-3" style={{ maxWidth: "480px" }}>
            
            {/* Top Navigation Header mimicking mobile screen */}
            <div className="d-flex align-items-center mb-4 pb-2 border-bottom">
              <button 
                onClick={() => { setForceDetailsView(true); setHasJustDeclined(false); }} 
                className="btn border-0 p-0 bg-transparent text-dark fs-4 me-3"
                title="Go back"
              >
                <i className="fa-solid fa-arrow-left"></i>
              </button>
              <h5 className="fw-bold text-dark m-0 text-center flex-grow-1 pe-4" style={{ fontSize: "18px" }}>
                Reservation
              </h5>
            </div>

            <div className="text-center px-2">
              {/* Event Title */}
              <div className="text-muted small fw-bold text-uppercase mb-2" style={{ letterSpacing: "1px" }}>
                {event.eventTitle || "dr"}
              </div>

              {/* Decline Headers */}
              <h2 className="fw-bold text-dark mb-3" style={{ fontSize: "28px", letterSpacing: "-0.5px", lineHeight: "1.25" }}>
                We&apos;re sad that you can&apos;t attend this.
              </h2>
              
              <p className="text-muted mb-5 mx-auto" style={{ fontSize: "14.5px", maxWidth: "400px", lineHeight: "1.6" }}>
                If you change you mind you could access the invitation again and accept the invitation.
              </p>

              {/* Vector Bell-Slash Illustration */}
              <div className="my-5 d-flex justify-content-center">
                <div className="position-relative d-flex align-items-center justify-content-center bg-light rounded-circle shadow-sm" style={{ width: "120px", height: "120px", background: "#f8fafc" }}>
                  <i className="fa-regular fa-bell-slash text-secondary opacity-75" style={{ fontSize: "42px" }}></i>
                  {/* Sad Emoji Eyes */}
                  <span className="position-absolute text-secondary fw-bold" style={{ bottom: "25px", fontSize: "14px", letterSpacing: "1px" }}>:(</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="d-flex flex-column gap-3 mt-5">
                <button 
                  type="button" 
                  className="btn btn-outline-primary rounded-pill py-3 fw-bold"
                  style={{
                    borderColor: "#3b82f6",
                    color: "#3b82f6",
                    borderWidth: "1.5px",
                    fontSize: "14px",
                    letterSpacing: "0.5px"
                  }}
                  onClick={() => { setForceDetailsView(true); setHasJustDeclined(false); }}
                >
                  ACCESS EVENT
                </button>
                <Link 
                  href="/" 
                  className="btn btn-primary rounded-pill py-3 fw-bold text-white"
                  style={{
                    background: "#4f46e5",
                    border: "none",
                    fontSize: "14px",
                    letterSpacing: "0.5px",
                    boxShadow: "0 4px 12px rgba(79, 70, 229, 0.15)"
                  }}
                >
                  HOME
                </Link>
              </div>
            </div>

          </div>
        </div>
        <Footer />
      </>
    );
  }

  // Find selected restaurant info
  const restaurant = merchants.find((item) => (item._id || item.id) === event.selectedRestaurant) || merchants[0];

  const isRestaurantOption = event.place === "At a participating restaurant" ||
    event.place === "restaurant" ||
    event.place === "Restaurant from list" ||
    event.place === "6877a86668d1e0b9fcdf5006";

  // Dynamic Venue Display String
  let venueDisplay = "Location provided by organizer";
  if (isRestaurantOption) {
    if (restaurant) {
      const restName = restaurant.serviceName || restaurant.fullName || restaurant.name || "Participating restaurant";
      if (event.selectedLocation) {
        venueDisplay = `${restName} - ${event.selectedLocation.addressName || event.selectedLocation.address}`;
      } else {
        const defaultLoc = (restaurant.serviceLocationIds && restaurant.serviceLocationIds[0]?.addressName) ||
          (restaurant.serviceLocationIds && restaurant.serviceLocationIds[0]?.address) ||
          restaurant.location;
        venueDisplay = defaultLoc ? `${restName} (${defaultLoc})` : restName;
      }
    } else {
      venueDisplay = "Participating restaurant";
    }
  } else if (event.place) {
    venueDisplay = event.place;
  }

  const monthName = new Date(2026, event.month || 6, 1).toLocaleString("en-US", { month: "long" });

  // Guest avatar initials helper
  const getInitials = (name) => {
    if (!name) return "?";
    return name.trim().charAt(0).toUpperCase();
  };

  const invitedCount = Array.isArray(event.selectedGuests) ? event.selectedGuests.length : 0;

  return (
    <>
      <Header />
      <div className="wrapper bg-light py-5">
        <div className="container">

          {/* Top Breadcrumb & Actions Bar */}
          <div className="d-flex justify-content-between align-items-center mb-4">
            <Link href={backUrl} className="btn btn-outline-secondary rounded-pill px-4 py-2 fw-semibold d-flex align-items-center gap-2 shadow-sm bg-white border-0">
              <i className="fa-solid fa-arrow-left"></i>
              {backLabel}
            </Link>
            <span className="badge bg-primary px-3 py-2 rounded-pill shadow-sm fw-semibold">
              Event Details
            </span>
          </div>

          {apiMessage.text && !showAcceptModal && (
            <div className={`alert alert-${apiMessage.type} alert-dismissible fade show mb-4`} role="alert">
              <i className={`fa-solid ${apiMessage.type === "success" ? "fa-circle-check" : "fa-circle-exclamation"} me-2`}></i>
              {apiMessage.text}
              <button type="button" className="btn-close" onClick={() => setApiMessage({ type: "", text: "" })}></button>
            </div>
          )}

          <div className="row g-4">

            {/* Left Column - Main Content */}
            <div className="col-lg-8">

              {/* Event Cover Image Card */}
              <div className="card border-0 rounded-4 shadow-sm overflow-hidden mb-4 bg-white">
                <div className="position-relative" style={{ height: "380px" }}>
                  {event.eventImage ? (
                    <img
                      src={event.eventImage}
                      alt={event.eventTitle}
                      className="w-100 h-100 object-fit-cover"
                    />
                  ) : (
                    <div
                      className="w-100 h-100 d-flex flex-column align-items-center justify-content-center text-white"
                      style={{
                        background: "linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)"
                      }}
                    >
                      <i className="fa-solid fa-calendar-days fs-1 mb-2"></i>
                      <h3 className="fw-bold m-0">{event.eventTitle || "Untitled Event"}</h3>
                    </div>
                  )}
                </div>

                <div className="card-body p-4">
                  {/* Category and Type Badges */}
                  <div className="d-flex flex-wrap gap-2 mb-3">
                    {event.status && (
                      <span className={`badge px-3 py-2 rounded-pill fw-semibold text-white ${
                        event.status.toLowerCase() === "upcoming" ? "bg-info" :
                        event.status.toLowerCase() === "accepted" ? "bg-success" :
                        event.status.toLowerCase() === "declined" ? "bg-danger" : "bg-warning text-dark"
                      }`}>
                        Status: {event.status}
                      </span>
                    )}
                    {event.category && (
                      <span className="badge px-3 py-2 rounded-pill fw-semibold" style={{ color: "#4f46e5", background: "#e0e7ff" }}>
                        <i className="fa-solid fa-tag me-1"></i> {event.category}
                      </span>
                    )}
                    {event.eventType && (
                      <span className="badge px-3 py-2 rounded-pill fw-semibold" style={{ color: "#db2777", background: "#fdf2f8" }}>
                        <i className="fa-solid fa-circle-nodes me-1"></i> {event.eventType}
                      </span>
                    )}
                  </div>

                  <h1 className="fw-extrabold text-dark mb-4" style={{ fontSize: "36px" }}>
                    {event.eventTitle || "Untitled Event"}
                  </h1>

                  <div className="border-top pt-4">
                    <h5 className="fw-bold text-dark mb-3">Invitation Description</h5>
                    <p className="text-muted" style={{ fontSize: "16px", lineHeight: "1.7" }}>
                      {event.invitationMessage || "No description provided."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Guest List Card */}
              <div className="card border-0 rounded-4 shadow-sm p-4 bg-white mb-4">
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <h5 className="fw-bold text-dark m-0">
                    <i className="fa-solid fa-user-group text-primary me-2"></i>
                    Guest List <span className="text-muted small">({invitedCount} invited)</span>
                  </h5>
                </div>

                {event.selectedGuests && event.selectedGuests.length > 0 ? (
                  <div className="row g-3">
                    {event.selectedGuests.map((guest, idx) => (
                      <div key={guest.id || idx} className="col-12 col-sm-6 col-md-4">
                        <div className="d-flex align-items-center p-3 rounded-3 border bg-light-subtle shadow-sm h-100">
                          <div
                            className="rounded-circle text-white d-flex align-items-center justify-content-center fw-bold me-3 flex-shrink-0 shadow-sm"
                            style={{
                              width: "40px",
                              height: "40px",
                              fontSize: "13px",
                              background: ["#ff8a8a", "#8fb9ff", "#ffc88f", "#a2e0a2", "#e8a2e8"][idx % 5]
                            }}
                          >
                            {getInitials(guest.name)}
                          </div>
                          <div className="overflow-hidden w-100">
                            <h6 className="fw-bold mb-0 text-dark text-truncate small">{guest.name}</h6>
                            {(guest.email || guest.mobile) && (
                              <span className="text-muted d-block mb-1 text-truncate" style={{ fontSize: "10px" }}>
                                {guest.email || guest.mobile}
                              </span>
                            )}
                            <span className={`badge rounded-pill px-2 py-0.5`} style={{
                              fontSize: "9px",
                              background: guest.status === "accepted" ? "#d1fae5" : "#fef3c7",
                              color: guest.status === "accepted" ? "#065f46" : "#92400e"
                            }}>
                              {guest.status || "pending"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted mb-0 small">No guests invited yet.</p>
                )}
              </div>

              {/* Special Notes Card */}
              {event.selectedNotes && event.selectedNotes.length > 0 && (
                <div className="card border-0 rounded-4 shadow-sm p-4 bg-white">
                  <h5 className="fw-bold text-dark mb-3">
                    <i className="fa-solid fa-note-sticky text-warning me-2"></i>
                    Special Instructions / Notes
                  </h5>
                  <ul className="list-group list-group-flush">
                    {event.selectedNotes.map((note, index) => (
                      <li key={index} className="list-group-item px-0 py-2 border-0 bg-transparent text-muted d-flex align-items-start gap-2">
                        <i className="fa-solid fa-chevron-right text-primary mt-1.5" style={{ fontSize: "10px" }}></i>
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            </div>

            {/* Right Column - Sidebar */}
            <div className="col-lg-4">
              <div className="sticky-top" style={{ top: "24px", zIndex: 10 }}>

              {/* Event Attendance QR Code Card */}
              {event.eventAttendanceQr && (
                <div className="card border-0 rounded-4 shadow-sm p-4 bg-white mb-4 text-center">
                  <h5 className="fw-bold text-dark mb-3 text-start">
                    <i className="fa-solid fa-qrcode text-primary me-2"></i>
                    Attendance QR Code
                  </h5>
                  <div className="d-inline-block p-3 bg-light rounded-3 border mb-3 shadow-inner">
                    <img
                      src={event.eventAttendanceQr}
                      alt="Attendance QR Code"
                      style={{ width: "200px", height: "200px", objectFit: "contain" }}
                    />
                  </div>
                  <p className="text-muted small mb-0" style={{ lineHeight: "1.4" }}>
                    Scan this QR code to check in or verify attendance at the event.
                  </p>
                </div>
              )}

              {/* Date & Time Widget */}
              <div className="card border-0 rounded-4 shadow-sm p-4 bg-white mb-4">
                <h5 className="fw-bold text-dark mb-4">
                  <i className="fa-regular fa-clock text-primary me-2"></i>
                  Date & Time
                </h5>
                <div className="d-flex align-items-center mb-3">
                  <div
                    className="rounded-3 d-flex align-items-center justify-content-center me-3 shadow-sm flex-shrink-0"
                    style={{ width: "48px", height: "48px", background: "#e0e7ff", color: "#4f46e5", fontSize: "20px" }}
                  >
                    <i className="fa-regular fa-calendar-days"></i>
                  </div>
                  <div>
                    <h6 className="fw-bold mb-1 text-dark">
                      {event.selectedDate} {monthName} 2026
                    </h6>
                    <span className="text-muted small">Event Date</span>
                  </div>
                </div>
                <div className="d-flex align-items-center">
                  <div
                    className="rounded-3 d-flex align-items-center justify-content-center me-3 shadow-sm flex-shrink-0"
                    style={{ width: "48px", height: "48px", background: "#ecfdf5", color: "#059669", fontSize: "20px" }}
                  >
                    <i className="fa-regular fa-clock"></i>
                  </div>
                  <div>
                    <h6 className="fw-bold mb-1 text-dark">
                      {event.startTime || "--:--"} - {event.endTime || "--:--"}
                    </h6>
                    <span className="text-muted small">Event Time</span>
                  </div>
                </div>
              </div>

              {/* Location Widget */}
              <div className="card border-0 rounded-4 shadow-sm p-4 bg-white mb-4">
                <h5 className="fw-bold text-dark mb-4">
                  <i className="fa-solid fa-map-marker-alt text-danger me-2"></i>
                  Venue Location
                </h5>
                <p className="fw-bold text-dark mb-2 small">{event.place || "At a participating restaurant"}</p>
                <div className="p-3 bg-light rounded-3 mb-3 border shadow-inner">
                  <span className="text-muted small d-block mb-1">Address Details</span>
                  <p className="text-dark fw-semibold mb-0 small" style={{ lineHeight: "1.4" }}>
                    {venueDisplay}
                  </p>
                </div>

                {isRestaurantOption && restaurant && (
                  <button
                    type="button"
                    className="btn btn-primary w-100 rounded-pill py-2.5 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2"
                    onClick={() => setShowVenueModal(true)}
                    style={{ background: "#4f46e5", border: "none" }}
                  >
                    <i className="fa-solid fa-circle-info"></i>
                    View Venue Details
                  </button>
                )}
              </div>

              {/* Event Setup & Settings Widget */}
              <div className="card border-0 rounded-4 shadow-sm p-4 bg-white mb-4">
                <h5 className="fw-bold text-dark mb-4">
                  <i className="fa-solid fa-sliders text-success me-2"></i>
                  Event Setup
                </h5>

                <div className="d-flex flex-column gap-3">
                  {/* Guest Rules */}
                  <div className="d-flex align-items-start gap-3">
                    <div
                      className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{ width: "36px", height: "36px", background: "#fef3c7", color: "#d97706", fontSize: "16px" }}
                    >
                      <i className="fa-solid fa-user-plus"></i>
                    </div>
                    <div>
                      <span className="text-muted small d-block">Additional Guests</span>
                      <strong className="text-dark small">
                        {event.bringGuests === "Yes" ? `Allowed (Max: ${event.maxGuests || 1})` : "Not Allowed"}
                      </strong>
                    </div>
                  </div>

                  {/* RSVP Rules */}
                  <div className="d-flex align-items-start gap-3">
                    <div
                      className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{ width: "36px", height: "36px", background: "#fdf2f8", color: "#db2777", fontSize: "16px" }}
                    >
                      <i className="fa-regular fa-envelope"></i>
                    </div>
                    <div>
                      <span className="text-muted small d-block">RSVP Needed</span>
                      <strong className="text-dark small">
                        {event.rsvp === "Yes" ? `Yes (By ${event.rsvpBy || "Event Date"})` : "No"}
                      </strong>
                    </div>
                  </div>

                  {/* Registry Link */}
                  {event.registryUrl && (
                    <div className="d-flex align-items-start gap-3">
                      <div
                        className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                        style={{ width: "36px", height: "36px", background: "#e0f2fe", color: "#0284c7", fontSize: "16px" }}
                      >
                        <i className="fa-solid fa-gift"></i>
                      </div>
                      <div className="overflow-hidden">
                        <span className="text-muted small d-block">Registry URL</span>
                        {typeof event.registryUrl === "object" ? (
                          <a href={event.registryUrl.registryUrl || event.registryUrl.registryName || "#"} target="_blank" rel="noopener noreferrer" className="text-primary text-decoration-none small text-truncate d-block fw-semibold">
                            {event.registryUrl.registryName || event.registryUrl.registryUrl || "Registry"} <i className="fa-solid fa-arrow-up-right-from-square ms-1" style={{ fontSize: "10px" }}></i>
                          </a>
                        ) : (
                          <a href={event.registryUrl} target="_blank" rel="noopener noreferrer" className="text-primary text-decoration-none small text-truncate d-block fw-semibold">
                            {event.registryUrl} <i className="fa-solid fa-arrow-up-right-from-square ms-1" style={{ fontSize: "10px" }}></i>
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Organizer Details */}
                  <div className="d-flex align-items-start gap-3 border-top pt-3 mb-3">
                    <div
                      className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{ width: "36px", height: "36px", background: "#f3f4f6", color: "#374151", fontSize: "16px" }}
                    >
                      <i className="fa-regular fa-user"></i>
                    </div>
                    <div>
                      <span className="text-muted small d-block">Event Organizer</span>
                      <strong className="text-dark small">{event.organizerName || "Organizer"}</strong>
                    </div>
                  </div>

                  {/* Your Invitation Status */}
                  {!event.isMyEvent && (
                    <div className="d-flex align-items-start gap-3 border-top pt-3 mb-3 animate__animated animate__fadeIn">
                      <div
                        className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                        style={{
                          width: "36px",
                          height: "36px",
                          background: event.status?.toLowerCase() === "accepted" || event.status?.toLowerCase() === "upcoming" ? "#d1fae5" : event.status?.toLowerCase() === "declined" ? "#fee2e2" : "#fef3c7",
                          color: event.status?.toLowerCase() === "accepted" || event.status?.toLowerCase() === "upcoming" ? "#065f46" : event.status?.toLowerCase() === "declined" ? "#991b1b" : "#854d0e",
                          fontSize: "16px"
                        }}
                      >
                        <i className={event.status?.toLowerCase() === "accepted" || event.status?.toLowerCase() === "upcoming" ? "fa-solid fa-circle-check" : event.status?.toLowerCase() === "declined" ? "fa-solid fa-circle-xmark" : "fa-regular fa-clock"}></i>
                      </div>
                      <div>
                        <span className="text-muted small d-block">Your Invitation Status</span>
                        <strong className="text-dark small" style={{ textTransform: "capitalize" }}>
                          {event.status || "Pending"}
                        </strong>
                      </div>
                    </div>
                  )}

                  {/* Invitation Action Buttons */}
                  {!event.isMyEvent && (
                    <div className="border-top pt-3 mt-2">
                      {["accepted", "ongoing", "approved", "ongoingevent", "upcoming"].includes(event.status?.toLowerCase()) && (
                        <div className="d-grid gap-2">
                          <button 
                            type="button" 
                            className="btn btn-danger rounded-pill py-2 fw-semibold"
                            onClick={() => setShowDeclineModal(true)}
                          >
                            Decline
                          </button>
                        </div>
                      )}
                      {event.status?.toLowerCase() === "declined" && (
                        <div className="d-grid gap-2">
                          <button 
                            type="button" 
                            className="btn btn-success rounded-pill py-2 fw-semibold text-white animate__animated animate__fadeIn"
                            style={{ background: "#4f46e5", border: "none" }}
                            onClick={() => setShowAcceptModal(true)}
                          >
                            Accept
                          </button>
                        </div>
                      )}
                      {(!event.status || ["pending", "not_invited"].includes(event.status.toLowerCase())) && (
                        <div className="d-flex gap-2 justify-content-between animate__animated animate__fadeIn">
                          <button 
                            type="button" 
                            className="btn btn-primary rounded-pill flex-grow-1 py-2 fw-semibold text-white" 
                            style={{ background: "#4f46e5", border: "none" }}
                            onClick={() => setShowAcceptModal(true)}
                          >
                            Accept
                          </button>
                          <button 
                            type="button" 
                            className="btn btn-outline-danger rounded-pill flex-grow-1 py-2 fw-semibold"
                            onClick={() => setShowDeclineModal(true)}
                          >
                            Decline
                          </button>
                          <button 
                            type="button" 
                            className="btn btn-outline-primary rounded-pill flex-grow-1 py-2 fw-semibold"
                            onClick={handleSetReminder}
                            disabled={submitting}
                          >
                            Remind Me
                          </button>
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

      {/* Venue Details Modal dialog */}
      {showVenueModal && restaurant && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ background: "rgba(5, 2, 62, 0.55)", zIndex: 1050 }}
          onClick={() => setShowVenueModal(false)}
        >
          <div
            className="modal-dialog modal-dialog-centered modal-dialog-scrollable px-3"
            style={{ maxWidth: "520px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content border-0 rounded-4 overflow-hidden shadow-lg">

              <div className="modal-header border-bottom py-3 px-4 d-flex justify-content-between align-items-center">
                <h5 className="modal-title fw-bold" style={{ fontSize: "18px" }}>Venue Information</h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setShowVenueModal(false)}
                ></button>
              </div>

              <div className="modal-body p-4">
                {/* Banner / Profile Image */}
                <div className="mb-4 rounded-3 overflow-hidden" style={{ height: "180px" }}>
                  <img
                    src={restaurant.bannerImage || restaurant.profileImage || "/images/banner.jpg"}
                    alt={restaurant.serviceName || restaurant.name}
                    className="w-100 h-100 object-fit-cover"
                  />
                </div>

                <h4 className="fw-bold mb-2 text-dark">
                  {restaurant.serviceName || restaurant.fullName || restaurant.name}
                </h4>
                <p className="text-muted mb-4 small" style={{ lineHeight: "1.6" }}>
                  {restaurant.serviceDescription || restaurant.serviceSlogan || "Participating event venue."}
                </p>

                {/* Details layout rows */}
                <div className="d-flex flex-column gap-3">

                  {/* Cuisine */}
                  {restaurant.cuisineName && (
                    <div className="d-flex align-items-center gap-3">
                      <div
                        className="rounded-3 d-flex align-items-center justify-content-center"
                        style={{ width: "38px", height: "38px", background: "#e0f2fe", color: "#0284c7" }}
                      >
                        <i className="fa-solid fa-utensils"></i>
                      </div>
                      <div>
                        <span className="small text-muted d-block">Cuisine</span>
                        <strong className="text-dark small">{restaurant.cuisineName}</strong>
                      </div>
                    </div>
                  )}

                  {/* Selected Address */}
                  <div className="d-flex align-items-center gap-3">
                    <div
                      className="rounded-3 d-flex align-items-center justify-content-center"
                      style={{ width: "38px", height: "38px", background: "#ecfdf5", color: "#059669" }}
                    >
                      <i className="fa-solid fa-location-dot"></i>
                    </div>
                    <div>
                      <span className="small text-muted d-block">Venue location</span>
                      <strong className="text-dark small">
                        {event.selectedLocation?.address || restaurant.location || "Indore location"}
                      </strong>
                    </div>
                  </div>

                  {/* Phone */}
                  {(restaurant.phone || restaurant.mobile) && (
                    <div className="d-flex align-items-center gap-3">
                      <div
                        className="rounded-3 d-flex align-items-center justify-content-center"
                        style={{ width: "38px", height: "38px", background: "#fff1f2", color: "#e11d48" }}
                      >
                        <i className="fa-solid fa-phone"></i>
                      </div>
                      <div>
                        <span className="small text-muted d-block">Phone</span>
                        <strong className="text-dark small">{restaurant.phone || restaurant.mobile}</strong>
                      </div>
                    </div>
                  )}

                  {/* Website link */}
                  {restaurant.webUrl && (
                    <div className="d-flex align-items-center gap-3">
                      <div
                        className="rounded-3 d-flex align-items-center justify-content-center"
                        style={{ width: "38px", height: "38px", background: "#f5f3ff", color: "#7c3aed" }}
                      >
                        <i className="fa-solid fa-link"></i>
                      </div>
                      <div>
                        <span className="small text-muted d-block">Website</span>
                        <a
                          href={restaurant.webUrl.startsWith("http") ? restaurant.webUrl : `https://${restaurant.webUrl}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary text-decoration-none small fw-semibold"
                        >
                          {restaurant.webUrl} <i className="fa-solid fa-arrow-up-right-from-square ms-1"></i>
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Menu link */}
                  {restaurant.menuUrl && (
                    <div className="d-flex align-items-center gap-3">
                      <div
                        className="rounded-3 d-flex align-items-center justify-content-center"
                        style={{ width: "38px", height: "38px", background: "#fffbeb", color: "#d97706" }}
                      >
                        <i className="fa-solid fa-book-open"></i>
                      </div>
                      <div>
                        <span className="small text-muted d-block">Menu URL</span>
                        <a
                          href={restaurant.menuUrl.startsWith("http") ? restaurant.menuUrl : `https://${restaurant.menuUrl}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary text-decoration-none small fw-semibold"
                        >
                          View Menu <i className="fa-solid fa-arrow-up-right-from-square ms-1"></i>
                        </a>
                      </div>
                    </div>
                  )}

                </div>
              </div>

              <div className="modal-footer py-2 px-3 border-top">
                <button
                  type="button"
                  className="btn btn-secondary rounded-pill px-4"
                  onClick={() => setShowVenueModal(false)}
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Accept Invitation Modal dialog */}
      {showAcceptModal && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ background: "rgba(10, 6, 80, 0.65)", backdropFilter: "blur(6px)", zIndex: 1050 }}
          onClick={() => !submitting && setShowAcceptModal(false)}
        >
          <div
            className="modal-dialog modal-dialog-centered modal-dialog-scrollable px-3"
            style={{ maxWidth: "480px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <form className="modal-content border-0 rounded-4 overflow-hidden shadow-lg bg-white" onSubmit={handleConfirmAccept}>
              {/* Modern Header */}
              <div className="modal-header border-bottom-0 py-3 px-4 d-flex justify-content-between align-items-center bg-primary text-white">
                <div className="d-flex align-items-center gap-2">
                  <div className="rounded-circle bg-white bg-opacity-20 d-flex align-items-center justify-content-center" style={{ width: "32px", height: "32px" }}>
                    <i className="fa-regular fa-envelope-open text-white"></i>
                  </div>
                  <h5 className="modal-title fw-bold text-white m-0" style={{ fontSize: "16px", letterSpacing: "0.2px" }}>Accept Invitation</h5>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white opacity-75 border-0 bg-transparent text-white fs-5"
                  aria-label="Close"
                  disabled={submitting}
                  onClick={() => setShowAcceptModal(false)}
                  style={{ cursor: "pointer", transition: "opacity 0.2s" }}
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              {/* Modal Body */}
              <div className="modal-body p-4 bg-light bg-opacity-50">
                <div className="text-center mb-4">
                  <div className="d-inline-flex align-items-center justify-content-center bg-success bg-opacity-10 text-success rounded-circle mb-2" style={{ width: "50px", height: "50px" }}>
                    <i className="fa-solid fa-circle-check fs-4"></i>
                  </div>
                  <h6 className="fw-bold text-dark mb-1" style={{ fontSize: "16px" }}>We&apos;re happy that you will attend this!</h6>
                  <p className="text-muted small mb-0">Please fill in the optional details below to confirm.</p>
                </div>

                {apiMessage.text && (
                  <div className={`alert alert-${apiMessage.type} small border-0 shadow-sm py-2 px-3 mb-3 d-flex align-items-center gap-2`} role="alert" style={{ borderRadius: "10px" }}>
                    <i className={`fa-solid ${apiMessage.type === "success" ? "fa-circle-check" : "fa-circle-exclamation"}`}></i>
                    {apiMessage.text}
                  </div>
                )}

                {/* Optional Thank You message */}
                <div className="mb-3">
                  <label className="form-label text-dark small fw-bold mb-1.5">Optional Thank You Message</label>
                  <textarea
                    className="form-control border-light-subtle shadow-sm rounded-3 px-3 py-2"
                    rows="2.5"
                    placeholder="Write a thank you note..."
                    value={thanksMessage}
                    onChange={(e) => setThanksMessage(e.target.value)}
                    style={{ fontSize: "13.5px", resize: "none", borderColor: "#e5e7eb" }}
                  ></textarea>
                </div>

                {/* Optional Suggestion message */}
                <div className="mb-3">
                  <label className="form-label text-dark small fw-bold mb-1.5">Optional Suggestions</label>
                  <textarea
                    className="form-control border-light-subtle shadow-sm rounded-3 px-3 py-2"
                    rows="2.5"
                    placeholder="Any specific preference or suggestion..."
                    value={suggestionMessage}
                    onChange={(e) => setSuggestionMessage(e.target.value)}
                    style={{ fontSize: "13.5px", resize: "none", borderColor: "#e5e7eb" }}
                  ></textarea>
                </div>

                {/* Can bring along guests text input */}
                <div className="mb-2">
                  <label className="form-label text-dark small fw-bold mb-1.5">Can bring along guests</label>
                  <input
                    type="text"
                    className="form-control border-light-subtle shadow-sm rounded-pill px-4"
                    placeholder="ye"
                    value={alongGuest}
                    onChange={(e) => setAlongGuest(e.target.value)}
                    style={{ fontSize: "14px", height: "42px", borderColor: "#e5e7eb" }}
                  />
                </div>
              </div>

              {/* Modern Action Footer */}
              <div className="modal-footer border-top-0 py-3 px-4 bg-white d-flex gap-3">
                <button
                  type="button"
                  className="btn btn-outline-secondary rounded-pill px-4 flex-grow-1 py-2.5 fw-bold text-muted border-light-subtle"
                  disabled={submitting}
                  onClick={() => setShowAcceptModal(false)}
                  style={{ fontSize: "13.5px", background: "#f9fafb" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary rounded-pill px-4 flex-grow-1 py-2.5 fw-bold text-white"
                  style={{ background: "#4f46e5", border: "none", fontSize: "13.5px" }}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Submitting...
                    </>
                  ) : (
                    "Confirm Attendance"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Decline Invitation Modal dialog */}
      {showDeclineModal && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ background: "rgba(10, 6, 80, 0.65)", backdropFilter: "blur(6px)", zIndex: 1050 }}
          onClick={() => !submitting && setShowDeclineModal(false)}
        >
          <div
            className="modal-dialog modal-dialog-centered modal-dialog-scrollable px-3"
            style={{ maxWidth: "480px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <form className="modal-content border-0 rounded-4 overflow-hidden shadow-lg bg-white" onSubmit={handleConfirmDecline}>
              {/* Modern Header */}
              <div className="modal-header border-bottom-0 py-3 px-4 d-flex justify-content-between align-items-center bg-danger text-white">
                <div className="d-flex align-items-center gap-2">
                  <div className="rounded-circle bg-white bg-opacity-20 d-flex align-items-center justify-content-center" style={{ width: "32px", height: "32px" }}>
                    <i className="fa-regular fa-bell-slash text-white"></i>
                  </div>
                  <h5 className="modal-title fw-bold text-white m-0" style={{ fontSize: "16px", letterSpacing: "0.2px" }}>Decline Invitation</h5>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white opacity-75 border-0 bg-transparent text-white fs-5"
                  aria-label="Close"
                  disabled={submitting}
                  onClick={() => setShowDeclineModal(false)}
                  style={{ cursor: "pointer", transition: "opacity 0.2s" }}
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              {/* Modal Body */}
              <div className="modal-body p-4 bg-light bg-opacity-50">
                <div className="text-center mb-4">
                  <div className="d-inline-flex align-items-center justify-content-center bg-danger bg-opacity-10 text-danger rounded-circle mb-2" style={{ width: "50px", height: "50px" }}>
                    <i className="fa-solid fa-face-frown fs-4"></i>
                  </div>
                  <h6 className="fw-bold text-dark mb-1" style={{ fontSize: "16px" }}>We&apos;re sad that you can&apos;t attend this.</h6>
                  <p className="text-muted small mb-0">Please tell us why you won&apos;t be able to make it.</p>
                </div>

                {apiMessage.text && (
                  <div className={`alert alert-${apiMessage.type} small border-0 shadow-sm py-2 px-3 mb-3 d-flex align-items-center gap-2`} role="alert" style={{ borderRadius: "10px" }}>
                    <i className={`fa-solid ${apiMessage.type === "success" ? "fa-circle-check" : "fa-circle-exclamation"}`}></i>
                    {apiMessage.text}
                  </div>
                )}

                {/* Reason to Decline */}
                <div className="mb-3">
                  <label className="form-label text-dark small fw-bold mb-1.5">Do you like to share the reason?</label>
                  <textarea
                    className="form-control border-light-subtle shadow-sm rounded-3 px-3 py-2"
                    rows="3"
                    placeholder="Reason Details"
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    style={{ fontSize: "13.5px", resize: "none", borderColor: "#e5e7eb" }}
                  ></textarea>
                </div>

                {/* Optional Suggestion message */}
                <div className="mb-2">
                  <label className="form-label text-dark small fw-bold mb-1.5">Provide Suggestion</label>
                  <textarea
                    className="form-control border-light-subtle shadow-sm rounded-3 px-3 py-2"
                    rows="3"
                    placeholder="Suggestion Details"
                    value={declineSuggestion}
                    onChange={(e) => setDeclineSuggestion(e.target.value)}
                    style={{ fontSize: "13.5px", resize: "none", borderColor: "#e5e7eb" }}
                  ></textarea>
                </div>
              </div>

              {/* Modern Action Footer */}
              <div className="modal-footer border-top-0 py-3 px-4 bg-white d-flex gap-3">
                <button
                  type="button"
                  className="btn btn-outline-secondary rounded-pill px-4 flex-grow-1 py-2.5 fw-bold text-muted border-light-subtle"
                  disabled={submitting}
                  onClick={() => setShowDeclineModal(false)}
                  style={{ fontSize: "13.5px", background: "#f9fafb" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-danger rounded-pill px-4 flex-grow-1 py-2.5 fw-bold text-white"
                  style={{ border: "none", fontSize: "13.5px" }}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Submitting...
                    </>
                  ) : (
                    "Confirm Decline"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <Footer />
    </>
  );
}

export default function EventDetailsPage() {
  return (
    <Suspense fallback={
      <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading event...</span>
          </div>
        </div>
      </div>
    }>
      <EventDetailsContent />
    </Suspense>
  );
}
