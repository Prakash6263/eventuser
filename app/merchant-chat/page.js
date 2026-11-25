"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Header from "../components/Header";
import Footer from "../components/Footer";
import SafeImage from "../components/SafeImage";
import { getMerchantChatApi, sendMerchantChatMessageApi } from "../services/chatApi";
import { getMerchantsByServiceApi } from "../services/eventApi";
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
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);

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

  // Fetch chat
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

  // Scroll to bottom
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

  // Send message
  const handleSendMessage = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const content = newMsg.trim();
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

  return (
    <>
      <Header />
      <div className="wrapper flex-grow-1" style={{ background: "#f8f9fa", flex: "1 0 auto" }}>
        <div className="event-dt-block p-80" style={{ paddingTop: "90px", paddingBottom: "70px" }}>
          <div className="container">
            <div className="row">

              {/* Left Profile Sidebar (identical to vendor side dashboard layout) */}
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

              {/* Right Chat Window */}
              <div className="col-lg-9 col-md-8">
                <div className="user-profile-wrapper">
                  <div
                    className="chat-card shadow-sm border rounded-4 overflow-hidden bg-white mb-4"
                    style={{ borderColor: "#edf2f7" }}
                  >
                    <div
                      className="chat-window d-flex flex-column"
                      style={{ height: "600px", background: "#fcfcfd" }}
                    >

                      {/* Chat Header */}
                      <div className="chat-header p-3 px-4 bg-white border-bottom d-flex align-items-center justify-content-between">
                        <div className="d-flex align-items-center gap-3">
                          <button
                            type="button"
                            onClick={() => router.back()}
                            className="btn btn-sm btn-white border rounded-pill px-3 py-1.5 fw-medium d-inline-flex align-items-center gap-2 shadow-xs text-secondary hover-shadow transition"
                            style={{ fontSize: "13px", background: "#ffffff", borderColor: "#e2e8f0" }}
                          >
                            <i className="bi bi-arrow-left text-primary fw-bold" style={{ fontSize: "14px" }}></i>
                            <span>Back</span>
                          </button>

                          <div
                            className="avatar-wrapper position-relative flex-shrink-0"
                            style={{ width: "42px", height: "42px" }}
                          >
                            {merchantPic ? (
                              <img
                                src={merchantPic}
                                alt={merchantName}
                                className="rounded-circle border shadow-xs"
                                style={{ width: "42px", height: "42px", objectFit: "cover" }}
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.style.display = "none";
                                }}
                              />
                            ) : (
                              <div
                                className="rounded-circle text-white d-flex align-items-center justify-content-center fw-bold shadow-xs"
                                style={{
                                  width: "42px",
                                  height: "42px",
                                  fontSize: "16px",
                                  background: "#3e56f0",
                                }}
                              >
                                {getInitials(merchantName)}
                              </div>
                            )}
                          </div>

                          <div>
                            <h6 className="fw-bold mb-0 text-dark" style={{ fontSize: "15px", letterSpacing: "-0.2px" }}>
                              {merchantName}
                            </h6>
                            <small
                              className="text-muted fw-medium d-inline-flex align-items-center gap-1"
                              style={{ fontSize: "12px" }}
                            >
                              <span className="text-success fw-semibold">Online</span> • Restaurant Partner
                            </small>
                          </div>
                        </div>

                        <div className="d-flex align-items-center gap-2">
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
                          <button
                            type="button"
                            className="btn btn-sm btn-white border rounded-circle d-flex align-items-center justify-content-center text-muted shadow-xs transition"
                            style={{ width: "34px", height: "34px", background: "#ffffff", borderColor: "#e2e8f0" }}
                            onClick={fetchChat}
                            title="Refresh Chat"
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
                            <p className="small text-muted mb-0">Loading conversation...</p>
                          </div>
                        ) : error ? (
                          <div className="text-center my-auto py-4">
                            <i className="bi bi-exclamation-circle text-danger fs-2 mb-2 d-block"></i>
                            <h6 className="fw-semibold text-dark mb-1">{error}</h6>
                            <button
                              type="button"
                              onClick={fetchChat}
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
                              Send a message to start the conversation with {merchantName}.
                            </p>
                          </div>
                        ) : (
                          messages.map((msg, idx) => {
                            const isSelf = msg.senderType === "user";
                            const prevMsg = idx > 0 ? messages[idx - 1] : null;
                            const nextMsg = idx < messages.length - 1 ? messages[idx + 1] : null;
                            const isFirstInGroup = !prevMsg || prevMsg.senderType !== msg.senderType;
                            const isLastInGroup = !nextMsg || nextMsg.senderType !== msg.senderType;

                            return (
                              <div
                                key={msg._id || idx}
                                className={`d-flex flex-column ${
                                  isSelf ? "align-items-end" : "align-items-start"
                                }`}
                                style={{
                                  maxWidth: "68%",
                                  alignSelf: isSelf ? "flex-end" : "flex-start",
                                  marginTop: isFirstInGroup ? (idx === 0 ? "0" : "12px") : "3px",
                                }}
                              >
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
                                    fontSize: "14.5px",
                                    lineHeight: "1.5",
                                    wordBreak: "break-word",
                                  }}
                                >
                                  {msg.content}
                                </div>
                                {isLastInGroup && (
                                  <div
                                    className="text-muted px-1 mt-1 small"
                                    style={{ fontSize: "11px" }}
                                  >
                                    {msg.timeAgo ||
                                      (msg.createdAt
                                        ? new Date(msg.createdAt).toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          })
                                        : "Just now")}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Chat Input Footer */}
                      <div className="chat-footer p-3 bg-white border-top">
                        <form onSubmit={handleSendMessage} className="d-flex align-items-center gap-2">
                          <input
                            ref={inputRef}
                            type="text"
                            className="form-control rounded-pill px-3.5 py-2.5 border bg-light text-dark shadow-none"
                            placeholder="Type your message here..."
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
