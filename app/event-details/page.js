"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { getMerchantsByServiceApi } from "../services/eventApi";

export default function EventDetailsPage() {
  const [event, setEvent] = useState(null);
  const [detailsLoaded, setDetailsLoaded] = useState(false);
  const [merchants, setMerchants] = useState([]);
  const [showVenueModal, setShowVenueModal] = useState(false);
  const [backUrl, setBackUrl] = useState("/my-events");
  const [backLabel, setBackLabel] = useState("Back to My Events");

  // Load event details that were selected from an event list or created event flow.
  useEffect(() => {
    try {
      const savedUrl = window.localStorage.getItem("event-details-back-url");
      const savedLabel = window.localStorage.getItem("event-details-back-label");
      if (savedUrl) setBackUrl(savedUrl);
      if (savedLabel) setBackLabel(savedLabel);
    } catch (e) {
      console.error("Error reading back redirection url:", e);
    }

    let savedEvent = null;
    try {
      const data = window.localStorage.getItem("eventuna-latest-event");
      if (data) {
        savedEvent = JSON.parse(data);
      }
    } catch (e) {
      console.error("Error reading event details from localStorage:", e);
    }

    setEvent(savedEvent);
    setDetailsLoaded(true);

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
  }, []);

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
                  <div className="d-flex align-items-start gap-3 border-top pt-3">
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

      <Footer />
    </>
  );
}
