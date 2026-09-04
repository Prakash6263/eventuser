"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "../components/Header";
import Footer from "../components/Footer";
import SafeImage from "../components/SafeImage";
import { getEventGroupChatApi } from "../services/chatApi";
import { getEventMediaApi } from "../services/eventApi";
import { handleAuthFailure, isAuthFailureResponse } from "../services/apiClient";
import EventMediaModal from "../components/EventMediaModal";

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
  const [filterMyEvent, setFilterMyEvent] = useState("false");
  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [galleryLoading, setGalleryLoading] = useState(false);

  const [eventDates, setEventDates] = useState([]);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [calendarSelectedDate, setCalendarSelectedDate] = useState("");
  const [calendarLoading, setCalendarLoading] = useState(false);

  const formatLocalDateKey = (date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const parseEventDateKey = (value) => {
    if (!value || typeof value !== "string") return null;
    const match = value.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (!match) return null;
    const [, day, month, year] = match;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const normalizeDateForApi = (value) => {
    if (!value || typeof value !== "string") return "";
    const isoMatch = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return `${day}-${month}-${year}`;
    }

    const shortMatch = value.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (shortMatch) {
      return value.trim();
    }

    return "";
  };

  const getDateQueryVariants = (value) => {
    const variants = new Set();
    if (!value || typeof value !== "string") return [];

    const trimmed = value.trim();
    if (trimmed) variants.add(trimmed);

    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      variants.add(`${day}-${month}-${year}`);
    }

    const shortMatch = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (shortMatch) {
      const [, day, month, year] = shortMatch;
      variants.add(`${year}-${month}-${day}`);
    }

    return [...variants];
  };

  const matchSelectedDate = (evt, selectedDate) => {
    if (!selectedDate) return true;

    const targetDates = new Set(getDateQueryVariants(selectedDate));
    const rawEventDate = evt.rawEvent?.eventDate || "";
    const rawDateString = evt.filterDateStr || "";
    const candidates = [rawEventDate, rawDateString];

    if (rawEventDate && rawEventDate.includes('-')) {
      const parts = rawEventDate.split('-');
      if (parts.length === 3) {
        const [first, second, third] = parts;
        const maybeDay = Number(first);
        const maybeMonth = Number(second);
        const maybeYear = Number(third);
        if (!Number.isNaN(maybeDay) && !Number.isNaN(maybeMonth) && !Number.isNaN(maybeYear)) {
          candidates.push(`${third}-${String(second).padStart(2, '0')}-${String(first).padStart(2, '0')}`);
          candidates.push(`${String(first).padStart(2, '0')}-${String(second).padStart(2, '0')}-${third}`);
        }
      }
    }

    return candidates.some((candidate) => targetDates.has(candidate));
  };

  const eventDateSet = useMemo(() => new Set(eventDates), [eventDates]);

  const getCalendarDaysForMonth = useCallback((monthDate) => {
    const firstDayOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const startDay = new Date(firstDayOfMonth);
    startDay.setDate(startDay.getDate() - firstDayOfMonth.getDay());

    const days = [];
    for (let i = 0; i < 42; i += 1) {
      const d = new Date(startDay);
      d.setDate(startDay.getDate() + i);
      days.push({
        date: d,
        key: formatLocalDateKey(d),
        isCurrentMonth: d.getMonth() === monthDate.getMonth(),
      });
    }
    return days;
  }, []);

  const calendarDays = useMemo(() => getCalendarDaysForMonth(calendarMonth), [calendarMonth, getCalendarDaysForMonth]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setToken(localStorage.getItem("user_token"));
    }
  }, []);

  const fetchMyEventDates = useCallback(async (activeToken) => {
    if (!activeToken) {
      setEventDates([]);
      setCalendarSelectedDate("");
      return;
    }

    try {
      setCalendarLoading(true);
      const response = await fetch("https://eventuna.com/api/event/my-event-dates", {
        headers: {
          Authorization: `Bearer ${activeToken}`,
        },
      });
      const json = await response.json();

      if (!response.ok || !json?.status || !Array.isArray(json.data)) {
        setEventDates([]);
        setCalendarSelectedDate("");
        return;
      }

      const validDates = json.data
        .map(parseEventDateKey)
        .filter((date) => date instanceof Date && !Number.isNaN(date.getTime()))
        .sort((a, b) => a - b)
        .map((date) => formatLocalDateKey(date));

      const uniqueDates = [...new Set(validDates.filter(Boolean))];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const nextDate = uniqueDates.find((dateKey) => {
        const date = new Date(`${dateKey}T00:00:00`);
        return date >= today;
      }) || uniqueDates[0] || "";

      setEventDates(uniqueDates);
      if (nextDate) {
        setCalendarSelectedDate(nextDate);
        setCalendarMonth(new Date(`${nextDate}T00:00:00`));
      } else {
        setCalendarSelectedDate("");
      }
    } catch (error) {
      console.error("Failed to fetch future event dates:", error);
      setEventDates([]);
      setCalendarSelectedDate("");
    } finally {
      setCalendarLoading(false);
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

      const queryParams = new URLSearchParams();
      queryParams.append("myevent", selectedMyEvent || "false");

      const res = await fetch(`https://eventuna.com/api/event/events?${queryParams.toString()}`, {
        headers: {
          "Authorization": `Bearer ${activeToken}`
        }
      });
      const json = await res.json();

      if (isAuthFailureResponse(res, json)) {
        handleAuthFailure();
        return;
      }
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      if (!json?.status || !Array.isArray(json.data)) {
        setError(json?.message || "Failed to load events");
        return;
      }

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

        let rawStatus = evt.myInvitationStatus || evt.status || evt.eventCurrentStatus || "pending";
        const statusLower = rawStatus.toLowerCase();
        if (statusLower === "ongoingevent" || statusLower === "ongoing") {
          rawStatus = "Upcoming";
        }

        return {
          id: evt._id,
          title: evt.eventTitle || "Untitled Event",
          category: evt.eventType?.eventType || evt.eventCategory?.category || "Celebration",
          location: locationStr,
          img: evt.image || "",
          date: formattedMonthDay,
          filterDateStr: rawDateString,
          time: evt.eventStartTime || "",
          status: rawStatus,
          rawEvent: evt
        };
      });

      if (selectedDate) {
        mapped = mapped.filter((evt) => matchSelectedDate(evt, selectedDate));
      }

      if (selectedStatus) {
        mapped = mapped.filter((evt) => evt.status.toLowerCase() === selectedStatus.toLowerCase());
      }

      setEvents(mapped);
    } catch (err) {
      setError(err.message || "Network error loading events");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      setEventDates([]);
      setCalendarSelectedDate("");
      setCalendarMonth(new Date());
      return;
    }

    fetchFilteredEvents("false", "", "");
    fetchMyEventDates(token);
  }, [token, fetchMyEventDates]);

  const handleApplyFilters = () => {
    fetchFilteredEvents(filterMyEvent, filterDate, filterStatus);
  };

  const handleCalendarDateClick = (dayKey) => {
    const chosenDate = dayKey || "";
    setCalendarSelectedDate(chosenDate);
    setFilterDate(chosenDate);
    fetchFilteredEvents(filterMyEvent, chosenDate, filterStatus);
  };

  const handleResetFilters = () => {
    setFilterMyEvent("false");
    setFilterDate("");
    setFilterStatus("");
    fetchFilteredEvents("false", "", "");
  };

  const handleViewEventDetails = (evt) => {
    const rawEvent = evt.rawEvent;
    localStorage.setItem("event-details-back-url", "/events");
    localStorage.setItem("event-details-back-label", "Back to Events");
    router.push(`/event-details?id=${rawEvent._id || evt.id}`);
  };

  // Group Chat Fetch & Simulation Flow
  const handleOpenChat = async (evt, e) => {
    e.stopPropagation();
    const userStatus = evt.status?.toLowerCase();
    const isAccepted = ["accepted", "ongoing", "approved", "ongoingevent"].includes(userStatus);
    
    if (!isAccepted) {
      setActiveChatEvent({
        ...evt,
        notAcceptedMessage: "You can only view chat discussions once your invitation has been accepted."
      });
      setChatLoading(false);
      return;
    }

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
  const handleOpenGallery = (evt, e) => {
    e.stopPropagation();
    const userStatus = evt.status?.toLowerCase();
    const isAccepted = ["accepted", "ongoing", "approved", "ongoingevent"].includes(userStatus);
    
    if (!isAccepted) {
      setActiveGalleryEvent({
        ...evt,
        photos: [],
        notAcceptedMessage: "You can only view event media files once your invitation has been accepted."
      });
      return;
    }

    setActiveGalleryEvent(evt);
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name.trim().charAt(0).toUpperCase();
  };

  const getStatusBadge = (status = "") => {
    const s = status.toString().toLowerCase();
    if (s === "accepted" || s === "approved") {
      return <span className="badge bg-success-subtle text-success rounded-pill px-2.5 py-1.5 fw-semibold" style={{ fontSize: "11px" }}>Accepted</span>;
    }
    if (s === "pending" || s === "waiting for action" || s === "waiting") {
      return <span className="badge bg-warning-subtle text-warning rounded-pill px-2.5 py-1.5 fw-semibold" style={{ fontSize: "11px" }}>Pending</span>;
    }
    if (s === "rejected" || s === "cancelled") {
      return <span className="badge bg-danger-subtle text-danger rounded-pill px-2.5 py-1.5 fw-semibold" style={{ fontSize: "11px" }}>Cancelled</span>;
    }
    if (s === "ongoingevent" || s === "ongoing" || s === "upcoming") {
      return <span className="badge bg-info-subtle text-info rounded-pill px-2.5 py-1.5 fw-semibold" style={{ fontSize: "11px" }}>Upcoming</span>;
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
                        <option value="true">Yes</option>
                        <option value="false">No</option>
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
                  <div className="bg-white border rounded-3 shadow-sm p-3 mb-4 mx-auto" style={{ width: "100%", maxWidth: "860px" }}>
                    <div className="d-flex justify-content-between align-items-center mb-2 px-1">
                      <h6 className="fw-bold text-dark m-0">Upcoming Dates</h6>
                      {calendarLoading && <span className="small text-muted">Loading...</span>}
                    </div>

                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <button
                        type="button"
                        className="btn btn-link text-dark p-0 border-0"
                        onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                        aria-label="Previous month"
                      >
                        <i className="fa-solid fa-chevron-left"></i>
                      </button>
                      <strong className="text-dark" style={{ fontSize: "0.95rem" }}>
                        {calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                      </strong>
                      <button
                        type="button"
                        className="btn btn-link text-dark p-0 border-0"
                        onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                        aria-label="Next month"
                      >
                        <i className="fa-solid fa-chevron-right"></i>
                      </button>
                    </div>

                    <div className="row g-1 text-center small text-muted fw-semibold mb-2 px-1">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                        <div key={day} className="col-12" style={{ width: "14.28%" }}>
                          {day}
                        </div>
                      ))}
                    </div>

                    <div className="row g-1 text-center px-1">
                      {calendarDays.map((day) => {
                        const isSelected = calendarSelectedDate === day.key;
                        const hasEvent = eventDateSet.has(day.key);

                        return (
                          <div key={day.key} className="col-12" style={{ width: "14.28%" }}>
                            <button
                              type="button"
                              onClick={() => day.isCurrentMonth && handleCalendarDateClick(day.key)}
                              disabled={!day.isCurrentMonth}
                              className="btn btn-sm mx-auto d-flex align-items-center justify-content-center"
                              style={{
                                height: "36px",
                                width: isSelected ? "52px" : "36px",
                                padding: 0,
                                background: isSelected ? "#e8f0ff" : hasEvent ? "#f3f7ff" : "transparent",
                                color: isSelected ? "#1e3a8a" : day.isCurrentMonth ? "#1f2937" : "#9ca3af",
                                border: isSelected ? "1px solid #dfe8ff" : hasEvent ? "1px solid #dfe8ff" : "1px solid transparent",
                                borderRadius: isSelected ? "18px" : "50%",
                                fontWeight: isSelected ? 700 : 500,
                                opacity: 1,
                                boxShadow: isSelected ? "0 2px 8px rgba(59, 130, 246, 0.10)" : "none",
                                transition: "all 0.2s ease",
                              }}
                              title={hasEvent ? "Event date" : "No event"}
                            >
                              {day.date.getDate()}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

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
                    <div className="row g-4 justify-content-start">
                      {events.map((evt) => (
                        <div key={evt.id} className="col-xl-4 col-lg-4 col-md-6 mb-4">
                          <div className="main-card h-100 d-flex flex-column justify-content-between overflow-hidden shadow-sm" style={{ cursor: "pointer" }} onClick={() => handleViewEventDetails(evt)}>
                            
                            {/* Card Media Header */}
                            <div>
                              <div className="event-thumbnail" style={{ height: "180px", overflow: "hidden", position: "relative" }}>
                                <div className="thumbnail-img h-100 w-100">
                                  <SafeImage
                                    src={evt.img}
                                    alt={evt.title}
                                    className="w-100 h-100"
                                    style={{ objectFit: "cover" }}
                                    variant="event"
                                    fallbackLabel={evt.title}
                                    fallbackSubLabel={evt.category}
                                  />
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
                {activeChatEvent.notAcceptedMessage ? (
                  <div className="text-center py-5 px-3">
                    <i className="bi bi-lock-fill fs-1 text-warning mb-3 d-block"></i>
                    <h5 className="fw-bold text-dark mb-2">Invitation Pending</h5>
                    <p className="text-muted small mb-0">{activeChatEvent.notAcceptedMessage}</p>
                  </div>
                ) : chatLoading ? (
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
        <EventMediaModal
          activeGalleryEvent={activeGalleryEvent}
          onClose={() => setActiveGalleryEvent(null)}
        />
      )}
      <Footer />
    </>
  );
}
