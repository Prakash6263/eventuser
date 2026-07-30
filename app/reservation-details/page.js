"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { authService } from "../services/authService";
import { getReservationDetailsByIdApi } from "../services/reservationApi";

export default function ReservationDetailsPage() {
  const [profile, setProfile] = useState(null);
  const [reservation, setReservation] = useState(null);
  const [detailsLoaded, setDetailsLoaded] = useState(false);

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

  // Load profile and reservation info
  useEffect(() => {
    const initializeData = async () => {
      // Profile load
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

      // Reservation load
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get("id") || urlParams.get("eventId");

        if (id) {
          const res = await getReservationDetailsByIdApi(id);
          if (res && res.status && Array.isArray(res.data) && res.data.length > 0) {
            const item = res.data.find(d => d._id === id) || res.data[0];
            const mapped = mapReservationItem(item);
            setReservation(mapped);
          } else {
            const stored = localStorage.getItem("eventuna-latest-reservation");
            if (stored) {
              setReservation(JSON.parse(stored));
            }
          }
        } else {
          const stored = localStorage.getItem("eventuna-latest-reservation");
          if (stored) {
            setReservation(JSON.parse(stored));
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setDetailsLoaded(true);
      }
    };

    initializeData();
  }, []);

  if (!detailsLoaded) {
    return (
      <>
        <Header />
        <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  if (!reservation) {
    return (
      <>
        <Header />
        <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light">
          <div className="text-center bg-white rounded-4 shadow-sm p-5 mx-3" style={{ maxWidth: "520px" }}>
            <div className="mb-3 text-primary" style={{ fontSize: "42px" }}>
              <i className="fa-regular fa-calendar-xmark"></i>
            </div>
            <h2 className="fw-bold mb-2" style={{ color: "#0c1b33" }}>No reservation selected</h2>
            <p className="text-muted mb-4">
              Choose a reservation from your reservations list to view its details.
            </p>
            <Link href="/my-reservations" className="main-btn btn-hover d-inline-flex align-items-center gap-2 text-decoration-none">
              <i className="fa-solid fa-arrow-left"></i>
              Go to My Reservations
            </Link>
          </div>
        </div>
        <Footer />
      </>
    );
  }

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
                <div className="mb-3">
                  <Link href="/my-reservations" className="btn btn-outline-primary rounded-pill px-4 d-inline-flex align-items-center gap-2 text-decoration-none">
                    <i className="fa-solid fa-arrow-left"></i>
                    Back
                  </Link>
                </div>
                <div 
                  className="topper d-flex align-items-end mb-3" 
                  style={{ 
                    backgroundImage: `linear-gradient(rgba(0, 0, 0, .45), rgba(0, 0, 0, .45)), url('${reservation.img || "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQtTe-vPL0Z7hlwWUG6Tast9H5f8JhqpFVlXHYs8Zm4IBP0jjyklaI9nM_I&s=10"}')`,
                    backgroundSize: "cover",
                    backgroundPosition: "center"
                  }}
                >
                  <div className="container pb-4">
                    <h2>{reservation.eventTitle}</h2>
                    <span className="badge bg-success">{reservation.status}</span>
                  </div>
                </div>

                <div className="row g-4">
                  {/* Left Main column */}
                  <div className="col-lg-8">
                    {/* Reservation Information */}
                    <div className="cardx p-4 mb-4">
                      <h4>Reservation Information</h4>
                      <div className="row">
                        <div className="col-md-6">
                          <p><b>Reservation ID:</b> {reservation.id}</p>
                          <p><b>Booking Date:</b> {reservation.reservedOn}</p>
                          <p><b>Guests:</b> {reservation.guestsCount}</p>
                        </div>
                        <div className="col-md-6">
                          <p><b>Event Date:</b> {reservation.eventDate}</p>
                          <p><b>Time:</b> {reservation.eventStartTime}</p>
                          <p><b>Table:</b> {reservation.tableNumber}</p>
                        </div>
                      </div>
                    </div>

                    {/* Venue */}
                    <div className="cardx p-4 mb-4">
                      <h4>Venue</h4>
                      <p><i className="bi bi-geo-alt"></i> {reservation.venue}</p>
                    </div>

                    {/* Payment Summary */}
                    <div className="cardx p-4">
                      <h4>Payment Summary</h4>
                      <table className="table">
                        <tbody>
                          <tr>
                            <td>Package</td>
                            <td className="text-end">€{reservation.packagePrice}</td>
                          </tr>
                          <tr>
                            <td>Tax</td>
                            <td className="text-end">€{reservation.tax}</td>
                          </tr>
                          <tr>
                            <td>Discount</td>
                            <td className="text-end text-success">-€{reservation.discount}</td>
                          </tr>
                          <tr className="fw-bold">
                            <td>Total Paid</td>
                            <td className="text-end">€{reservation.totalPaid}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Right Sidebar column */}
                  <div className="col-lg-4">
                    {/* Entry QR Code */}
                    <div className="cardx p-4 mb-4 text-center">
                      <h5>Entry QR</h5>
                      <div className="qr">
                        <img 
                          src={reservation.attendanceQr || `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(reservation.id)}`}
                          alt="Entry QR"
                          style={{ width: "140px", height: "140px", objectFit: "contain" }}
                        />
                      </div>
                      <small>Show at entrance</small>
                    </div>

                    {/* Organizer */}
                    <div className="cardx p-4 mb-4">
                      <h5>Organizer</h5>
                      <p>
                        {reservation.organizerName}<br />
                        {reservation.organizerEmail}<br />
                        {reservation.organizerPhone}
                      </p>
                      <button className="btn btn-primary w-100">Contact Organizer</button>
                    </div>

                    {/* Actions */}
                    <div className="cardx p-4">
                      <h5>Actions</h5>
                      <button className="btn btn-success w-100 mb-2">Download Ticket</button>
                      <button className="btn btn-outline-primary w-100">Share Reservation</button>
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
