"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { getMerchantChatApi, sendMerchantChatMessageApi } from "../services/chatApi";
import { getMerchantsByServiceApi } from "../services/eventApi";
import { apiRequest } from "../services/apiClient";

function MerchantChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const eventId = searchParams.get("eventId") || "";
  const merchantId = searchParams.get("merchantId") || "";
  const merchantNameParam = searchParams.get("merchantName") || "Restaurant";

  const [chatId, setChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [merchant, setMerchant] = useState(null);
  const [eventData, setEventData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);

  const chatBodyRef = useRef(null);
  const chatIdRef = useRef(null);
  const resolvedMerchantIdRef = useRef(merchantId);
  const inputRef = useRef(null);

  const getInitials = (name) => (name ? name.trim().charAt(0).toUpperCase() : "?");

  // Load Event Context (optional, for title display)
  useEffect(() => {
    async function loadEvent() {
      if (!eventId) return;
      try {
        const evRes = await apiRequest(`/event/eventbyId?id=${eventId}`);
        if (evRes && evRes.status && evRes.data) {
          setEventData(evRes.data);
        }
      } catch (e) {
        // quiet ignore
      }
    }
    loadEvent();
  }, [eventId]);

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
      <div className="wrapper" style={{ background: "#f8f9fa", minHeight: "100vh" }}>
        <div style={{ paddingTop: "120px", paddingBottom: "70px" }}>
          <div className="container" style={{ maxWidth: "860px" }}>

            {/* Top Bar with Back and Info */}
            <div className="d-flex align-items-center justify-content-between mb-3 px-1">
              <button
                type="button"
                onClick={() => router.back()}
                className="btn btn-light bg-white border rounded-pill px-3 py-1.5 fw-semibold d-flex align-items-center gap-2 shadow-xs"
                style={{ fontSize: "13px" }}
              >
                <i className="fa-solid fa-arrow-left text-primary"></i>
                <span>Back</span>
              </button>

              {eventData?.eventTitle && (
                <div className="text-muted small d-none d-sm-block text-truncate" style={{ maxWidth: "320px" }}>
                  Event: <strong className="text-dark">{eventData.eventTitle}</strong>
                </div>
              )}

              {eventId && (
                <Link
                  href={`/event-details?id=${eventId}`}
                  className="btn btn-outline-primary rounded-pill px-3 py-1.5 fw-semibold small d-flex align-items-center gap-1.5 bg-white"
                  style={{ fontSize: "12.5px" }}
                >
                  <i className="fa-solid fa-calendar-days"></i>
                  <span>View Event</span>
                </Link>
              )}
            </div>

            {/* Simple, Clean Chat Card */}
            <div
              className="card border-0 rounded-4 shadow-sm overflow-hidden bg-white"
              style={{ border: "1px solid #edf2f7" }}
            >
              {/* Chat Header */}
              <div className="p-3 px-4 bg-white border-bottom d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-3">
                  <div className="position-relative flex-shrink-0">
                    {merchantPic ? (
                      <img
                        src={merchantPic}
                        alt={merchantName}
                        className="rounded-circle object-fit-cover border"
                        style={{ width: "46px", height: "46px" }}
                        onError={(e) => { e.target.onerror = null; e.target.style.display = "none"; }}
                      />
                    ) : (
                      <div
                        className="rounded-circle text-white d-flex align-items-center justify-content-center fw-bold shadow-xs"
                        style={{
                          width: "46px",
                          height: "46px",
                          fontSize: "18px",
                          background: "#3e56f0",
                        }}
                      >
                        {getInitials(merchantName)}
                      </div>
                    )}
                    <span
                      className="position-absolute bottom-0 end-0 rounded-circle border border-2 border-white bg-success"
                      style={{ width: "11px", height: "11px" }}
                    ></span>
                  </div>

                  <div>
                    <h6 className="fw-bold mb-0 text-dark" style={{ fontSize: "16px" }}>
                      {merchantName}
                    </h6>
                    <small className="text-success fw-medium d-flex align-items-center gap-1" style={{ fontSize: "12px" }}>
                      <span className="bg-success rounded-circle d-inline-block" style={{ width: "6px", height: "6px" }}></span>
                      Online • Restaurant Partner
                    </small>
                  </div>
                </div>

                <div className="d-flex align-items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-light border rounded-circle d-flex align-items-center justify-content-center text-muted"
                    style={{ width: "36px", height: "36px" }}
                    onClick={fetchChat}
                    title="Refresh Chat"
                  >
                    <i className="fa-solid fa-rotate-right" style={{ fontSize: "13px" }}></i>
                  </button>
                </div>
              </div>

              {/* Chat Body */}
              <div
                ref={chatBodyRef}
                className="p-4 overflow-y-auto d-flex flex-column gap-3"
                style={{
                  background: "#f8fafc",
                  height: "500px",
                  overflowX: "hidden",
                }}
              >
                {loading ? (
                  <div className="text-center text-muted my-auto py-5">
                    <div className="spinner-border spinner-border-sm text-primary mb-2" role="status"></div>
                    <p className="small text-muted mb-0">Loading conversation...</p>
                  </div>
                ) : error ? (
                  <div className="text-center my-auto py-4">
                    <i className="fa-solid fa-circle-exclamation text-danger fs-3 mb-2 d-block"></i>
                    <h6 className="fw-semibold text-dark mb-1">{error}</h6>
                    <button
                      type="button"
                      onClick={fetchChat}
                      className="btn btn-outline-primary btn-sm rounded-pill px-3 mt-2"
                    >
                      Retry
                    </button>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center my-auto py-5">
                    <div
                      className="rounded-circle bg-light d-flex align-items-center justify-content-center mx-auto mb-3 text-muted"
                      style={{ width: "56px", height: "56px", fontSize: "22px" }}
                    >
                      <i className="fa-regular fa-comments"></i>
                    </div>
                    <h6 className="fw-bold text-dark mb-1">No Messages Yet</h6>
                    <p className="text-muted small mb-0">Send a message to start the conversation with {merchantName}.</p>
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const isSelf = msg.senderType === "user";
                    return (
                      <div
                        key={msg._id || idx}
                        className={`d-flex flex-column ${isSelf ? "align-items-end" : "align-items-start"}`}
                        style={{ maxWidth: "72%", alignSelf: isSelf ? "flex-end" : "flex-start" }}
                      >
                        <div
                          className="p-3 shadow-xs"
                          style={{
                            borderRadius: "16px",
                            borderBottomRightRadius: isSelf ? "4px" : "16px",
                            borderBottomLeftRadius: isSelf ? "16px" : "4px",
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
                      </div>
                    );
                  })
                )}
              </div>

              {/* Chat Footer Input */}
              <div className="p-3 bg-white border-top">
                <form onSubmit={handleSendMessage} className="d-flex align-items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    className="form-control rounded-pill px-3.5 py-2.5 border bg-light text-dark shadow-none"
                    placeholder={`Type your message here...`}
                    value={newMsg}
                    onChange={(e) => setNewMsg(e.target.value)}
                    style={{ fontSize: "14px" }}
                  />
                  <button
                    type="submit"
                    disabled={!newMsg.trim() || sending}
                    className="btn rounded-circle text-white d-flex align-items-center justify-content-center shadow-sm flex-shrink-0"
                    style={{
                      width: "42px",
                      height: "42px",
                      background: !newMsg.trim() || sending ? "#93a0f7" : "#3e56f0",
                      border: "none",
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
