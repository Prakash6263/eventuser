"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Header from "../components/Header";
import Footer from "../components/Footer";
import SafeImage from "../components/SafeImage";
import { authService } from "../services/authService";
import { getEventGroupChatApi, getChatMessagesApi, sendChatMessageApi } from "../services/chatApi";
import { apiRequest } from "../services/apiClient";

function ChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const chatIdParam = searchParams.get("chatId") || "";
  const eventNameParam = searchParams.get("eventName") || "Group Chat";
  const eventId = searchParams.get("eventId") || "";

  const [chatId, setChatId] = useState(chatIdParam);
  const [eventName, setEventName] = useState(eventNameParam);
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [profile, setProfile] = useState(null);
  const [eventDetails, setEventDetails] = useState(null);
  const [showMembersModal, setShowMembersModal] = useState(false);

  const chatBodyRef = useRef(null);
  const inputRef = useRef(null);
  const chatIdRef = useRef(chatIdParam);

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

  // Fetch Group Details & Resolve Chat ID if missing
  useEffect(() => {
    async function fetchGroupDetails() {
      if (!eventId) return;
      try {
        const res = await getEventGroupChatApi(eventId);
        if (res && res.status && res.data) {
          if (Array.isArray(res.data.members)) {
            setMembers(res.data.members);
          }
          if (res.data._id && (!chatIdRef.current || chatIdRef.current !== res.data._id)) {
            chatIdRef.current = res.data._id;
            setChatId(res.data._id);
          }
        }
      } catch (err) {
        console.error("Failed to load group details:", err);
      }
    }
    fetchGroupDetails();
  }, [eventId]);

  // Fetch Event Details to get member RSVP statuses & title
  useEffect(() => {
    async function loadEventDetails() {
      if (!eventId) return;
      try {
        const json = await apiRequest("/event/events");
        if (json && json.status && Array.isArray(json.data)) {
          const match = json.data.find((e) => e._id === eventId || e.id === eventId);
          if (match) {
            setEventDetails(match);
            if (match.title && (!eventNameParam || eventNameParam === "Group Chat")) {
              setEventName(match.title);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load event details:", err);
      }
    }
    loadEventDetails();
  }, [eventId, eventNameParam]);

  // Fetch Group Messages from backend
  const fetchMessages = async () => {
    const activeChatId = chatIdRef.current || chatId;
    if (!activeChatId) {
      if (!eventId) {
        setError("Missing chat or event reference.");
        setLoading(false);
      }
      return;
    }

    try {
      const res = await getChatMessagesApi(activeChatId);
      if (res && res.status && Array.isArray(res.data)) {
        setMessages(res.data);
        setError(null);
      } else {
        setError(res?.message || "Failed to load messages.");
      }
    } catch (err) {
      setError(err.message || "Network error loading chat messages.");
    } finally {
      setLoading(false);
    }
  };

  // Smart Polling (Visibility & Focus Aware)
  useEffect(() => {
    const activeId = chatIdRef.current || chatId;
    if (activeId) {
      fetchMessages();
    }

    let intervalId = null;

    const startPolling = () => {
      if (!intervalId) {
        intervalId = setInterval(() => {
          if (typeof document !== "undefined" && !document.hidden) {
            fetchMessages();
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

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        startPolling();
      }
    };

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
  }, [chatId]);

  // Scroll to bottom smoothly
  const scrollToBottom = () => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTo({
        top: chatBodyRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  // Send Message Handler
  const handleSendMessage = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const content = newMsg.trim();
    if (!content) return;

    const activeChatId = chatIdRef.current || chatId;
    if (!activeChatId) {
      return;
    }

    setNewMsg("");
    setSending(true);

    const optimisticMessage = {
      _id: `temp-${Date.now()}`,
      chatId: activeChatId,
      sender: {
        _id: profile?._id || profile?.id || "user-self",
        fullName: profile?.fullName || "You",
        profilePic: profile?.profilePic || null,
        email: profile?.email || "",
      },
      content,
      createdAt: new Date().toISOString(),
      timeAgo: "Just now",
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      const res = await sendChatMessageApi(activeChatId, content);
      if (res && res.status) {
        fetchMessages();
      }
    } catch (err) {
      console.error("Failed to send message to group:", err);
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const getMemberStatus = (memberId) => {
    if (!eventDetails) return null;
    if (Array.isArray(eventDetails.contactList)) {
      const match = eventDetails.contactList.find(
        (c) => c._id === memberId || c.userId === memberId
      );
      if (match && match.status) return match.status;
    }
    if (Array.isArray(eventDetails.invitedUsers)) {
      const match = eventDetails.invitedUsers.find(
        (u) => u.userId?._id === memberId || u.userId === memberId || u._id === memberId
      );
      if (match && match.status) return match.status;
    }
    return null;
  };

  return (
    <>
      <Header />
      <div className="wrapper flex-grow-1" style={{ background: "#f8f9fa", flex: "1 0 auto" }}>
        <div className="event-dt-block p-80" style={{ paddingTop: "90px", paddingBottom: "70px" }}>
          <div className="container">
            <div className="row">

              {/* Left Column: Standard User Profile Sidebar */}
              <div className="col-lg-3 col-md-4 mb-4 mb-lg-0">
                <div className="user-profile-sidebar shadow-sm">
                  <div className="user-profile-sidebar-top text-center">
                    <div
                      className="user-profile-img"
                      style={{
                        width: "90px",
                        height: "90px",
                        borderRadius: "50%",
                        overflow: "hidden",
                        margin: "0 auto 12px",
                        border: "3px solid #3e56f0",
                        boxShadow: "0 4px 12px rgba(62, 86, 240, 0.15)",
                        position: "relative",
                      }}
                    >
                      <SafeImage
                        alt="Profile avatar"
                        src={profile?.profilePic || "/images/05.jpg"}
                        variant="profile"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                    <h5 className="fw-bold mb-1">{profile?.fullName || "User Profile"}</h5>
                    <span className="badge bg-success-subtle text-success rounded-pill px-2.5 py-1 small fw-semibold">
                      <i className="bi bi-check-circle-fill me-1"></i> Verified User
                    </span>
                  </div>

                  <ul className="user-profile-sidebar-list">
                    <li>
                      <Link href="/my-events">
                        <i className="bi bi-grid-fill me-2 text-primary"></i> My Events
                      </Link>
                    </li>
                    <li>
                      <Link href="/user-profile">
                        <i className="bi bi-person-fill me-2 text-primary"></i> Profile
                      </Link>
                    </li>
                    <li>
                      <Link href="/my-reservations">
                        <i className="bi bi-calendar-event-fill me-2 text-primary"></i> My Reservations
                      </Link>
                    </li>
                    <li>
                      <Link href="/notifications">
                        <i className="bi bi-bell-fill me-2 text-primary"></i> Notifications
                      </Link>
                    </li>
                    <li>
                      <Link href="/change-password">
                        <i className="bi bi-key-fill me-2 text-primary"></i> Change Password
                      </Link>
                    </li>
                    <li>
                      <Link href="/login" onClick={() => authService.logout && authService.logout()}>
                        <i className="bi bi-box-arrow-right me-2 text-danger"></i> Logout
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Right Column: Clean Group Chat Window */}
              <div className="col-lg-9 col-md-8">
                <div className="user-profile-wrapper">
                  <div
                    className="chat-card shadow-sm border rounded-4 overflow-hidden bg-white mb-4"
                    style={{ borderColor: "#edf2f7" }}
                  >
                    <div
                      className="chat-window d-flex flex-column"
                      style={{ height: "650px", background: "#fcfcfd" }}
                    >

                      {/* Chat Header */}
                      <div className="chat-header p-3 px-4 bg-white border-bottom d-flex align-items-center justify-content-between">
                        <div className="d-flex align-items-center gap-3">
                          <button
                            type="button"
                            onClick={() => router.back()}
                            className="btn btn-sm btn-white border rounded-pill px-3 py-1.5 fw-medium d-inline-flex align-items-center gap-1.5 shadow-xs text-secondary hover-shadow transition"
                            style={{ fontSize: "13px", background: "#ffffff", borderColor: "#e2e8f0" }}
                          >
                            <i className="bi bi-arrow-left text-primary fw-bold" style={{ fontSize: "14px" }}></i>
                            <span>Back</span>
                          </button>

                          <div
                            className="avatar-wrapper position-relative flex-shrink-0"
                            style={{ width: "42px", height: "42px" }}
                          >
                            <div
                              className="rounded-circle text-white d-flex align-items-center justify-content-center fw-bold shadow-xs"
                              style={{
                                width: "42px",
                                height: "42px",
                                fontSize: "18px",
                                background: "linear-gradient(135deg, #3e56f0 0%, #6366f1 100%)",
                              }}
                            >
                              <i className="bi bi-people-fill"></i>
                            </div>
                          </div>

                          <div>
                            <h6 className="fw-bold mb-0 text-dark" style={{ fontSize: "15px", letterSpacing: "-0.2px" }}>
                              {eventName}
                            </h6>
                            <div className="d-flex align-items-center gap-2 mt-0.5">
                              <span className="d-inline-flex align-items-center gap-1 text-success fw-semibold" style={{ fontSize: "11.5px" }}>
                                <span className="bg-success rounded-circle d-inline-block" style={{ width: "6px", height: "6px" }}></span>
                                Live Channel
                              </span>
                              <span className="text-muted" style={{ fontSize: "11px" }}>•</span>
                              <button
                                type="button"
                                onClick={() => setShowMembersModal(true)}
                                className="btn btn-link p-0 border-0 text-muted text-decoration-none d-inline-flex align-items-center gap-1 fw-medium hover-text-primary"
                                style={{ fontSize: "11.5px" }}
                              >
                                <span>{members.length} {members.length === 1 ? "participant" : "participants"}</span>
                                <i className="bi bi-chevron-right" style={{ fontSize: "10px" }}></i>
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="d-flex align-items-center gap-2">
                          {/* Modern Overlapping Members Stack Button */}
                          <button
                            type="button"
                            onClick={() => setShowMembersModal(true)}
                            className="btn btn-sm btn-white border rounded-pill px-3 py-1.5 d-inline-flex align-items-center gap-2 shadow-xs transition btn-neutral-hover"
                            style={{
                              background: "#f8fafc",
                              borderColor: "#e2e8f0",
                              color: "#334155",
                              fontSize: "12px",
                            }}
                            title="View all members"
                          >
                            <div className="d-flex align-items-center">
                              {members.slice(0, 3).map((m, idx) => (
                                <div
                                  key={m._id || idx}
                                  className="rounded-circle border border-2 border-white d-flex align-items-center justify-content-center fw-bold text-white shadow-xs overflow-hidden"
                                  style={{
                                    width: "22px",
                                    height: "22px",
                                    marginLeft: idx === 0 ? "0" : "-7px",
                                    background: idx === 0 ? "#3e56f0" : idx === 1 ? "#10b981" : "#f59e0b",
                                    fontSize: "10px",
                                  }}
                                >
                                  {m.profilePic ? (
                                    <img src={m.profilePic} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                  ) : (
                                    getInitials(m.fullName)
                                  )}
                                </div>
                              ))}
                            </div>
                            <span className="fw-semibold text-dark">Members</span>
                            <span
                              className="badge bg-white text-dark border px-1.5 py-0.5 rounded-pill shadow-xs"
                              style={{ fontSize: "10px", fontWeight: "600", color: "#334155" }}
                            >
                              {members.length}
                            </span>
                          </button>

                          {/* Event Details Button with Clean Spacing */}
                          {eventId && (
                            <Link
                              href={`/event-details?id=${eventId}`}
                              className="btn btn-sm btn-white rounded-pill px-3 py-1.5 border d-none d-sm-inline-flex align-items-center gap-2 text-dark shadow-xs transition btn-neutral-hover"
                              style={{
                                background: "#ffffff",
                                borderColor: "#e2e8f0",
                                fontSize: "12px",
                                fontWeight: "500",
                                color: "#334155",
                              }}
                            >
                              <i className="bi bi-calendar-event text-primary" style={{ fontSize: "13px" }}></i>
                              <span className="text-dark">Event Details</span>
                            </Link>
                          )}

                          {/* Sleek Refresh Button */}
                          <button
                            type="button"
                            className="btn btn-sm btn-white border rounded-circle d-flex align-items-center justify-content-center text-muted shadow-xs transition"
                            style={{ width: "34px", height: "34px", background: "#ffffff", borderColor: "#e2e8f0" }}
                            onClick={() => fetchMessages()}
                            title="Refresh messages"
                          >
                            <i className="bi bi-arrow-clockwise text-secondary" style={{ fontSize: "14px" }}></i>
                          </button>
                        </div>
                      </div>

                      {/* Chat Messages Body */}
                      <div
                        ref={chatBodyRef}
                        className="chat-body p-4 overflow-y-auto d-flex flex-column gap-3 flex-grow-1"
                        style={{ background: "#f8fafc" }}
                      >
                        {loading ? (
                          <div className="text-center text-muted my-auto py-5">
                            <div
                              className="spinner-border spinner-border-sm text-primary mb-2"
                              role="status"
                            ></div>
                            <p className="small text-muted mb-0">Loading conversation history...</p>
                          </div>
                        ) : error ? (
                          <div className="text-center my-auto py-4">
                            <i className="bi bi-exclamation-circle text-danger fs-2 mb-2 d-block"></i>
                            <h6 className="fw-semibold text-dark mb-1">{error}</h6>
                            <button
                              type="button"
                              onClick={fetchMessages}
                              className="btn btn-sm btn-outline-primary rounded-pill px-3 mt-2"
                            >
                              Retry
                            </button>
                          </div>
                        ) : messages.length === 0 ? (
                          <div className="text-center my-auto py-5">
                            <div
                              className="rounded-circle bg-white shadow-xs d-flex align-items-center justify-content-center mx-auto mb-3 text-muted border"
                              style={{ width: "52px", height: "52px", fontSize: "20px" }}
                            >
                              <i className="bi bi-chat-dots text-primary"></i>
                            </div>
                            <h6 className="fw-bold text-dark mb-1">No Messages Yet</h6>
                            <p className="text-muted small mb-0">
                              Start the group conversation by typing below.
                            </p>
                          </div>
                        ) : (
                          messages.map((msg, idx) => {
                            const senderId =
                              msg.sender?._id || msg.sender?.id || msg.sender;
                            const currentUserId = profile?._id || profile?.id;
                            const isSelf =
                              currentUserId && String(senderId) === String(currentUserId);
                            const senderName =
                              msg.sender?.fullName || (isSelf ? "You" : "Participant");
                            const senderPic = msg.sender?.profilePic;
                            const timeDisplay =
                              msg.timeAgo ||
                              (msg.createdAt
                                ? new Date(msg.createdAt).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "Just now");

                            const prevMsg = idx > 0 ? messages[idx - 1] : null;
                            const nextMsg = idx < messages.length - 1 ? messages[idx + 1] : null;
                            const prevSenderId = prevMsg ? (prevMsg.sender?._id || prevMsg.sender?.id || prevMsg.sender) : null;
                            const nextSenderId = nextMsg ? (nextMsg.sender?._id || nextMsg.sender?.id || nextMsg.sender) : null;
                            const isFirstInGroup = !prevMsg || String(prevSenderId) !== String(senderId);
                            const isLastInGroup = !nextMsg || String(nextSenderId) !== String(senderId);

                            return (
                              <div
                                key={msg._id || idx}
                                className={`d-flex gap-2.5 ${
                                  isSelf ? "justify-content-end" : "justify-content-start"
                                }`}
                                style={{ marginTop: isFirstInGroup ? (idx === 0 ? "0" : "12px") : "3px" }}
                              >
                                {!isSelf && (
                                  <div className="flex-shrink-0" style={{ width: "34px", alignSelf: "flex-end" }}>
                                    {isLastInGroup ? (
                                      senderPic ? (
                                        <img
                                          src={senderPic}
                                          alt={senderName}
                                          className="rounded-circle border shadow-xs object-fit-cover"
                                          style={{ width: "34px", height: "34px" }}
                                          onError={(e) => {
                                            e.target.onerror = null;
                                            e.target.style.display = "none";
                                          }}
                                        />
                                      ) : (
                                        <div
                                          className="rounded-circle bg-secondary text-white d-flex align-items-center justify-content-center fw-bold shadow-xs"
                                          style={{ width: "34px", height: "34px", fontSize: "13px" }}
                                        >
                                          {getInitials(senderName)}
                                        </div>
                                      )
                                    ) : (
                                      <div style={{ width: "34px", height: "34px" }} />
                                    )}
                                  </div>
                                )}

                                <div
                                  className={`d-flex flex-column ${
                                    isSelf ? "align-items-end" : "align-items-start"
                                  }`}
                                  style={{ maxWidth: "70%" }}
                                >
                                  {!isSelf && isFirstInGroup && (
                                    <span
                                      className="text-muted fw-semibold mb-1 px-1"
                                      style={{ fontSize: "11px" }}
                                    >
                                      {senderName}
                                    </span>
                                  )}
                                  <div
                                    className="p-3 shadow-xs"
                                    style={{
                                      borderRadius: "16px",
                                      borderTopRightRadius: isSelf ? (isFirstInGroup ? "16px" : "6px") : "16px",
                                      borderBottomRightRadius: isSelf ? (isLastInGroup ? "4px" : "6px") : "16px",
                                      borderTopLeftRadius: !isSelf ? (isFirstInGroup ? "16px" : "6px") : "16px",
                                      borderBottomLeftRadius: !isSelf ? (isLastInGroup ? "4px" : "6px") : "16px",
                                      background: isSelf ? "#3e56f0" : "#ffffff",
                                      color: isSelf ? "#ffffff" : "#2d3748",
                                      border: isSelf ? "none" : "1px solid #edf2f7",
                                      fontSize: "14px",
                                      lineHeight: "1.5",
                                      wordBreak: "break-word",
                                    }}
                                  >
                                    {msg.content}
                                  </div>
                                  {isLastInGroup && (
                                    <div
                                      className="text-muted px-1 mt-1 small"
                                      style={{ fontSize: "10.5px" }}
                                    >
                                      {timeDisplay}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Chat Input Footer */}
                      <div className="chat-footer p-3 bg-white border-top">
                        <form
                          onSubmit={handleSendMessage}
                          className="d-flex align-items-center gap-2"
                        >
                          <input
                            ref={inputRef}
                            type="text"
                            className="form-control rounded-pill px-3.5 py-2.5 border bg-light text-dark shadow-none"
                            placeholder="Type your message to the group..."
                            value={newMsg}
                            onChange={(e) => setNewMsg(e.target.value)}
                            style={{ fontSize: "14px" }}
                          />
                          <button
                            type="submit"
                            disabled={!newMsg.trim() || sending}
                            className="btn btn-send shadow-sm rounded-circle d-flex align-items-center justify-content-center text-white flex-shrink-0"
                            style={{
                              width: "42px",
                              height: "42px",
                              background: !newMsg.trim() || sending ? "#93a0f7" : "#3e56f0",
                              border: "none",
                            }}
                            title="Send Message"
                          >
                            {sending ? (
                              <div
                                className="spinner-border spinner-border-sm text-white"
                                role="status"
                              ></div>
                            ) : (
                              <i className="bi bi-send-fill" style={{ fontSize: "15px" }}></i>
                            )}
                          </button>
                        </form>
                      </div>

                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Group Members Popup Modal */}
      {showMembersModal && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 1050,
            padding: "20px",
          }}
          onClick={() => setShowMembersModal(false)}
        >
          <div
            className="card border-0 rounded-4 shadow-lg overflow-hidden w-100"
            style={{ maxWidth: "520px" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              className="p-4 text-white position-relative"
              style={{
                background: "linear-gradient(135deg, #1d4ed8 0%, #3e56f0 100%)",
              }}
            >
              <button
                type="button"
                onClick={() => setShowMembersModal(false)}
                className="btn-close btn-close-white position-absolute top-0 end-0 m-3 shadow-none"
                aria-label="Close"
              ></button>
              <div className="d-flex align-items-center gap-3">
                <div
                  className="rounded-circle bg-white text-primary d-flex align-items-center justify-content-center shadow-sm"
                  style={{ width: "48px", height: "48px", fontSize: "22px" }}
                >
                  <i className="bi bi-people-fill"></i>
                </div>
                <div className="overflow-hidden">
                  <h5 className="fw-bold mb-0 text-truncate text-white">{eventName}</h5>
                  <small className="text-white-50">
                    Group Members • {members.length} {members.length === 1 ? "participant" : "participants"}
                  </small>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div
              className="p-4"
              style={{ maxHeight: "420px", overflowY: "auto", background: "#f8fafc" }}
            >
              <h6
                className="fw-bold text-dark mb-3"
                style={{
                  fontSize: "13px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Members List ({members.length})
              </h6>
              <div className="d-flex flex-column gap-2.5">
                {members.length > 0 ? (
                  members.map((member) => {
                    const status = getMemberStatus(member._id);
                    const isCurrentUser =
                      profile &&
                      (member._id === profile._id ||
                        member._id === profile.id ||
                        member.email === profile.email);

                    return (
                      <div
                        key={member._id}
                        className="d-flex align-items-center justify-content-between p-3 bg-white rounded-3 border shadow-xs"
                      >
                        <div className="d-flex align-items-center gap-3 overflow-hidden">
                          <div className="position-relative flex-shrink-0">
                            {member.profilePic ? (
                              <img
                                src={member.profilePic}
                                alt={member.fullName}
                                className="rounded-circle object-fit-cover border"
                                style={{ width: "40px", height: "40px" }}
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.style.display = "none";
                                }}
                              />
                            ) : (
                              <div
                                className="rounded-circle text-white d-flex align-items-center justify-content-center fw-bold"
                                style={{
                                  width: "40px",
                                  height: "40px",
                                  fontSize: "14px",
                                  background: "#3e56f0",
                                }}
                              >
                                {getInitials(member.fullName)}
                              </div>
                            )}
                          </div>
                          <div className="overflow-hidden">
                            <h6 className="text-dark fw-bold m-0 small text-truncate">
                              {member.fullName || "Member"}
                              {isCurrentUser && (
                                <span
                                  className="badge bg-light text-primary border ms-1.5"
                                  style={{ fontSize: "10px" }}
                                >
                                  You
                                </span>
                              )}
                            </h6>
                            <span
                              className="text-muted small text-truncate d-block"
                              style={{ fontSize: "12px" }}
                            >
                              {member.email || "No email"}
                            </span>
                          </div>
                        </div>

                        <div className="flex-shrink-0 ms-2">
                          {status === "accepted" && (
                            <span
                              className="badge bg-success-subtle text-success rounded-pill px-2.5 py-1 fw-bold text-uppercase"
                              style={{ fontSize: "9px" }}
                            >
                              Accepted
                            </span>
                          )}
                          {status === "pending" && (
                            <span
                              className="badge bg-warning-subtle text-warning rounded-pill px-2.5 py-1 fw-bold text-uppercase"
                              style={{ fontSize: "9px" }}
                            >
                              Pending
                            </span>
                          )}
                          {status === "not_invited" && (
                            <span
                              className="badge bg-secondary-subtle text-secondary rounded-pill px-2.5 py-1 fw-bold text-uppercase"
                              style={{ fontSize: "9px" }}
                            >
                              Not Invited
                            </span>
                          )}
                          {!status && (
                            <span
                              className="badge bg-primary-subtle text-primary rounded-pill px-2.5 py-1 fw-semibold text-capitalize"
                              style={{ fontSize: "9px" }}
                            >
                              Member
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-5 bg-white rounded-3 border">
                    <i className="bi bi-people fs-1 text-muted mb-2 d-block"></i>
                    <p className="text-muted small mb-0">No active members found in this group.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-white border-top text-end">
              <button
                type="button"
                onClick={() => setShowMembersModal(false)}
                className="btn btn-light border rounded-pill px-4 py-1.5 fw-semibold"
                style={{ fontSize: "13px" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading event chat room...</span>
          </div>
        </div>
      }
    >
      <ChatContent />
    </Suspense>
  );
}
