"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { authService } from "../services/authService";
import { getReservationDetailsByIdApi } from "../services/reservationApi";
import Swal from "sweetalert2";

export default function ReservationDetailsPage() {
  const [profile, setProfile] = useState(null);
  const [reservation, setReservation] = useState(null);
  const [detailsLoaded, setDetailsLoaded] = useState(false);
  const [showGuestsModal, setShowGuestsModal] = useState(false);

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
      totalPaid: totalAmount || 0,
      tableNumber: resObj.instruction || "-",
      organizerName: item.eventcreator?.fullName || item.userId?.fullName || merchantObj.serviceName || "Organizer",
      organizerEmail: item.eventcreator?.email || item.userId?.email || merchantObj.email || "-",
      organizerPhone: item.eventcreator?.mobile || item.userId?.mobile || merchantObj.mobile || merchantObj.phone || "-",
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
    const rawServices = reservation.rawItem?.additionalServices || reservation.rawItem?.makeReservation?.additionalServices || reservation.rawItem?.additionalService || [];
    
    const serviceMap = {
      // Map by database Object IDs
      "686fb723d46e9740ee8277f4": { name: "Catering", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSH7m3B140fW-LwR39L85aYkS9m5W28G6Fp5g&s" },
      "686fb6edd46e9740ee8277f0": { name: "Catering", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSH7m3B140fW-LwR39L85aYkS9m5W28G6Fp5g&s" },
      "686fb7bad46e9740ee8277f8": { name: "Decoration & Lighting", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRz-8Z4-sH0w9T11n1U29Fj8a_U19v1K0G_1g&s" },
      "686fb714d46e9740ee8277f2": { name: "Furniture Rental", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQtg-K5_J_9L9Z11o1R19Tj8a_V19v1K0G_2g&s" },
      "686fb788d46e9740ee8277f6": { name: "Music & DJ", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTz-8Z4-sH0w9T11n1U29Fj8a_U19v1K0G_3g&s" },
      "686fb777d46e9740ee8277f5": { name: "Photography", img: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=150" },

      // Map by lowercased servicesName strings
      "catering": { name: "Catering", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSH7m3B140fW-LwR39L85aYkS9m5W28G6Fp5g&s" },
      "decoration & lighting": { name: "Decoration & Lighting", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRz-8Z4-sH0w9T11n1U29Fj8a_U19v1K0G_1g&s" },
      "furniture rental": { name: "Furniture Rental", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQtg-K5_J_9L9Z11o1R19Tj8a_V19v1K0G_2g&s" },
      "music & dj": { name: "Music & DJ", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTz-8Z4-sH0w9T11n1U29Fj8a_U19v1K0G_3g&s" },
      "photography": { name: "Photography", img: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=150" },
    };

    if (rawServices.length === 0) {
      return [];
    }

    return rawServices.map((srv) => {
      let name = "Additional Service";
      let apiImage = null;

      if (srv.serviceId && typeof srv.serviceId === "object") {
        name = srv.serviceId.servicesName || srv.serviceId.serviceName || "Additional Service";
        apiImage = srv.serviceId.image || srv.serviceId.servicesImage || srv.serviceId.bannerImage || srv.serviceId.thumbnail;
      } else if (typeof srv.serviceId === "string") {
        name = srv.serviceId;
      }

      const srvStatus = srv.status || "pending";
      const key = name.toLowerCase();
      
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(name);
      const displayName = isObjectId ? "Additional Service" : name;

      const defaultImg = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQtTe-vPL0Z7hlwWUG6Tast9H5f8JhqpFVlXHYs8Zm4IBP0jjyklaI9nM_I&s";
      const info = serviceMap[key] || { 
        name: displayName, 
        img: defaultImg
      };

      const finalImg = apiImage || info.img || defaultImg;

      return {
        ...info,
        img: finalImg,
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

  const guestsList = reservation.contactList?.length > 0 
    ? reservation.contactList 
    : (reservation.invitedUsers || []).map(u => u.userId).filter(Boolean);
  const totalInvited = guestsList.length;
  const displayGuests = guestsList.slice(0, 3);

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
                  .web-res-card {
                    background: #fff;
                    border-radius: 16px;
                    overflow: hidden;
                    border: 1px solid #eef0f5;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.03);
                    font-family: 'Outfit', sans-serif;
                    margin-bottom: 30px;
                  }
                  .web-banner {
                    height: 260px;
                    background-size: cover;
                    background-position: center;
                    position: relative;
                    cursor: pointer;
                    display: flex;
                    flex-direction: column;
                    justify-content: flex-end;
                    padding: 24px;
                    border-bottom: 1px solid #e5e7eb;
                  }
                  .web-banner-overlay {
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.6));
                    z-index: 1;
                  }
                  .web-upload-prompt {
                    position: absolute;
                    top: 20px;
                    right: 20px;
                    z-index: 2;
                    background: rgba(0, 0, 0, 0.5);
                    padding: 8px 16px;
                    border-radius: 20px;
                    color: #fff;
                    font-size: 13px;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    transition: background 0.2s;
                  }
                  .web-upload-prompt:hover {
                    background: rgba(0, 0, 0, 0.7);
                  }
                  .web-participants-badge {
                    position: relative;
                    z-index: 2;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    background: rgba(255, 255, 255, 0.95);
                    padding: 8px 18px;
                    border-radius: 30px;
                    width: fit-content;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
                    cursor: pointer;
                  }
                  .web-avatar-stack {
                    display: flex;
                    align-items: center;
                  }
                  .web-avatar-stack img {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    border: 2px solid #fff;
                    margin-left: -10px;
                    object-fit: cover;
                  }
                  .web-avatar-stack img:first-child {
                    margin-left: 0;
                  }
                  .web-participants-text {
                    font-size: 13.5px;
                    font-weight: 700;
                    color: #3e56f0;
                  }
                  .web-content-grid {
                    padding: 30px;
                  }
                  .web-event-title {
                    font-size: 32px;
                    font-weight: 800;
                    color: #0c1b33;
                    margin-bottom: 8px;
                  }
                  .web-details-label {
                    font-size: 18px;
                    font-weight: 700;
                    color: #111;
                    margin-top: 24px;
                    margin-bottom: 12px;
                    border-bottom: 2px solid #f1f3f7;
                    padding-bottom: 8px;
                  }
                  .web-description {
                    font-size: 15px;
                    color: #555;
                    line-height: 1.6;
                    white-space: pre-wrap;
                  }
                  .web-info-row {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 16px 0;
                    border-bottom: 1px solid #f8fafc;
                  }
                  .web-info-row:last-child {
                    border-bottom: none;
                  }
                  .web-icon-wrapper {
                    width: 46px;
                    height: 46px;
                    border-radius: 12px;
                    background: #eef0ff;
                    color: #3e56f0;
                    display: grid;
                    place-items: center;
                    font-size: 20px;
                    flex-shrink: 0;
                  }
                  .web-row-content {
                    flex-grow: 1;
                  }
                  .web-row-title {
                    font-size: 15px;
                    font-weight: 700;
                    color: #111;
                  }
                  .web-row-subtitle {
                    font-size: 13px;
                    color: #666;
                    margin-top: 2px;
                  }
                  .web-row-action-btn {
                    background: #5b5fc7;
                    color: #fff;
                    border: none;
                    border-radius: 20px;
                    padding: 8px 20px;
                    font-size: 13px;
                    font-weight: 600;
                    cursor: pointer;
                    box-shadow: 0 4px 10px rgba(91, 95, 199, 0.15);
                    transition: background 0.2s;
                  }
                  .web-row-action-btn:hover {
                    background: #4a4db5;
                  }
                  .web-sidebar-box {
                    background: #fafbfe;
                    border: 1px solid #eef0f5;
                    border-radius: 16px;
                    padding: 24px;
                    margin-bottom: 24px;
                  }
                  .web-sidebar-heading {
                    font-size: 18px;
                    font-weight: 800;
                    color: #111;
                    margin-bottom: 18px;
                    border-bottom: 2px solid #eef0f5;
                    padding-bottom: 8px;
                  }
                  .web-summary-item {
                    margin-bottom: 16px;
                  }
                  .web-summary-item:last-child {
                    margin-bottom: 0;
                  }
                  .web-summary-label {
                    font-size: 14.5px;
                    font-weight: 700;
                    color: #111;
                    margin-bottom: 4px;
                  }
                  .web-summary-value {
                    font-size: 13.5px;
                    color: #555;
                    line-height: 1.5;
                  }
                  .web-services-heading {
                    font-size: 18px;
                    font-weight: 800;
                    color: #ef4444;
                    margin-bottom: 18px;
                    border-bottom: 2px solid #fee2e2;
                    padding-bottom: 8px;
                  }
                  .web-service-card {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 12px 16px;
                    border-radius: 12px;
                    border: 1px solid #eef0f5;
                    background: #fff;
                    margin-bottom: 12px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.01);
                  }
                  .web-service-card:last-child {
                    margin-bottom: 0;
                  }
                  .web-service-img {
                    width: 50px;
                    height: 50px;
                    border-radius: 10px;
                    object-fit: cover;
                  }
                  .web-service-name {
                    font-size: 14.5px;
                    font-weight: 700;
                    color: #111;
                  }
                  .web-service-status {
                    font-size: 12.5px;
                    font-weight: 600;
                    margin-top: 2px;
                  }
                `}</style>

                <div className="web-res-card">
                  {/* Banner Image with Upload Feature */}
                  <label 
                    className="web-banner" 
                    style={{ 
                      backgroundImage: `url('${reservation.img || "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQtTe-vPL0Z7hlwWUG6Tast9H5f8JhqpFVlXHYs8Zm4IBP0jjyklaI9nM_I&s=10"}')`,
                      backgroundSize: "cover",
                      backgroundPosition: "center"
                    }}
                  >
                    <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} />
                    <div className="web-banner-overlay"></div>
                    
                    <div className="web-upload-prompt">
                      <i className="fa-solid fa-cloud-arrow-up"></i>
                      <span>Tap to Upload Image</span>
                    </div>

                     {/* Dynamic Participants stack */}
                     {totalInvited > 0 && (
                       <div 
                         className="web-participants-badge"
                         onClick={(e) => {
                           e.preventDefault();
                           e.stopPropagation();
                           setShowGuestsModal(true);
                         }}
                       >
                         <div className="web-avatar-stack">
                           {displayGuests.map((g, idx) => {
                             const name = g.fullName || g.name || "Guest";
                             const initial = name.charAt(0).toUpperCase();
                             return (
                               <div 
                                 key={idx} 
                                 style={{ 
                                   width: "32px", 
                                   height: "32px", 
                                   borderRadius: "50%", 
                                   background: ["#3e56f0", "#22c55e", "#ff9f43", "#ef4444"][idx % 4], 
                                   color: "#fff", 
                                   display: "grid", 
                                   placeItems: "center", 
                                   fontSize: "12px", 
                                   fontWeight: "700",
                                   border: "2px solid #fff",
                                   marginLeft: idx > 0 ? "-10px" : "0",
                                   position: "relative",
                                   zIndex: 4 - idx
                                 }}
                               >
                                 {initial}
                               </div>
                             );
                           })}
                         </div>
                         <span className="web-participants-text">
                           {totalInvited > 3 ? `+${totalInvited - 3} invited` : `${totalInvited} invited`}
                         </span>
                       </div>
                     )}
                   </label>

                  <div className="web-content-grid">
                    <div className="row g-4">
                      {/* Left Main details column (col-lg-7) */}
                      <div className="col-lg-7">
                        <h2 className="web-event-title">{reservation.eventTitle}</h2>
                        
                        <h3 className="web-details-label" style={{ marginTop: "16px" }}>Event Details</h3>
                        <p className="web-description">
                          {reservation.rawItem?.description || "No description provided."}
                        </p>

                        <h3 className="web-details-label">Scheduling & Location</h3>

                        {/* Date and Time Row */}
                        <div className="web-info-row">
                          <div className="web-icon-wrapper">
                            <i className="fa-regular fa-calendar-days"></i>
                          </div>
                          <div className="web-row-content">
                            <div className="web-row-title">{reservation.eventDate}</div>
                            <div className="web-row-subtitle">
                              {reservation.eventStartTime} - {reservation.eventEndTime}
                            </div>
                          </div>
                          <button className="web-row-action-btn" onClick={() => Swal.fire({
                            title: "Update Event",
                            text: "Navigate to event modifier",
                            icon: "info",
                            confirmButtonColor: "#3e56f0"
                          })}>Update</button>
                        </div>

                        {/* Venue Row */}
                        <div className="web-info-row">
                          <div className="web-icon-wrapper">
                            <i className="fa-solid fa-location-dot"></i>
                          </div>
                          <div className="web-row-content">
                            <div className="web-row-title">{reservation.venue?.split(" - ")?.[0] || "Venue"}</div>
                            <div className="web-row-subtitle">
                              {reservation.venue?.split(" - ")?.[1] || reservation.venue || "TBD"}
                            </div>
                          </div>
                        </div>

                        {/* Organizer Row with Dynamic Avatar */}
                        <div className="web-info-row">
                          <div className="web-icon-wrapper" style={{ background: "transparent" }}>
                            {reservation.organizerName ? (
                              <div 
                                style={{ 
                                  width: "44px", 
                                  height: "44px", 
                                  borderRadius: "50%", 
                                  background: "#3e56f0", 
                                  color: "#fff", 
                                  display: "grid", 
                                  placeItems: "center", 
                                  fontSize: "16px", 
                                  fontWeight: "700" 
                                }}
                              >
                                {reservation.organizerName.charAt(0).toUpperCase()}
                              </div>
                            ) : (
                              <div className="web-icon-wrapper">
                                <i className="fa-solid fa-user"></i>
                              </div>
                            )}
                          </div>
                          <div className="web-row-content">
                            <div className="web-row-title" style={{ fontSize: "12px", color: "#888", fontWeight: "500", textTransform: "uppercase" }}>Organizer</div>
                            <div className="web-row-title">{reservation.organizerName}</div>
                            <div className="web-row-subtitle">
                              Mobile: {reservation.organizerPhone || "-"}
                            </div>
                          </div>
                          <button className="web-row-action-btn" style={{ background: "#5b5fc7" }}>Attend.</button>
                        </div>

                        {/* Can Bring Additional Guest Row */}
                        <div className="web-info-row">
                          <div className="web-icon-wrapper">
                            <i className="fa-solid fa-user-plus"></i>
                          </div>
                          <div className="web-row-content">
                            <div className="web-row-title">Can Bring Additional Guest</div>
                            <div className="web-row-subtitle">{reservation.rawItem?.bringaLongGuest || "No"}</div>
                          </div>
                        </div>

                        {/* RSVP Row */}
                        <div className="web-info-row">
                          <div className="web-icon-wrapper">
                            <i className="fa-regular fa-envelope"></i>
                          </div>
                          <div className="web-row-content">
                            <div className="web-row-title">RSVP</div>
                            <div className="web-row-subtitle">{reservation.rawItem?.rvsp || "No"}</div>
                          </div>
                        </div>
                      </div>

                      {/* Right Sidebar Summary column (col-lg-5) */}
                      <div className="col-lg-5">
                        {/* Selected Summary Section */}
                        <div className="web-sidebar-box">
                          <h4 className="web-sidebar-heading">Selected Summary</h4>
                          
                          <div className="web-summary-item">
                            <div className="web-summary-label">Invites</div>
                            <div className="web-summary-value">
                              {reservation.contactList && reservation.contactList.length > 0
                                ? reservation.contactList.map(c => c.fullName || c.name).join(", ")
                                : reservation.invitedUsers && reservation.invitedUsers.length > 0
                                  ? reservation.invitedUsers.map(u => u.userId?.fullName || u.userId?.name || u.email).filter(Boolean).join(", ")
                                  : "None"}
                            </div>
                          </div>

                          <div className="web-summary-item">
                            <div className="web-summary-label">Selected Notes</div>
                            <div className="web-summary-value">
                              {reservation.rawItem?.noteId && reservation.rawItem.noteId.length > 0
                                ? reservation.rawItem.noteId.map(n => n.notes || n).join(", ")
                                : "None"}
                            </div>
                          </div>

                          <div className="web-summary-item">
                            <div className="web-summary-label">Gift registry URL</div>
                            <div className="web-summary-value">
                              {reservation.rawItem?.registryUrl
                                ? (reservation.rawItem.registryUrl.registryName || reservation.rawItem.registryUrl.registryUrtl || "None")
                                : "None"}
                            </div>
                          </div>

                          <div className="web-summary-item">
                            <div className="web-summary-label">Adult seats requested</div>
                            <div className="web-summary-value">
                              {reservation.rawItem?.makeReservation?.adultCount || reservation.rawItem?.adultCount || "0"}
                            </div>
                          </div>
                        </div>

                        {/* Dynamic Additional Services Section */}
                        {getMappedServices().length > 0 && (
                          <div className="web-sidebar-box">
                            <h4 className="web-services-heading">Additional Services</h4>
                            {getMappedServices().map((srv, index) => {
                              const statusInfo = getServiceStatusDisplay(srv.status);
                              return (
                                <div className="web-service-card" key={index}>
                                  <img src={srv.img} alt={srv.name} className="web-service-img" />
                                  <div className="service-details">
                                    <div className="web-service-name">{srv.name}</div>
                                    <div className="web-service-status" style={{ color: statusInfo.color }}>
                                      {statusInfo.text}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
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

      {/* Invited Guests list Modal */}
      {showGuestsModal && (
        <div className="modal fade show d-block" tabIndex="-1" role="dialog" style={{ background: "rgba(12, 27, 51, 0.6)", backdropFilter: "blur(4px)", zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered" role="document">
            <div className="modal-content border-0 rounded-4 shadow-lg">
              <div className="modal-header border-bottom-0 pb-0 pt-4 px-4 d-flex align-items-center justify-content-between">
                <h5 className="modal-title fw-bold text-dark fs-4">Invited Guests</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setShowGuestsModal(false)}
                  aria-label="Close"
                ></button>
              </div>
              <div className="modal-body px-4 py-3" style={{ maxHeight: "400px", overflowY: "auto" }}>
                <p className="text-muted small mb-4">A list of all users invited to this reservation request.</p>
                <div className="d-flex flex-column gap-3">
                  {guestsList.map((g, idx) => {
                    const rawGuest = g;
                    const name = rawGuest.fullName || rawGuest.name || rawGuest.email || (typeof rawGuest === "string" ? rawGuest : "Guest");
                    const initial = typeof name === "string" ? name.charAt(0).toUpperCase() : "G";
                    const subtitle = rawGuest.mobile || rawGuest.phone || rawGuest.email || "";
                    const displaySub = subtitle !== name ? subtitle : "";
                    
                    return (
                      <div key={idx} className="d-flex align-items-center gap-3 p-2 rounded-3 hover-bg-light border border-light">
                        <div 
                          style={{ 
                            width: "42px", 
                            height: "42px", 
                            borderRadius: "50%", 
                            background: ["#3e56f0", "#22c55e", "#ff9f43", "#ef4444"][idx % 4], 
                            color: "#fff", 
                            display: "grid", 
                            placeItems: "center", 
                            fontSize: "16px", 
                            fontWeight: "700" 
                          }}
                        >
                          {initial}
                        </div>
                        <div className="flex-grow-1 min-w-0">
                          <h6 className="fw-bold mb-0 text-dark text-truncate">{name}</h6>
                          {displaySub && <span className="text-muted small text-truncate d-block">{displaySub}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="modal-footer border-top-0 pt-0 pb-4 px-4">
                <button 
                  type="button" 
                  className="btn btn-secondary rounded-pill px-4 w-100 fw-bold py-2" 
                  onClick={() => setShowGuestsModal(false)}
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
