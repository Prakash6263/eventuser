"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { getEventGroupChatApi } from "../services/chatApi";
import { getEventMediaApi } from "../services/eventApi";

export default function EventsPage() {
  const router = useRouter();

  // Dynamic state
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [token, setToken] = useState(null);

  // Modal states for simulated actions
  const [activeChatEvent, setActiveChatEvent] = useState(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatGroupData, setChatGroupData] = useState(null);
  const [chatMode, setChatMode] = useState("members"); // "members" or "conversation"
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");

  const [activeGalleryEvent, setActiveGalleryEvent] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  // Filters state variables (date, myevent and status)
  const [filterMyEvent, setFilterMyEvent] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [galleryLoading, setGalleryLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setToken(localStorage.getItem("user_token"));
    }
  }, []);

  const fetchFilteredEvents = async (selectedMyEvent, selectedDate, selectedStatus) => {
    const activeToken = typeof window !== "undefined" ? localStorage.getItem("user_token") : null;
    if (!activeToken) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);

      // Build query parameters for Events API
      const queryParams = new URLSearchParams();
      
      if (selectedMyEvent) {
        queryParams.append("myevent", selectedMyEvent); // "true" or "false"
      }
      
      if (selectedDate) {
        queryParams.append("date", selectedDate); // YYYY-MM-DD
      }

      const res = await fetch(`https://eventuna.com/api/event/events?${queryParams.toString()}`, {
        headers: {
          "Authorization": `Bearer ${activeToken}`
        }
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const json = await res.json();
      if (json.status && Array.isArray(json.data)) {
        let mapped = json.data.map((evt) => {
          let formattedMonthDay = "";
          let rawDateString = evt.eventDate || "";
          try {
            if (evt.eventDate) {
              const parts = evt.eventDate.split('-');
              if (parts.length === 3) {
                const day = parts[0];
                const monthIndex = parseInt(parts[1]) - 1;
                const year = parts[2];
                const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                const monthStr = monthNames[monthIndex] || parts[1];
                formattedMonthDay = `${day} ${monthStr}`;
                rawDateString = `${year}-${parts[1].padStart(2, '0')}-${day.padStart(2, '0')}`;
              } else {
                const d = new Date(evt.eventDate);
                if (!isNaN(d.getTime())) {
                  formattedMonthDay = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  rawDateString = d.toISOString().split('T')[0];
                } else {
                  formattedMonthDay = evt.eventDate;
                }
              }
            }
          } catch (e) {
            formattedMonthDay = evt.eventDate || "";
          }

          let locationStr = "Location TBD";
          if (evt.serviceLocationId) {
            const addrName = evt.serviceLocationId.addressName || "";
            const addr = evt.serviceLocationId.address || "";
            locationStr = addrName && addr ? `${addrName} - ${addr}` : (addr || addrName || "At a participating restaurant");
          } else if (evt.placeId?.preferences) {
            locationStr = evt.placeId.preferences;
          }

          return {
            id: evt._id,
            title: evt.eventTitle || "Untitled Event",
            category: evt.eventType?.eventType || evt.eventCategory?.category || "Celebration",
            location: locationStr,
            img: evt.image || "https://eventuna.com/api/s3-media?key=event%2F1783417395237-960311026.jpg",
            date: formattedMonthDay,
            filterDateStr: rawDateString,
            time: evt.eventStartTime || "",
            status: evt.myInvitationStatus || evt.status || evt.eventCurrentStatus || "pending",
            rawEvent: evt
          };
        });

        if (selectedStatus) {
          mapped = mapped.filter((evt) => evt.status.toLowerCase() === selectedStatus.toLowerCase());
        }

        setEvents(mapped);
      } else {
        setError(json.message || "Failed to load events");
      }
    } catch (err) {
      setError(err.message || "Network error loading events");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFilteredEvents("", "", "");
  }, [token]);

  const handleApplyFilters = () => {
    fetchFilteredEvents(filterMyEvent, filterDate, filterStatus);
  };

  const handleResetFilters = () => {
    setFilterMyEvent("");
    setFilterDate("");
    setFilterStatus("");
    fetchFilteredEvents("", "", "");
  };

  const handleViewEventDetails = (evt) => {
    const rawEvent = evt.rawEvent;
    let selectedDate = 15;
    let month = 6;
    try {
      if (rawEvent.eventDate) {
        const d = new Date(rawEvent.eventDate);
        selectedDate = d.getDate();
        month = d.getMonth();
      }
    } catch (e) {
      console.error("Error parsing date:", e);
    }

    const selectedGuests = (rawEvent.invitedUsers || []).map((guest, idx) => {
      return {
        id: guest.userId?._id || idx.toString(),
        name: guest.userId?.fullName || "Guest",
        profilePic: guest.userId?.profilePic || null,
        status: guest.status || "pending",
        email: guest.userId?.email || null,
        mobile: guest.userId?.mobile || null,
      };
    });

    const detailEvent = {
      eventTitle: rawEvent.eventTitle || "Untitled Event",
      invitationMessage: rawEvent.description || "No description provided.",
      eventImage: rawEvent.image || null,
      selectedDate: selectedDate,
      month: month,
      startTime: rawEvent.eventStartTime || "",
      endTime: rawEvent.eventEndTime || "",
      selectedRestaurant: rawEvent.merchantId?._id || rawEvent.serviceLocationId?.merchantId?._id || "",
      selectedGuests: selectedGuests,
      bringGuests: rawEvent.bringaLongGuest || "No",
      maxGuests: rawEvent.bringaLongNumber || "0",
      rsvp: rawEvent.rvsp || "No",
      rsvpBy: rawEvent.eventDate || "",
      selectedNotes: (rawEvent.noteId || []).map((n) => n.notes || n),
      registryUrl: rawEvent.registryUrl || "",
      place: rawEvent.placeId?.preferences || "At a participating restaurant",
      selectedLocation: rawEvent.serviceLocationId
        ? {
          addressName: rawEvent.serviceLocationId.addressName || "",
          address: rawEvent.serviceLocationId.address || "",
        }
        : null,
      category: rawEvent.eventCategory?.category || "",
      eventType: rawEvent.eventType?.eventType || "",
      organizerName: rawEvent.eventcreator?.fullName || "Organizer",
      eventAttendanceQr: rawEvent.eventAttendanceQr || null,
    };

    localStorage.setItem("eventuna-latest-event", JSON.stringify(detailEvent));
    router.push("/event-details");
  };

  // Group Chat Fetch & Simulation Flow
  const handleOpenChat = async (evt, e) => {
    e.stopPropagation();
    setActiveChatEvent(evt);
    setChatLoading(true);
    setChatMode("members");
    setChatGroupData(null);

    try {
      const res = await getEventGroupChatApi(evt.id);
      if (res && res.status && res.data) {
        setChatGroupData(res.data);
      }
    } catch (err) {
      console.error("Failed to retrieve live group chat:", err);
    } finally {
      setChatLoading(false);
    }

    // Populate simulated chat messages for the channel
    const guests = evt.rawEvent.contactList || [];
    const simulated = [
      {
        id: 1,
        sender: evt.rawEvent.eventcreator?.fullName || "Organizer",
        profilePic: evt.rawEvent.eventcreator?.profilePic,
        text: `Welcome everyone to "${evt.title}" group chat! Let me know if you need directions.`,
        time: "10:15 AM",
        isSelf: false
      },
      ...guests.slice(0, 2).map((g, index) => ({
        id: index + 2,
        sender: g.fullName || "Guest Partner",
        profilePic: g.profilePic,
        text: index === 0 ? "Looking forward to this! Count me in." : "Thanks for inviting! I will be attending.",
        time: "11:20 AM",
        isSelf: false
      }))
    ];
    setChatMessages(simulated);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const userMessage = {
      id: Date.now(),
      sender: "You",
      profilePic: null,
      text: newMessage,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSelf: true
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setNewMessage("");

    setTimeout(() => {
      const responses = [
        "Awesome!",
        "Thanks for the update!",
        "See you there!",
        "Perfect, sounds good!"
      ];
      const randomMsg = responses[Math.floor(Math.random() * responses.length)];
      const organizerName = activeChatEvent?.rawEvent.eventcreator?.fullName || "Organizer";
      
      const reply = {
        id: Date.now() + 1,
        sender: organizerName,
        profilePic: activeChatEvent?.rawEvent.eventcreator?.profilePic,
        text: randomMsg,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isSelf: false
      };
      setChatMessages((prev) => [...prev, reply]);
    }, 1200);
  };

  // Gallery Integration
  const handleOpenGallery = async (evt, e) => {
    e.stopPropagation();
    setActiveGalleryEvent(evt);
    setGalleryLoading(true);
    try {
      const res = await getEventMediaApi(evt.id);
      if (res && res.status && res.data && Array.isArray(res.data.media)) {
        const photos = res.data.media.map((m) => ({
          id: m._id,
          url: m.mediaUrl || m.thumbnailUrl || "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=600&q=80",
          thumbnailUrl: m.thumbnailUrl || "",
          description: m.caption || "Event venue view",
          mediaType: m.mediaType || "image"
        }));
        setActiveGalleryEvent({ ...evt, photos });
      } else {
        setActiveGalleryEvent({ ...evt, photos: [] });
      }
    } catch (err) {
      console.error("Failed to load event media from API:", err);
      setActiveGalleryEvent({ ...evt, photos: [] });
    } finally {
      setGalleryLoading(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name.trim().charAt(0).toUpperCase();
  };

  const getStatusBadge = (status = "") => {
    const s = status.toString().toLowerCase();
    if (s === "accepted" || s === "ongoingevent" || s === "ongoing" || s === "approved") {
      return <span className="badge bg-success-subtle text-success rounded-pill px-2.5 py-1.5 fw-semibold" style={{ fontSize: "11px" }}>Accepted</span>;
    }
    if (s === "pending" || s === "waiting for action" || s === "waiting") {
      return <span className="badge bg-warning-subtle text-warning rounded-pill px-2.5 py-1.5 fw-semibold" style={{ fontSize: "11px" }}>Pending</span>;
    }
    if (s === "rejected" || s === "cancelled") {
      return <span className="badge bg-danger-subtle text-danger rounded-pill px-2.5 py-1.5 fw-semibold" style={{ fontSize: "11px" }}>Cancelled</span>;
    }
    // Fallback display for dynamic status
    return <span className="badge bg-secondary-subtle text-secondary rounded-pill px-2.5 py-1.5 fw-semibold" style={{ fontSize: "11px", textTransform: "capitalize" }}>{status || "Pending"}</span>;
  };

  const getMemberInvitationStatus = (memberId) => {
    if (!activeChatEvent || !activeChatEvent.rawEvent) return null;
    if (Array.isArray(activeChatEvent.rawEvent.contactList)) {
      const match = activeChatEvent.rawEvent.contactList.find(c => c._id === memberId || c.userId === memberId);
      if (match && match.status) return match.status;
    }
    if (Array.isArray(activeChatEvent.rawEvent.invitedUsers)) {
      const match = activeChatEvent.rawEvent.invitedUsers.find(u => u.userId?._id === memberId || u.userId === memberId || u._id === memberId);
      if (match && match.status) return match.status;
    }
    return null;
  };

  return (
    <>
      <Header />
      <div className="wrapper">
        <div className="explore-events p-80 bg-light">
          <div className="container">
            {!token ? (
              <div className="row justify-content-center">
                <div className="col-lg-6 text-center py-5 bg-white rounded-4 border p-4 shadow-sm my-5">
                  <i className="bi bi-calendar-event text-primary mb-3" style={{ fontSize: "50px" }}></i>
                  <h4 className="fw-bold text-dark mb-2">Access Events Directory</h4>
                  <p className="text-muted small mb-4">Please log in to view dynamic invitations, join chats, and view photos.</p>
                  <Link href="/login" className="btn btn-primary rounded-pill px-5 py-2.5 fw-bold shadow">
                    Login Now
                  </Link>
                </div>
              </div>
            ) : (
              <div className="row">
                
                {/* Filter Sidebar - Left Column */}
                <div className="col-lg-3 col-md-4 mb-4">
                  <div className="sidebar bg-white p-4 border rounded-3 shadow-sm">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h5 className="fw-bold text-dark m-0">Filter Events</h5>
                      {(filterMyEvent || filterDate || filterStatus) && (
                        <button className="btn btn-link text-primary p-0 border-0 text-decoration-none small fw-bold" onClick={handleResetFilters}>
                          Reset All
                        </button>
                      )}
                    </div>
                    <hr className="mt-1 mb-4" />

                    <div className="mb-3">
                      <label className="filter-label mb-2 fw-semibold text-dark small">My Event</label>
                      <select 
                        className="form-select"
                        value={filterMyEvent}
                        onChange={(e) => setFilterMyEvent(e.target.value)}
                      >
                        <option value="">All</option>
                        <option value="true">True</option>
                        <option value="false">False</option>
                      </select>
                    </div>

                    <div className="mb-3">
                      <label className="filter-label mb-2 fw-semibold text-dark small">Date</label>
                      <input
                        type="date"
                        className="form-control"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                      />
                    </div>

                    <div className="mb-4">
                      <label className="filter-label mb-2 fw-semibold text-dark small">Status</label>
                      <select 
                        className="form-select"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                      >
                        <option value="">All</option>
                        <option value="accepted">Accepted</option>
                        <option value="pending">Pending</option>
                        <option value="not_invited">Not Invited</option>
                      </select>
                    </div>

                    <button className="btn btn-primary w-100 rounded-1 py-2.5 fw-bold" onClick={handleApplyFilters}>
                      Apply Filters
                    </button>
                  </div>
                </div>

                {/* Events Grid - Right Column */}
                <div className="col-lg-9 col-md-8">
                  {loading ? (
                    <div className="text-center py-5">
                      <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading events...</span>
                      </div>
                      <p className="text-muted mt-2 small">Loading events directory...</p>
                    </div>
                  ) : error ? (
                    <div className="alert alert-danger border-0 rounded-3 p-3 text-center my-3" role="alert">
                      <i className="bi bi-exclamation-triangle me-2"></i>
                      {error}
                    </div>
                  ) : events.length === 0 ? (
                    <div className="text-center py-5 border rounded-3 bg-white shadow-sm p-4">
                      <i className="bi bi-calendar-x fs-1 text-muted mb-3 d-block"></i>
                      <h5 className="text-dark fw-bold mb-1">No Events Found</h5>
                      <p className="text-muted small">No events match your criteria.</p>
                    </div>
                  ) : (
                    <div className="row">
                      {events.map((evt) => (
                        <div key={evt.id} className="col-lg-4 col-md-6 mb-4">
                          <div className="main-card h-100 d-flex flex-column justify-content-between overflow-hidden shadow-sm" style={{ cursor: "pointer" }} onClick={() => handleViewEventDetails(evt)}>
                            
                            {/* Card Media Header */}
                            <div>
                              <div className="event-thumbnail" style={{ height: "180px", overflow: "hidden", position: "relative" }}>
                                <div className="thumbnail-img h-100 w-100">
                                  <img src={evt.img} alt={evt.title} className="w-100 h-100" style={{ objectFit: "cover" }} />
                                </div>
                                <span className="bookmark-icon" title="Bookmark"></span>

                                {/* Floating Premium Chat and Gallery Action Buttons */}
                                <span 
                                  className="position-absolute d-flex align-items-center justify-content-center bg-white rounded-circle shadow-sm border" 
                                  style={{ left: "15px", top: "15px", width: "36px", height: "36px", cursor: "pointer", zIndex: 10 }}
                                  title="Event Chat"
                                  onClick={(e) => handleOpenChat(evt, e)}
                                >
                                  <i className="bi bi-chat-dots-fill text-primary" style={{ fontSize: "15px" }}></i>
                                </span>
                                <span 
                                  className="position-absolute d-flex align-items-center justify-content-center bg-white rounded-circle shadow-sm border" 
                                  style={{ left: "56px", top: "15px", width: "36px", height: "36px", cursor: "pointer", zIndex: 10 }}
                                  title="Event Gallery"
                                  onClick={(e) => handleOpenGallery(evt, e)}
                                >
                                  <i className="bi bi-images text-success" style={{ fontSize: "15px" }}></i>
                                </span>
                              </div>
                              
                              {/* Card Text Content */}
                              <div className="event-content p-3.5">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                  <span className="text-muted small fw-bold text-uppercase" style={{ fontSize: "10px", letterSpacing: "0.5px" }}>
                                    {evt.category}
                                  </span>
                                  {getStatusBadge(evt.status)}
                                </div>
                                <h5 className="event-title fw-bold text-dark m-0 mb-3" style={{ fontSize: "16px", lineHeight: "1.4" }}>
                                  {evt.title}
                                </h5>
                                <div className="featuredeventcardtext card-text align-items-start mb-0">
                                  <i className="fa fa-map text-muted me-2 mt-1"></i>
                                  <span className="featuredeventlocation text-muted small" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                                    {evt.location}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Card Footer */}
                            <div className="event-footer border-top p-3 bg-white mt-auto">
                              <div className="event-timing m-0">
                                <div className="publish-date w-100 d-flex justify-content-between align-items-center">
                                  <span>
                                    <i className="fa-solid fa-calendar-day me-2"></i>
                                    {evt.date}
                                  </span>
                                  <span className="dot">
                                    <i className="fa-solid fa-circle"></i>
                                  </span>
                                  <span>{evt.time}</span>
                                  <span className="publish-time ms-auto">
                                    <i className="fa-solid fa-clock me-2"></i>
                                    {evt.duration}
                                  </span>
                                </div>
                              </div>
                            </div>

                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dynamic Chat / Members Modal */}
      {activeChatEvent && (
        <div className="modal fade show d-block" style={{ background: "rgba(5, 2, 62, 0.6)", backdropFilter: "blur(4px)", zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable" style={{ maxWidth: "500px" }}>
            <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden" style={{ height: "550px" }}>
              
              {/* Header */}
              <div className="modal-header border-bottom py-3 px-4 d-flex justify-content-between align-items-center bg-primary text-white">
                <div className="d-flex align-items-center gap-2">
                  <div className="rounded-circle bg-white d-flex align-items-center justify-content-center" style={{ width: "35px", height: "35px" }}>
                    <i className="bi bi-chat-fill text-primary"></i>
                  </div>
                  <div>
                    <h6 className="fw-bold m-0 text-white line-clamp-1" style={{ fontSize: "15px", maxWidth: "260px" }}>
                      {activeChatEvent.title}
                    </h6>
                    <span className="small text-white opacity-75" style={{ fontSize: "10px" }}>
                      {chatMode === "members" ? "Group Members" : "Group Chat"}
                    </span>
                  </div>
                </div>
                <button 
                  type="button" 
                  className="btn text-white border-0 p-0" 
                  onClick={() => setActiveChatEvent(null)}
                  style={{ background: "none", fontSize: "18px", color: "#fff", cursor: "pointer", opacity: 0.8 }}
                >
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>

              {/* Modal Body */}
              <div className="modal-body p-3 bg-light d-flex flex-column gap-3 overflow-y-auto" style={{ height: "380px" }}>
                {chatLoading ? (
                  <div className="d-flex flex-column align-items-center justify-content-center h-100 py-5">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading group...</span>
                    </div>
                    <p className="text-muted mt-2 small">Retrieving group members...</p>
                  </div>
                ) : chatMode === "members" ? (
                  /* Render List of Members & Group Chat Button */
                  <div className="d-flex flex-column h-100 justify-content-between">
                    <div>
                      <h6 className="fw-bold text-dark mb-3" style={{ fontSize: "14px" }}>Members List</h6>
                      
                      <div className="d-flex flex-column gap-2">
                        {chatGroupData && Array.isArray(chatGroupData.members) && chatGroupData.members.length > 0 ? (
                          chatGroupData.members.map((member) => (
                            <div key={member._id} className="d-flex align-items-center justify-content-between p-2 bg-white rounded-3 border">
                              <div className="d-flex align-items-center gap-3 overflow-hidden">
                                <div className="flex-shrink-0">
                                  {member.profilePic ? (
                                    <img 
                                      src={member.profilePic} 
                                      alt={member.fullName} 
                                      className="rounded-circle object-fit-cover"
                                      style={{ width: "40px", height: "40px" }}
                                    />
                                  ) : (
                                    <div className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold" style={{ width: "40px", height: "40px", fontSize: "14px" }}>
                                      {getInitials(member.fullName)}
                                    </div>
                                  )}
                                </div>
                                <div className="overflow-hidden">
                                  <p className="text-dark fw-bold m-0 small text-truncate">{member.fullName}</p>
                                  <span className="text-muted small text-truncate d-block" style={{ fontSize: "11px" }}>{member.email}</span>
                                </div>
                              </div>
                              <div className="flex-shrink-0">
                                {getMemberInvitationStatus(member._id) === "accepted" && (
                                  <span className="badge bg-success-subtle text-success rounded-pill px-2.5 py-1.5 fw-bold text-uppercase" style={{ fontSize: "9px" }}>Accepted</span>
                                )}
                                {getMemberInvitationStatus(member._id) === "pending" && (
                                  <span className="badge bg-warning-subtle text-warning rounded-pill px-2.5 py-1.5 fw-bold text-uppercase" style={{ fontSize: "9px" }}>Pending</span>
                                )}
                                {getMemberInvitationStatus(member._id) === "not_invited" && (
                                  <span className="badge bg-secondary-subtle text-secondary rounded-pill px-2.5 py-1.5 fw-bold text-uppercase" style={{ fontSize: "9px" }}>Not Invited</span>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-4 bg-white rounded-3 border">
                            <i className="bi bi-people fs-4 text-muted mb-2 d-block"></i>
                            <p className="text-muted small mb-0">No active members joined yet.</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Group Chat Trigger Button */}
                    <button 
                      type="button" 
                      className="btn btn-primary w-100 rounded-pill py-2.5 fw-bold mt-4 shadow"
                      disabled={!chatGroupData?._id}
                      onClick={() => {
                        if (chatGroupData?._id) {
                          router.push(`/chat?chatId=${chatGroupData._id}&eventName=${encodeURIComponent(activeChatEvent.title)}&eventId=${activeChatEvent.id}`);
                        }
                      }}
                    >
                      <i className="bi bi-chat-text-fill me-2"></i>
                      Group Chat
                    </button>
                  </div>
                ) : (
                  /* Render Messages Conversation Grid */
                  <>
                    <button className="btn btn-sm btn-link text-primary align-self-start p-0 border-0 text-decoration-none fw-bold small mb-2" onClick={() => setChatMode("members")}>
                      <i className="bi bi-arrow-left me-1"></i> Back to Members
                    </button>
                    <div className="d-flex flex-column gap-3">
                      {chatMessages.map((msg) => (
                        <div key={msg.id} className={`d-flex gap-2.5 ${msg.isSelf ? "justify-content-end flex-row-reverse" : "justify-content-start"}`}>
                          {!msg.isSelf && (
                            <div className="flex-shrink-0">
                              <img 
                                src={msg.profilePic || "https://st2.depositphotos.com/1006318/5909/v/450/depositphotos_59094701-stock-illustration-businessman-profile-icon.jpg"} 
                                alt={msg.sender}
                                className="rounded-circle object-fit-cover"
                                style={{ width: "32px", height: "32px" }}
                              />
                            </div>
                          )}
                          <div style={{ maxWidth: "75%" }}>
                            {!msg.isSelf && <div className="text-muted fw-semibold mb-0.5 ps-1" style={{ fontSize: "11px" }}>{msg.sender}</div>}
                            <div className={`p-3 rounded-4 shadow-sm border-0 ${msg.isSelf ? "bg-primary text-white" : "bg-white text-dark"}`} style={{ fontSize: "13px", borderRadius: msg.isSelf ? "20px 20px 4px 20px" : "20px 20px 20px 4px" }}>
                              <p className="m-0" style={{ lineHeight: "1.4" }}>{msg.text}</p>
                            </div>
                            <div className={`text-muted mt-1 px-1 small ${msg.isSelf ? "text-end" : ""}`} style={{ fontSize: "10px" }}>{msg.time}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Message Input Footer (Conversation Mode Only) */}
              {chatMode === "conversation" && !chatLoading && (
                <form className="modal-footer p-2 bg-white border-top d-flex gap-2 align-items-center" onSubmit={handleSendMessage}>
                  <input 
                    type="text" 
                    className="form-control rounded-pill px-3 py-2" 
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    style={{ fontSize: "13px" }}
                  />
                  <button type="submit" className="btn btn-primary rounded-circle d-flex align-items-center justify-content-center" style={{ width: "38px", height: "38px" }}>
                    <i className="bi bi-send-fill" style={{ fontSize: "14px" }}></i>
                  </button>
                </form>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Photo Gallery Modal */}
      {activeGalleryEvent && (
        <div className="modal fade show d-block" style={{ background: "rgba(5, 2, 62, 0.7)", backdropFilter: "blur(4px)", zIndex: 1050 }}>
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable px-3">
            <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden" style={{ maxHeight: "85vh" }}>
              
              <div className="modal-header border-bottom py-3 px-4 d-flex justify-content-between align-items-center bg-dark text-white">
                <div>
                  <h5 className="modal-title fw-bold text-white m-0" style={{ fontSize: "18px" }}>
                    {activeGalleryEvent.title} Media
                  </h5>
                  <p className="text-white opacity-75 small m-0 mt-0.5" style={{ fontSize: "11px" }}>Browse event venue photos and albums</p>
                </div>
                <button 
                  type="button" 
                  className="btn text-white border-0 p-0" 
                  onClick={() => {
                    setActiveGalleryEvent(null);
                    setSelectedPhoto(null);
                  }}
                  style={{ background: "none", fontSize: "18px", color: "#fff", cursor: "pointer", opacity: 0.8 }}
                >
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>

              <div className="modal-body p-4 bg-light overflow-y-auto">
                {galleryLoading ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading media...</span>
                    </div>
                    <p className="text-muted mt-2 small">Loading event gallery...</p>
                  </div>
                ) : selectedPhoto ? (
                  /* Lightbox detail view */
                  <div className="text-center">
                    <button className="btn btn-sm btn-secondary mb-3 rounded-pill px-3" onClick={() => setSelectedPhoto(null)}>
                      <i className="bi bi-arrow-left me-1"></i> Back to Gallery
                    </button>
                    <div className="bg-dark rounded-4 p-2 overflow-hidden shadow-inner d-flex align-items-center justify-content-center" style={{ minHeight: "300px", maxHeight: "450px" }}>
                      {selectedPhoto.mediaType === "video" ? (
                        <video 
                          src={selectedPhoto.url} 
                          controls 
                          autoPlay 
                          className="w-100 rounded-3" 
                          style={{ objectFit: "contain", maxHeight: "430px" }}
                        />
                      ) : (
                        <img 
                          src={selectedPhoto.url} 
                          alt="Selected Album" 
                          className="w-100 rounded-3" 
                          style={{ objectFit: "contain", maxHeight: "430px" }}
                        />
                      )}
                    </div>
                    {selectedPhoto.description && (
                      <p className="text-dark fw-medium mt-3 m-0 small">{selectedPhoto.description}</p>
                    )}
                  </div>
                ) : activeGalleryEvent.photos.length === 0 ? (
                  <div className="text-center py-5">
                    <i className="bi bi-images fs-2 text-muted mb-2 d-block"></i>
                    <p className="text-muted mb-0 small">No media uploaded yet for this event.</p>
                  </div>
                ) : (
                  /* Grid view */
                  <div className="row g-3">
                    {activeGalleryEvent.photos.map((photo, i) => (
                      <div key={i} className="col-md-4 col-sm-6 col-12">
                        <div 
                          className="card border-0 shadow-sm rounded-3 overflow-hidden position-relative bg-white p-1.5 shadow-hover"
                          style={{ cursor: "pointer" }}
                          onClick={() => setSelectedPhoto(photo)}
                        >
                          <div className="position-relative w-100 rounded-2 overflow-hidden" style={{ height: "140px" }}>
                            {photo.mediaType === "video" ? (
                              <video 
                                src={photo.url} 
                                className="w-100 h-100" 
                                style={{ objectFit: "cover" }} 
                                preload="metadata" 
                                muted 
                                playsInline
                              />
                            ) : (
                              <img 
                                src={photo.url} 
                                alt="Gallery Preview" 
                                className="w-100 h-100"
                                style={{ objectFit: "cover" }}
                                onError={(e) => {
                                  e.target.src = "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=600&q=80";
                                }}
                              />
                            )}
                            {photo.mediaType === "video" && (
                              <div className="position-absolute top-50 start-50 translate-middle text-white bg-dark bg-opacity-50 rounded-circle d-flex align-items-center justify-content-center" style={{ width: "40px", height: "40px" }}>
                                <i className="bi bi-play-fill fs-4 text-white"></i>
                              </div>
                            )}
                            <div className="position-absolute bottom-0 start-0 end-0 bg-dark bg-opacity-50 p-2 text-white text-truncate small" style={{ fontSize: "11px" }}>
                              {photo.description}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
      <Footer />
    </>
  );
}
