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

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setReservation(prev => ({ ...prev, img: url }));
    }
  };

  const getMappedServices = () => {
    const rawServices = reservation.rawItem?.additionalServices || [];
    const serviceMap = {
      "686fb723d46e9740ee8277f4": { name: "Catering", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSH7m3B140fW-LwR39L85aYkS9m5W28G6Fp5g&s" },
      "686fb7bad46e9740ee8277f8": { name: "Decoration & Lighting", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRz-8Z4-sH0w9T11n1U29Fj8a_U19v1K0G_1g&s" },
      "686fb714d46e9740ee8277f2": { name: "Furniture Rental", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQtg-K5_J_9L9Z11o1R19Tj8a_V19v1K0G_2g&s" },
      "686fb788d46e9740ee8277f6": { name: "Music & DJ", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTz-8Z4-sH0w9T11n1U29Fj8a_U19v1K0G_3g&s" },
    };

    if (rawServices.length === 0) {
      return [
        { name: "Catering", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSH7m3B140fW-LwR39L85aYkS9m5W28G6Fp5g&s", status: "confirmed" },
        { name: "Decoration & Lighting", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRz-8Z4-sH0w9T11n1U29Fj8a_U19v1K0G_1g&s", status: "pending" }
      ];
    }

    return rawServices.map((srv, index) => {
      const srvId = typeof srv === "string" ? srv : srv.serviceId;
      const srvStatus = typeof srv === "object" ? srv.status : "pending";
      const info = serviceMap[srvId] || { name: `Additional Service ${index + 1}`, img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQtTe-vPL0Z7hlwWUG6Tast9H5f8JhqpFVlXHYs8Zm4IBP0jjyklaI9nM_I&s" };
      return {
        ...info,
        status: srvStatus
      };
    });
  };

  const getServiceStatusDisplay = (status) => {
    const s = (status || "Pending").toLowerCase();
    if (s === "confirmed" || s === "accepted" || s === "yes" || s === "confirmed by provider") {
      return { text: "Confirmed By Provider", color: "#22c55e" };
    }
    return { text: "Pending", color: "#ef4444" };
  };

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
                <div className="mb-4">
                  <Link href="/my-reservations" className="btn btn-outline-primary rounded-pill px-4 d-inline-flex align-items-center gap-2 text-decoration-none">
                    <i className="fa-solid fa-arrow-left"></i>
                    Back
                  </Link>
                </div>

                <style>{`
                  .res-card {
                    max-width: 600px;
                    margin: 0 auto;
                    background: #fff;
                    border-radius: 20px;
                    overflow: hidden;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
                    font-family: 'Outfit', sans-serif;
                    color: #111;
                    border: 1px solid #f1f3f7;
                  }
                  .res-banner {
                    height: 250px;
                    background-size: cover;
                    background-position: center;
                    position: relative;
                    cursor: pointer;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    padding: 20px;
                    background-color: #f3f4f6;
                    border-bottom: 1px solid #e5e7eb;
                  }
                  .res-banner-overlay {
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(to bottom, rgba(0,0,0,0.15), rgba(0,0,0,0.55));
                    z-index: 1;
                  }
                  .upload-prompt {
                    position: relative;
                    z-index: 2;
                    align-self: center;
                    margin-top: auto;
                    margin-bottom: auto;
                    text-align: center;
                    color: #fff;
                  }
                  .upload-prompt i {
                    font-size: 32px;
                    margin-bottom: 8px;
                    display: block;
                  }
                  .upload-prompt span {
                    font-weight: 600;
                    font-size: 16px;
                  }
                  .participants-badge {
                    position: relative;
                    z-index: 2;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-top: auto;
                    background: rgba(255, 255, 255, 0.95);
                    padding: 6px 14px;
                    border-radius: 30px;
                    width: fit-content;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.1);
                  }
                  .avatar-stack {
                    display: flex;
                    align-items: center;
                  }
                  .avatar-stack img {
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    border: 2px solid #fff;
                    margin-left: -8px;
                    object-fit: cover;
                  }
                  .avatar-stack img:first-child {
                    margin-left: 0;
                  }
                  .participants-text {
                    font-size: 13px;
                    font-weight: 600;
                    color: #3e56f0;
                  }
                  .event-info-section {
                    padding: 24px;
                  }
                  .event-title {
                    font-size: 26px;
                    font-weight: 800;
                    color: #0c1b33;
                    margin-bottom: 16px;
                  }
                  .event-details-label {
                    font-size: 16px;
                    font-weight: 700;
                    color: #111;
                    margin-bottom: 8px;
                  }
                  .event-description {
                    font-size: 14px;
                    color: #666;
                    line-height: 1.6;
                    margin-bottom: 24px;
                    white-space: pre-wrap;
                  }
                  .info-row {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 16px 0;
                    border-bottom: 1px solid #f1f3f7;
                  }
                  .info-row:last-child {
                    border-bottom: none;
                  }
                  .icon-wrapper {
                    width: 44px;
                    height: 44px;
                    border-radius: 12px;
                    background: #eef0ff;
                    color: #3e56f0;
                    display: grid;
                    place-items: center;
                    font-size: 18px;
                    flex-shrink: 0;
                  }
                  .row-content {
                    flex-grow: 1;
                  }
                  .row-title {
                    font-size: 14px;
                    font-weight: 700;
                    color: #111;
                  }
                  .row-subtitle {
                    font-size: 12.5px;
                    color: #666;
                    margin-top: 2px;
                  }
                  .row-action-btn {
                    background: #5b5fc7;
                    color: #fff;
                    border: none;
                    border-radius: 20px;
                    padding: 6px 16px;
                    font-size: 12.5px;
                    font-weight: 600;
                    cursor: pointer;
                    box-shadow: 0 4px 10px rgba(91, 95, 199, 0.15);
                    transition: background 0.2s;
                  }
                  .row-action-btn:hover {
                    background: #4a4db5;
                  }
                  .summary-section {
                    padding: 24px;
                    background: #fafbfe;
                    border-top: 1px solid #f1f3f7;
                    border-bottom: 1px solid #f1f3f7;
                  }
                  .section-heading {
                    font-size: 18px;
                    font-weight: 800;
                    color: #111;
                    margin-bottom: 20px;
                  }
                  .summary-item {
                    margin-bottom: 18px;
                  }
                  .summary-item:last-child {
                    margin-bottom: 0;
                  }
                  .summary-label {
                    font-size: 14.5px;
                    font-weight: 700;
                    color: #111;
                    margin-bottom: 4px;
                  }
                  .summary-value {
                    font-size: 13px;
                    color: #555;
                    line-height: 1.5;
                  }
                  .services-section {
                    padding: 24px;
                  }
                  .services-heading {
                    font-size: 18px;
                    font-weight: 800;
                    color: #ef4444;
                    margin-bottom: 20px;
                  }
                  .service-card {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 12px;
                    border-radius: 14px;
                    border: 1px solid #f1f3f7;
                    background: #fff;
                    margin-bottom: 12px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.02);
                  }
                  .service-card:last-child {
                    margin-bottom: 0;
                  }
                  .service-img {
                    width: 54px;
                    height: 54px;
                    border-radius: 10px;
                    object-fit: cover;
                  }
                  .service-details {
                    flex-grow: 1;
                  }
                  .service-name {
                    font-size: 14.5px;
                    font-weight: 700;
                    color: #111;
                  }
                  .service-status {
                    font-size: 12.5px;
                    font-weight: 600;
                    margin-top: 2px;
                  }
                `}</style>

                <div className="res-card">
                  {/* Banner Image with Upload Feature */}
                  <label 
                    className="res-banner" 
                    style={{ 
                      backgroundImage: `url('${reservation.img || "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQtTe-vPL0Z7hlwWUG6Tast9H5f8JhqpFVlXHYs8Zm4IBP0jjyklaI9nM_I&s=10"}')`,
                      backgroundSize: "cover",
                      backgroundPosition: "center"
                    }}
                  >
                    <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} />
                    <div className="res-banner-overlay"></div>
                    
                    <div className="upload-prompt">
                      <i className="fa-solid fa-cloud-arrow-up"></i>
                      <span>Tap to Upload Image</span>
                    </div>

                    {/* Participants stack */}
                    <div className="participants-badge">
                      <div className="avatar-stack">
                        <img src="images/05.jpg" alt="Guest 1" />
                        <img src="images/06.jpg" alt="Guest 2" />
                        <img src="images/07.jpg" alt="Guest 3" />
                      </div>
                      <span className="participants-text">
                        +{Math.max(0, (reservation.contactList?.length || reservation.invitedUsers?.length || 10) - 3)} invited
                      </span>
                    </div>
                  </label>

                  <div className="event-info-section">
                    <h2 className="event-title">{reservation.eventTitle}</h2>
                    <h3 className="event-details-label">Event Details</h3>
                    <p className="event-description">
                      {reservation.rawItem?.description || "No description provided."}
                    </p>

                    {/* Date and Time Row */}
                    <div className="info-row">
                      <div className="icon-wrapper">
                        <i className="fa-regular fa-calendar-days"></i>
                      </div>
                      <div className="row-content">
                        <div className="row-title">{reservation.eventDate}</div>
                        <div className="row-subtitle">
                          {reservation.eventStartTime} - {reservation.eventEndTime}
                        </div>
                      </div>
                      <button className="row-action-btn" onClick={() => alert("Navigate to event modifier")}>Update</button>
                    </div>

                    {/* Venue Row */}
                    <div className="info-row">
                      <div className="icon-wrapper">
                        <i className="fa-solid fa-location-dot"></i>
                      </div>
                      <div className="row-content">
                        <div className="row-title">{reservation.venue?.split(" - ")?.[0] || "Venue"}</div>
                        <div className="row-subtitle">
                          {reservation.venue?.split(" - ")?.[1] || reservation.venue || "TBD"}
                        </div>
                      </div>
                    </div>

                    {/* Organizer Row */}
                    <div className="info-row">
                      <div className="icon-wrapper" style={{ background: "transparent" }}>
                        <img 
                          src={profile?.profilePic || "images/05.jpg"} 
                          alt="Organizer Avatar" 
                          style={{ width: "44px", height: "44px", borderRadius: "50%", objectFit: "cover" }} 
                        />
                      </div>
                      <div className="row-content">
                        <div className="row-title" style={{ fontSize: "12px", color: "#888", fontWeight: "500", textTransform: "uppercase" }}>Organizer</div>
                        <div className="row-title">{reservation.organizerName}</div>
                        <div className="row-subtitle">
                          Mobile: {reservation.organizerPhone || "-"}
                        </div>
                      </div>
                      <button className="row-action-btn" style={{ background: "#5b5fc7" }}>Attend.</button>
                    </div>

                    {/* Can Bring Additional Guest Row */}
                    <div className="info-row">
                      <div className="icon-wrapper">
                        <i className="fa-solid fa-user-plus"></i>
                      </div>
                      <div className="row-content">
                        <div className="row-title">Can Bring Additional Guest</div>
                        <div className="row-subtitle">{reservation.rawItem?.bringaLongGuest || "No"}</div>
                      </div>
                    </div>

                    {/* RSVP Row */}
                    <div className="info-row">
                      <div className="icon-wrapper">
                        <i className="fa-regular fa-envelope"></i>
                      </div>
                      <div className="row-content">
                        <div className="row-title">RSVP</div>
                        <div className="row-subtitle">{reservation.rawItem?.rvsp || "No"}</div>
                      </div>
                    </div>
                  </div>

                  {/* Selected Summary Section */}
                  <div className="summary-section">
                    <h4 className="section-heading">Selected Summary</h4>
                    
                    <div className="summary-item">
                      <div className="summary-label">Invites</div>
                      <div className="summary-value">
                        {reservation.contactList && reservation.contactList.length > 0
                          ? reservation.contactList.map(c => c.fullName || c.name).join(", ")
                          : reservation.invitedUsers && reservation.invitedUsers.length > 0
                            ? reservation.invitedUsers.map(u => u.userId?.fullName || u.userId?.name || u.email).filter(Boolean).join(", ")
                            : "None"}
                      </div>
                    </div>

                    <div className="summary-item">
                      <div className="summary-label">Selected Notes</div>
                      <div className="summary-value">
                        {reservation.rawItem?.noteId && reservation.rawItem.noteId.length > 0
                          ? reservation.rawItem.noteId.map(n => n.notes || n).join(", ")
                          : "None"}
                      </div>
                    </div>

                    <div className="summary-item">
                      <div className="summary-label">Gift registry URL</div>
                      <div className="summary-value">
                        {reservation.rawItem?.registryUrl
                          ? (reservation.rawItem.registryUrl.registryName || reservation.rawItem.registryUrl.registryUrtl || "None")
                          : "None"}
                      </div>
                    </div>

                    <div className="summary-item">
                      <div className="summary-label">Adult seats requested</div>
                      <div className="summary-value">
                        {reservation.rawItem?.makeReservation?.adultCount || reservation.rawItem?.adultCount || "35"}
                      </div>
                    </div>
                  </div>

                  {/* Additional Services Section */}
                  <div className="services-section">
                    <h4 className="services-heading">Additional Services</h4>
                    {getMappedServices().map((srv, index) => {
                      const statusInfo = getServiceStatusDisplay(srv.status);
                      return (
                        <div className="service-card" key={index}>
                          <img src={srv.img} alt={srv.name} className="service-img" />
                          <div className="service-details">
                            <div className="service-name">{srv.name}</div>
                            <div className="service-status" style={{ color: statusInfo.color }}>
                              {statusInfo.text}
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
