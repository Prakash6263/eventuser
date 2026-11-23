"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { getMerchantChatApi, sendMerchantChatMessageApi } from "../services/chatApi";
import { getMerchantsByServiceApi } from "../services/eventApi";
import { getReservationDetailsByIdApi } from "../services/reservationApi";
import { apiRequest } from "../services/apiClient";
import { authService } from "../services/authService";

function MerchantChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const eventId = searchParams.get("eventId") || "";
  const merchantId = searchParams.get("merchantId") || "";
  const merchantNameParam = searchParams.get("merchantName") || "Restaurant";

  const [chatId, setChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [merchant, setMerchant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [profile, setProfile] = useState(null);

  // Contextual Event & Reservation Details
  const [eventData, setEventData] = useState(null);
  const [reservation, setReservation] = useState(null);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  const chatBodyRef = useRef(null);
  const chatIdRef = useRef(null);
  const resolvedMerchantIdRef = useRef(merchantId);
  const inputRef = useRef(null);

  const getInitials = (name) => (name ? name.trim().charAt(0).toUpperCase() : "?");

  // Load User Profile
  useEffect(() => {
    async function loadProfile() {
      try {
        const prof = await authService.getUserProfile();
        if (prof && prof.status && prof.user) {
          setProfile(prof.user);
        } else {
          const local = authService.getUser();
          if (local) setProfile(local);
        }
      } catch (err) {
        console.error("Failed loading user profile:", err);
      }
    }
    loadProfile();
  }, []);

  // Load Event and Reservation Context
  useEffect(() => {
    async function loadContext() {
      if (!eventId) return;
      try {
        // Fetch Event details
        const evRes = await apiRequest(`/event/eventbyId?id=${eventId}`);
        if (evRes && evRes.status && evRes.data) {
          setEventData(evRes.data);
        }
      } catch (err) {
        console.warn("Could not fetch event context:", err);
      }

      try {
        // Fetch Reservation details
        const resData = await getReservationDetailsByIdApi(eventId);
        if (resData && resData.status && resData.data) {
          let currentRes = null;
          if (Array.isArray(resData.data)) {
            const match = resData.data.find(
              (d) => String(d._id) === String(eventId) || String(d.id) === String(eventId)
            );
            if (match) currentRes = match.makeReservation || match.reservation || match;
          } else {
            currentRes = resData.data.makeReservation || resData.data.reservation || resData.data;
          }
          setReservation(currentRes);
        }
      } catch (err) {
        console.warn("Could not fetch reservation context:", err);
      }
    }
    loadContext();
  }, [eventId]);

  // Fetch (or create) the merchant chat + messages
  const fetchChat = async () => {
    let targetMerchantId = resolvedMerchantIdRef.current || merchantId;
    if (!targetMerchantId) {
      setError("Missing merchant reference.");
      setLoading(false);
      return;
    }
    try {
      const activeEventId = eventId || "general";
      let res = await getMerchantChatApi(activeEventId, targetMerchantId);

      // If server returns "Merchant not found.", resolve by Service ID
      if (
        res &&
        res.status === false &&
        (res.message?.toLowerCase().includes("merchant not found") ||
          res.message?.toLowerCase().includes("not found"))
      ) {
        try {
          const serviceRes = await getMerchantsByServiceApi(targetMerchantId);
          if (
            serviceRes &&
            serviceRes.status &&
            Array.isArray(serviceRes.data) &&
            serviceRes.data.length > 0
          ) {
            const foundService =
              serviceRes.data.find(
                (s) => s._id === targetMerchantId || s.id === targetMerchantId
              ) || serviceRes.data[0];
            const realMerchantId =
              foundService?.merchant?._id ||
              foundService?.merchant?.id ||
              foundService?.merchantId?._id ||
              foundService?.merchantId;
            if (realMerchantId && String(realMerchantId) !== String(targetMerchantId)) {
              resolvedMerchantIdRef.current = String(realMerchantId);
              targetMerchantId = String(realMerchantId);
              res = await getMerchantChatApi(activeEventId, targetMerchantId);
            }
          }
        } catch (e) {
          console.warn("Failed fallback service resolution for merchant:", e);
        }
      }

      if (res && res.status && res.data) {
        const data = res.data;
        const id = data.chat?._id || null;
        setChatId(id);
        chatIdRef.current = id;
        if (data.participants?.merchant) setMerchant(data.participants.merchant);
        setMessages(Array.isArray(data.messages) ? data.messages : []);
        setError(null);
      } else {
        setError(res?.message || "Failed to load chat.");
      }
    } catch (err) {
      setError(err.message || "Network error loading chat.");
    } finally {
      setLoading(false);
    }
  };

  // Smart polling (visibility & focus aware)
  useEffect(() => {
    fetchChat();

    let intervalId = null;
    const startPolling = () => {
      if (!intervalId) {
        intervalId = setInterval(() => {
          if (typeof document !== "undefined" && !document.hidden) {
            fetchChat();
          }
        }, 4000);
      }
    };
    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    startPolling();

    const handleVisibilityChange = () => (document.hidden ? stopPolling() : startPolling());
    const handleFocus = () => startPolling();
    const handleBlur = () => stopPolling();

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("focus", handleFocus);
      window.addEventListener("blur", handleBlur);
    }

    return () => {
      stopPolling();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", handleFocus);
        window.removeEventListener("blur", handleBlur);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, merchantId]);

  // Keep message viewport pinned to bottom
  const scrollToBottom = (behavior = "smooth") => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTo({
        top: chatBodyRef.current.scrollHeight,
        behavior: behavior,
      });
    }
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  // Send a message
  const handleSendMessage = async (e, customText = null) => {
    if (e && e.preventDefault) e.preventDefault();
    const content = (customText !== null ? customText : newMsg).trim();
    if (!content) return;

    const activeChatId = chatIdRef.current || chatId;
    if (!activeChatId) {
      await fetchChat();
      return;
    }

    setNewMsg("");
    setSending(true);

    const optimistic = {
      _id: `temp-${Date.now()}`,
      chatId: activeChatId,
      senderType: "user",
      content,
      createdAt: new Date().toISOString(),
      timeAgo: "just now",
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await sendMerchantChatMessageApi(activeChatId, content);
      if (res && res.status) {
        fetchChat();
      }
    } catch (err) {
      console.error("Failed to send merchant message:", err);
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const merchantName = merchant?.name || merchantNameParam;
  const merchantPic = merchant?.profilePic || null;

  // Quick inquiry suggestions
  const quickInquiries = [
    "Hi, is our table reservation confirmed?",
    "Can you share today's special menu?",
    "Do you have parking space available?",
    "Can we bring a birthday cake?",
  ];

  // Helper date formatter
  const formatMsgDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      return "Today";
    }
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <>
      <Header />
      <div className="wrapper" style={{ background: "#f1f5f9", minHeight: "100vh" }}>
        <div style={{ paddingTop: "105px", paddingBottom: "70px" }}>
          <div className="container-xl px-3 px-md-4">

            {/* Top Navigation Bar */}
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="btn btn-white bg-white rounded-pill px-3.5 py-2 shadow-sm border-0 fw-semibold text-secondary d-flex align-items-center gap-2 hover-elevate"
                  style={{ transition: "all 0.2s ease" }}
                >
                  <i className="fa-solid fa-arrow-left text-primary"></i>
                  <span>Back</span>
                </button>
                <div className="d-none d-sm-flex align-items-center gap-1.5 ms-2 text-muted small">
                  <Link href="/my-events" className="text-decoration-none text-muted">Events</Link>
                  <i className="fa-solid fa-chevron-right" style={{ fontSize: "10px" }}></i>
                  <span className="text-dark fw-semibold text-truncate" style={{ maxWidth: "200px" }}>
                    {eventData?.eventTitle || "Event"}
                  </span>
                  <i className="fa-solid fa-chevron-right" style={{ fontSize: "10px" }}></i>
                  <span className="text-primary fw-semibold">Restaurant Chat</span>
                </div>
              </div>

              <div className="d-flex align-items-center gap-2">
                {/* Mobile sidebar toggle */}
                <button
                  type="button"
                  className="btn btn-outline-primary d-lg-none rounded-pill px-3 py-1.5 small fw-semibold d-flex align-items-center gap-1.5 bg-white shadow-sm"
                  onClick={() => setShowMobileSidebar(!showMobileSidebar)}
                >
                  <i className="fa-solid fa-store"></i>
                  <span>{showMobileSidebar ? "Hide Details" : "Venue Details"}</span>
                </button>

                <div className="badge bg-white text-dark border px-3 py-2 rounded-pill shadow-sm d-flex align-items-center gap-2">
                  <span
                    className="rounded-circle d-inline-block bg-success"
                    style={{ width: "8px", height: "8px", boxShadow: "0 0 0 2px rgba(34, 197, 94, 0.2)" }}
                  ></span>
                  <span className="fw-semibold small">Direct Partner Chat</span>
                </div>
              </div>
            </div>

            {/* Main Chat Box Container */}
            <div
              className="card border-0 rounded-4 shadow-sm overflow-hidden bg-white d-flex flex-row"
              style={{ height: "calc(100vh - 220px)", minHeight: "620px", maxHeight: "850px" }}
            >

              {/* ──────────────── Left Sidebar: Restaurant & Event Details ──────────────── */}
              <div
                className={`flex-column border-end bg-white ${showMobileSidebar ? "d-flex position-absolute top-0 start-0 w-100 h-100 z-3" : "d-none d-lg-flex"}`}
                style={{ width: showMobileSidebar ? "100%" : "350px", flexShrink: 0 }}
              >
                {/* Mobile close button */}
                {showMobileSidebar && (
                  <div className="d-flex justify-content-between align-items-center p-3 border-bottom bg-light">
                    <span className="fw-bold text-dark">Venue & Booking Context</span>
                    <button
                      type="button"
                      className="btn-close"
                      onClick={() => setShowMobileSidebar(false)}
                    ></button>
                  </div>
                )}

                <div className="overflow-y-auto flex-grow-1 p-4 d-flex flex-column gap-3.5">

                  {/* Merchant Brand Identity Card */}
                  <div className="p-3.5 rounded-4 bg-light border text-center position-relative">
                    <div className="position-relative d-inline-block mb-2">
                      {merchantPic ? (
                        <img
                          src={merchantPic}
                          alt={merchantName}
                          className="rounded-circle object-fit-cover shadow-sm border border-2 border-white"
                          style={{ width: "68px", height: "68px" }}
                          onError={(e) => { e.target.onerror = null; e.target.style.display = "none"; }}
                        />
                      ) : (
                        <div
                          className="rounded-circle text-white d-flex align-items-center justify-content-center fw-bold shadow-sm mx-auto"
                          style={{
                            width: "68px",
                            height: "68px",
                            fontSize: "26px",
                            background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                          }}
                        >
                          {getInitials(merchantName)}
                        </div>
                      )}
                      <span
                        className="position-absolute bottom-0 end-0 rounded-circle border border-2 border-white bg-success"
                        style={{ width: "16px", height: "16px" }}
                        title="Online"
                      ></span>
                    </div>

                    <h5 className="fw-bold text-dark mb-1" style={{ fontSize: "17px" }}>{merchantName}</h5>
                    <div className="d-flex align-items-center justify-content-center gap-1.5 mb-2.5">
                      <span className="badge bg-primary-subtle text-primary rounded-pill px-2.5 py-1 fw-semibold" style={{ fontSize: "11px" }}>
                        <i className="fa-solid fa-utensils me-1"></i> Partner Restaurant
                      </span>
                      <span className="badge bg-success-subtle text-success rounded-pill px-2.5 py-1 fw-semibold" style={{ fontSize: "11px" }}>
                        <i className="fa-solid fa-circle-check me-1"></i> Verified
                      </span>
                    </div>

                    <div className="d-flex gap-2 justify-content-center mt-2">
                      <Link
                        href={`/merchant-details?eventId=${eventId}&merchantId=${merchantId}`}
                        className="btn btn-outline-primary rounded-pill btn-sm px-3 fw-semibold d-flex align-items-center gap-1.5"
                        style={{ fontSize: "12px" }}
                      >
                        <i className="fa-solid fa-circle-info"></i> View Venue
                      </Link>
                      {eventId && (
                        <Link
                          href={`/event-details?id=${eventId}`}
                          className="btn btn-light rounded-pill btn-sm px-3 fw-semibold text-secondary d-flex align-items-center gap-1.5 border"
                          style={{ fontSize: "12px" }}
                        >
                          <i className="fa-regular fa-calendar"></i> Event Page
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Linked Event & Reservation Context Card */}
                  <div className="p-3.5 rounded-4 border bg-white shadow-xs">
                    <div className="d-flex align-items-center justify-content-between mb-2 pb-2 border-bottom">
                      <span className="text-uppercase fw-bold text-muted" style={{ fontSize: "11px", letterSpacing: "0.5px" }}>
                        Booking Details
                      </span>
                      {reservation ? (
                        <span
                          className={`badge rounded-pill px-2.5 py-1 fw-semibold ${
                            reservation.status === "active"
                              ? "bg-success-subtle text-success"
                              : reservation.status === "cancelled"
                              ? "bg-danger-subtle text-danger"
                              : "bg-warning-subtle text-warning"
                          }`}
                          style={{ fontSize: "11px" }}
                        >
                          <i
                            className={`fa-solid ${
                              reservation.status === "active"
                                ? "fa-circle-check"
                                : reservation.status === "cancelled"
                                ? "fa-circle-xmark"
                                : "fa-clock"
                            } me-1`}
                          ></i>
                          {reservation.status === "active"
                            ? "Confirmed"
                            : reservation.status === "cancelled"
                            ? "Cancelled"
                            : "Pending Confirmation"}
                        </span>
                      ) : (
                        <span className="badge bg-secondary-subtle text-secondary rounded-pill px-2.5 py-1" style={{ fontSize: "11px" }}>
                          No Table Reserved
                        </span>
                      )}
                    </div>

                    <div className="d-flex flex-column gap-2">
                      <div>
                        <span className="text-muted d-block" style={{ fontSize: "11px" }}>Event Title</span>
                        <h6 className="fw-bold text-dark mb-0 small text-truncate">
                          {eventData?.eventTitle || "Special Event"}
                        </h6>
                      </div>

                      {eventData?.eventDate && (
                        <div>
                          <span className="text-muted d-block" style={{ fontSize: "11px" }}>Date & Time</span>
                          <span className="text-dark fw-semibold small">
                            <i className="fa-regular fa-clock me-1 text-primary"></i>
                            {eventData.eventDate} {eventData.eventStartTime ? `• ${eventData.eventStartTime}` : ""}
                          </span>
                        </div>
                      )}

                      {reservation && (
                        <div className="p-2.5 rounded-3 bg-light border mt-1">
                          <div className="d-flex justify-content-between align-items-center">
                            <span className="small text-muted">Reserved Seats:</span>
                            <span className="fw-bold text-dark small">
                              {reservation.adultCount || 1} Adult{Number(reservation.adultCount) > 1 ? "s" : ""}
                              {Number(reservation.childCount) > 0 ? `, ${reservation.childCount} Child` : ""}
                            </span>
                          </div>
                          {reservation.instruction && (
                            <div className="mt-1 pt-1 border-top border-secondary-subtle">
                              <small className="text-muted fst-italic d-block" style={{ fontSize: "11px" }}>
                                &quot;{reservation.instruction}&quot;
                              </small>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="pt-2">
                        <Link
                          href="/my-reservations"
                          className="text-decoration-none fw-semibold small text-primary d-flex align-items-center gap-1"
                          style={{ fontSize: "12px" }}
                        >
                          <i className="fa-solid fa-sliders"></i> Modify or Manage Reservation
                          <i className="fa-solid fa-arrow-right ms-auto"></i>
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* Quick Inquiry Suggestions */}
                  <div>
                    <span className="text-uppercase fw-bold text-muted d-block mb-2" style={{ fontSize: "11px", letterSpacing: "0.5px" }}>
                      Quick Message Prompts
                    </span>
                    <div className="d-flex flex-column gap-1.5">
                      {quickInquiries.map((q, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className="btn btn-sm btn-light border text-start rounded-3 py-1.5 px-2.5 text-secondary fw-normal shadow-none hover-shadow"
                          style={{ fontSize: "12px", transition: "all 0.15s ease" }}
                          onClick={() => {
                            if (showMobileSidebar) setShowMobileSidebar(false);
                            handleSendMessage(null, q);
                          }}
                        >
                          <i className="fa-regular fa-paper-plane me-1.5 text-primary" style={{ fontSize: "10px" }}></i>
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
              </div>

              {/* ──────────────── Right Main Chat Panel ──────────────── */}
              <div className="d-flex flex-column flex-grow-1 bg-white position-relative">

                {/* Chat Header Bar */}
                <div
                  className="bg-white border-bottom py-3 px-4 d-flex align-items-center justify-content-between shadow-xs"
                  style={{ zIndex: 2 }}
                >
                  <div className="d-flex align-items-center gap-3">
                    <div className="position-relative">
                      {merchantPic ? (
                        <img
                          src={merchantPic}
                          alt={merchantName}
                          className="rounded-circle object-fit-cover shadow-sm border"
                          style={{ width: "46px", height: "46px" }}
                          onError={(e) => { e.target.onerror = null; e.target.style.display = "none"; }}
                        />
                      ) : (
                        <div
                          className="rounded-circle text-white d-flex align-items-center justify-content-center fw-bold shadow-sm"
                          style={{
                            width: "46px",
                            height: "46px",
                            fontSize: "18px",
                            background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                          }}
                        >
                          {getInitials(merchantName)}
                        </div>
                      )}
                      <span
                        className="position-absolute bottom-0 end-0 bg-success border border-2 border-white rounded-circle"
                        style={{ width: "12px", height: "12px" }}
                      ></span>
                    </div>

                    <div>
                      <div className="d-flex align-items-center gap-2">
                        <h6 className="fw-bold m-0 text-dark" style={{ fontSize: "16px" }}>
                          {merchantName}
                        </h6>
                        <span className="badge bg-light text-secondary border rounded-pill d-none d-md-inline" style={{ fontSize: "10px" }}>
                          Merchant
                        </span>
                      </div>
                      <span className="text-success small fw-medium d-flex align-items-center gap-1.5" style={{ fontSize: "12px" }}>
                        <span className="bg-success rounded-circle d-inline-block" style={{ width: "6px", height: "6px" }}></span>
                        Typically responds within minutes
                      </span>
                    </div>
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary rounded-circle d-flex align-items-center justify-content-center"
                      style={{ width: "36px", height: "36px" }}
                      onClick={fetchChat}
                      title="Refresh conversation"
                    >
                      <i className="fa-solid fa-rotate-right"></i>
                    </button>
                    <Link
                      href={`/merchant-details?eventId=${eventId}&merchantId=${merchantId}`}
                      className="btn btn-sm btn-outline-primary rounded-pill px-3 py-1.5 fw-semibold d-none d-sm-flex align-items-center gap-1.5"
                      style={{ fontSize: "12.5px" }}
                    >
                      <i className="fa-solid fa-store"></i>
                      <span>Venue Details</span>
                    </Link>
                  </div>
                </div>

                {/* Message Viewport */}
                <div
                  ref={chatBodyRef}
                  className="flex-grow-1 p-3 p-md-4 overflow-y-auto d-flex flex-column gap-3"
                  style={{
                    background: "#f8fafc",
                    backgroundImage: "radial-gradient(#e2e8f0 0.75px, transparent 0.75px)",
                    backgroundSize: "16px 16px",
                  }}
                >
                  {loading ? (
                    <div className="d-flex flex-column align-items-center justify-content-center h-100 my-auto">
                      <div className="spinner-border text-primary" role="status" style={{ width: "2.5rem", height: "2.5rem" }}>
                        <span className="visually-hidden">Loading chat...</span>
                      </div>
                      <p className="text-muted mt-3 fw-medium small">Connecting to restaurant chat...</p>
                    </div>
                  ) : error ? (
                    <div className="text-center my-auto p-4 bg-white rounded-4 shadow-sm border mx-auto" style={{ maxWidth: "420px" }}>
                      <div className="rounded-circle bg-danger-subtle text-danger d-flex align-items-center justify-content-center mx-auto mb-3" style={{ width: "54px", height: "54px", fontSize: "24px" }}>
                        <i className="fa-solid fa-triangle-exclamation"></i>
                      </div>
                      <h6 className="fw-bold text-dark mb-1">{error}</h6>
                      <p className="text-muted small mb-3">We couldn&apos;t load the chat session right now.</p>
                      <button
                        type="button"
                        onClick={fetchChat}
                        className="btn btn-primary rounded-pill px-4 py-2 btn-sm fw-semibold"
                      >
                        Try Again
                      </button>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center my-auto p-4 bg-white rounded-4 shadow-sm border mx-auto" style={{ maxWidth: "460px" }}>
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3 text-primary shadow-xs"
                        style={{
                          width: "64px",
                          height: "64px",
                          fontSize: "26px",
                          background: "#e0e7ff",
                        }}
                      >
                        <i className="fa-solid fa-comments"></i>
                      </div>
                      <h5 className="fw-bold text-dark mb-1">Direct Chat with {merchantName}</h5>
                      <p className="text-muted small mb-3" style={{ lineHeight: "1.5" }}>
                        Ask about your reservation, banquet space, special meal preferences, or venue arrangements.
                      </p>

                      <div className="d-flex flex-wrap gap-2 justify-content-center pt-2 border-top">
                        {quickInquiries.slice(0, 2).map((q, idx) => (
                          <button
                            key={idx}
                            type="button"
                            className="btn btn-sm btn-outline-primary rounded-pill px-3 py-1.5 fw-medium"
                            style={{ fontSize: "12px" }}
                            onClick={() => handleSendMessage(null, q)}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Safety date badge */}
                      <div className="text-center my-1">
                        <span className="badge bg-white text-muted border rounded-pill px-3 py-1 shadow-xs small fw-normal">
                          {formatMsgDate(messages[0]?.createdAt)}
                        </span>
                      </div>

                      {messages.map((msg, index) => {
                        const isSelf = msg.senderType === "user";
                        const showAvatar = !isSelf && (
                          index === 0 ||
                          messages[index - 1]?.senderType === "user" ||
                          messages[index - 1]?.senderType !== msg.senderType
                        );

                        return (
                          <div
                            key={msg._id || index}
                            className={`d-flex gap-2.5 ${isSelf ? "justify-content-end" : "justify-content-start"}`}
                          >
                            {!isSelf && (
                              <div className="flex-shrink-0" style={{ width: "34px" }}>
                                {showAvatar ? (
                                  merchantPic ? (
                                    <img
                                      src={merchantPic}
                                      alt={merchantName}
                                      className="rounded-circle object-fit-cover shadow-xs border"
                                      style={{ width: "34px", height: "34px" }}
                                      onError={(e) => { e.target.onerror = null; e.target.style.display = "none"; }}
                                    />
                                  ) : (
                                    <div
                                      className="rounded-circle text-white d-flex align-items-center justify-content-center fw-bold shadow-xs"
                                      style={{
                                        width: "34px",
                                        height: "34px",
                                        fontSize: "13px",
                                        background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                                      }}
                                    >
                                      {getInitials(merchantName)}
                                    </div>
                                  )
                                ) : (
                                  <div style={{ width: "34px" }}></div>
                                )}
                              </div>
                            )}

                            <div style={{ maxWidth: "75%" }} className={isSelf ? "text-end" : "text-start"}>
                              <div
                                className={`p-3 shadow-xs text-start ${
                                  isSelf
                                    ? "text-white"
                                    : "bg-white text-dark border"
                                }`}
                                style={{
                                  fontSize: "14px",
                                  lineHeight: "1.55",
                                  borderRadius: isSelf ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                                  background: isSelf
                                    ? "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)"
                                    : "#ffffff",
                                  borderColor: isSelf ? "transparent" : "#e2e8f0",
                                  wordBreak: "break-word",
                                  boxShadow: isSelf
                                    ? "0 4px 12px rgba(79, 70, 229, 0.2)"
                                    : "0 2px 4px rgba(0, 0, 0, 0.04)",
                                }}
                              >
                                {msg.content}
                              </div>

                              <div
                                className={`mt-1 px-1.5 d-flex align-items-center gap-1 ${
                                  isSelf ? "justify-content-end text-muted" : "justify-content-start text-muted"
                                }`}
                                style={{ fontSize: "11px" }}
                              >
                                <span>
                                  {msg.timeAgo ||
                                    (msg.createdAt
                                      ? new Date(msg.createdAt).toLocaleTimeString([], {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })
                                      : "Just now")}
                                </span>
                                {isSelf && (
                                  <i className="fa-solid fa-check-double text-primary" style={{ fontSize: "10px" }}></i>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>

                {/* Quick Chip Inquiries Bar above Input */}
                <div className="px-4 py-2 bg-white border-top d-flex gap-2 overflow-x-auto align-items-center">
                  <span className="text-muted fw-semibold text-uppercase" style={{ fontSize: "10px", flexShrink: 0, letterSpacing: "0.5px" }}>
                    Quick Questions:
                  </span>
                  {quickInquiries.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="btn btn-sm btn-light border rounded-pill px-3 py-1 text-secondary fw-normal shadow-none text-nowrap"
                      style={{ fontSize: "11.5px" }}
                      onClick={() => handleSendMessage(null, q)}
                    >
                      {q}
                    </button>
                  ))}
                </div>

                {/* Modern Chat Input Bar */}
                <div className="p-3 px-md-4 bg-white border-top">
                  <form
                    className="d-flex align-items-center gap-2 rounded-pill p-1.5 border bg-light shadow-xs focus-within-shadow"
                    onSubmit={handleSendMessage}
                    style={{ background: "#f8fafc" }}
                  >
                    <input
                      ref={inputRef}
                      type="text"
                      className="form-control border-0 bg-transparent px-3 py-2 text-dark shadow-none"
                      placeholder={`Type your message to ${merchantName}...`}
                      value={newMsg}
                      onChange={(e) => setNewMsg(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                      }}
                      style={{ fontSize: "14px" }}
                    />

                    <button
                      type="submit"
                      disabled={!newMsg.trim() || sending}
                      className="btn rounded-circle text-white d-flex align-items-center justify-content-center shadow-sm"
                      style={{
                        width: "42px",
                        height: "42px",
                        flexShrink: 0,
                        background: !newMsg.trim() || sending ? "#a5b4fc" : "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                        border: "none",
                        transition: "all 0.2s ease",
                      }}
                      title="Send Message"
                    >
                      {sending ? (
                        <div className="spinner-border spinner-border-sm text-white" role="status"></div>
                      ) : (
                        <i className="fa-solid fa-paper-plane" style={{ fontSize: "14px", transform: "translateX(-1px)" }}></i>
                      )}
                    </button>
                  </form>
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

export default function MerchantChatPage() {
  return (
    <Suspense
      fallback={
        <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading chat...</span>
          </div>
        </div>
      }
    >
      <MerchantChatContent />
    </Suspense>
  );
}
