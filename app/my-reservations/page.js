"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { authService } from "../services/authService";
import { getReservationDetailsApi } from "../services/reservationApi";

const defaultReservations = [
  {
    id: "RSV-2026-00842",
    eventTitle: "Birthday Celebration",
    eventDate: "26 August 2026",
    eventStartTime: "12:52 PM",
    eventEndTime: "01:52 PM",
    venue: "MG Road, Indore",
    status: "Confirmed",
    guestsCount: "01 Guest",
    reservedOn: "22 Jul 2026",
    img: "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=900&q=80",
    packagePrice: 35,
    tax: 5,
    discount: 5,
    totalPaid: 35,
    tableNumber: "VIP-04",
    organizerName: "ABC Events",
    organizerEmail: "support@abcevents.com",
    organizerPhone: "+351 999999",
  },
  {
    id: "RSV-2026-00821",
    eventTitle: "Business Networking Meetup",
    eventDate: "05 September 2026",
    eventStartTime: "06:00 PM",
    eventEndTime: "09:00 PM",
    venue: "Phoenix Convention Center",
    status: "Confirmed",
    guestsCount: "02 Guests",
    reservedOn: "20 Jul 2026",
    img: "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=900&q=80",
    packagePrice: 75,
    tax: 10,
    discount: 15,
    totalPaid: 70,
    tableNumber: "Table-12",
    organizerName: "Phoenix Networking",
    organizerEmail: "meetups@phoenix.com",
    organizerPhone: "+351 888888",
  },
  {
    id: "RSV-2026-00798",
    eventTitle: "Food & Music Festival",
    eventDate: "15 September 2026",
    eventStartTime: "04:00 PM",
    eventEndTime: "10:00 PM",
    venue: "Central Exhibition Ground",
    status: "Confirmed",
    guestsCount: "04 Guests",
    reservedOn: "18 Jul 2026",
    img: "https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=900&q=80",
    packagePrice: 120,
    tax: 15,
    discount: 10,
    totalPaid: 125,
    tableNumber: "General Admission",
    organizerName: "Central Festivals",
    organizerEmail: "festivals@central.com",
    organizerPhone: "+351 777777",
  }
];

export default function MyReservationsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [cancelModal, setCancelModal] = useState({ show: false, reservationId: null });

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
      } catch (e) {}

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
        img: item.image || merchantObj.bannerImage || "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=900&q=80",
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
          const stored = localStorage.getItem("eventuna-reservations");
          if (stored) {
            setReservations(JSON.parse(stored));
          } else {
            setReservations(defaultReservations);
          }
        }
      } catch (e) {
        console.error("Failed to load live reservations:", e);
        const stored = localStorage.getItem("eventuna-reservations");
        if (stored) {
          setReservations(JSON.parse(stored));
        } else {
          setReservations(defaultReservations);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchReservations();
  }, []);

  const handleCancelClick = (id) => {
    setCancelModal({ show: true, reservationId: id });
  };

  const confirmCancel = () => {
    const updated = reservations.map((res) => {
      if (res.id === cancelModal.reservationId) {
        return { ...res, status: "Cancelled" };
      }
      return res;
    });
    setReservations(updated);
    localStorage.setItem("eventuna-reservations", JSON.stringify(updated));
    setCancelModal({ show: false, reservationId: null });
  };

  const handleViewDetails = (res) => {
    localStorage.setItem("eventuna-latest-reservation", JSON.stringify(res));
    router.push(`/reservation-details?id=${res.id}`);
  };

  // Filter reservations by search
  const filteredReservations = reservations.filter((res) => {
    const searchString = `${res.eventTitle} ${res.id} ${res.venue}`.toLowerCase();
    return searchString.includes(searchQuery.toLowerCase());
  });

  // Calculate dynamic stats
  const upcomingCount = reservations.filter((r) => r.status === "Confirmed").length;
  const completedCount = 8 + reservations.filter((r) => r.status === "Completed").length;
  const cancelledCount = 1 + reservations.filter((r) => r.status === "Cancelled").length;

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
                                  <img
                                    src={res.img}
                                    alt={res.eventTitle}
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

                              {/* View Details Action buttons */}
                              <div className="col-lg-auto">
                                <div className="reservation-actions d-flex gap-2">
                                  <button
                                    className="btn-view"
                                    onClick={() => handleViewDetails(res)}
                                  >
                                    View Details
                                  </button>
                                  <button
                                    className="btn-qr"
                                    onClick={() => handleViewDetails(res)}
                                  >
                                    <i className="bi bi-qr-code"></i>
                                    QR Pass
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

                            {res.status === "Confirmed" && (
                              <button
                                className="btn-cancel"
                                onClick={() => handleCancelClick(res.id)}
                              >
                                Cancel Reservation
                              </button>
                            )}
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
                <button type="button" className="btn-close" onClick={() => setCancelModal({ show: false, reservationId: null })}></button>
              </div>
              <div className="modal-body p-4 text-center">
                <div className="rounded-circle bg-danger-subtle text-danger d-inline-flex align-items-center justify-content-center mb-3" style={{ width: "64px", height: "64px", fontSize: "28px" }}>
                  <i className="bi bi-exclamation-triangle"></i>
                </div>
                <p className="text-muted mb-0" style={{ fontSize: "15px", lineHeight: "1.6" }}>
                  Are you sure you want to cancel your reservation for ID <strong>{cancelModal.reservationId}</strong>? This action cannot be undone.
                </p>
              </div>
              <div className="modal-footer py-2.5 px-3 border-top bg-light d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-secondary rounded-pill px-4" onClick={() => setCancelModal({ show: false, reservationId: null })}>Keep Reservation</button>
                <button type="button" className="btn btn-danger rounded-pill px-4 fw-bold" onClick={confirmCancel}>Yes, Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </>
  );
}
