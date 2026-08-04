"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { getMerchantChatApi, sendMerchantChatMessageApi } from "../services/chatApi";

function MerchantChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const eventId = searchParams.get("eventId") || "";
  const merchantId = searchParams.get("merchantId") || "";
  const merchantNameParam = searchParams.get("merchantName") || "Restaurant";

  const [chatId, setChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [merchant, setMerchant] = useState(null); // { name, profilePic }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);

  const chatBodyRef = useRef(null);
  const chatIdRef = useRef(null);

  const getInitials = (name) => (name ? name.trim().charAt(0).toUpperCase() : "?");

  // ── Fetch (or create) the merchant chat + messages ──
  const fetchChat = async () => {
    if (!eventId || !merchantId) {
      setError("Missing event or merchant reference.");
      setLoading(false);
      return;
    }
    try {
      const res = await getMerchantChatApi(eventId, merchantId);
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

  // ── Smart polling (visibility & focus aware), mirrors group chat ──
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

  // ── Keep message viewport pinned to bottom ──
  const scrollToBottom = () => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTo({ top: chatBodyRef.current.scrollHeight, behavior: "smooth" });
    }
  };
  useEffect(() => {
    if (messages.length > 0) scrollToBottom();
  }, [messages]);

  // ── Send a message (optimistic) ──
  const handleSendMessage = async (e) => {
    e.preventDefault();
    const content = newMsg.trim();
    if (!content) return;

    const activeChatId = chatIdRef.current || chatId;
    if (!activeChatId) {
      // Chat not yet created; trigger a fetch to create it, then bail so user retries
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
    }
  };

  const merchantName = merchant?.name || merchantNameParam;
  const merchantPic = merchant?.profilePic || null;

  return (
    <>
      <Header />
      <div className="wrapper">
        <div className="event-dt-block p-80 bg-light" style={{ paddingTop: "120px", paddingBottom: "100px" }}>
          <div className="container">

            {/* Top action row */}
            <div className="d-flex justify-content-between align-items-center mb-4">
              <button
                onClick={() => router.back()}
                className="btn btn-outline-secondary rounded-pill px-4 py-2 fw-semibold d-flex align-items-center gap-2 shadow-sm bg-white border-0"
              >
                <i className="fa-solid fa-arrow-left"></i>
                Back
              </button>
              <span className="badge bg-success-subtle text-success px-3 py-2 rounded-pill shadow-sm fw-semibold d-flex align-items-center gap-2">
                <span className="bg-success rounded-circle d-inline-block" style={{ width: "8px", height: "8px" }}></span>
                Direct Chat
              </span>
            </div>

            <div className="row justify-content-center">
              <div className="col-12 col-lg-8 col-xl-7">
                <div className="card border-0 rounded-4 shadow overflow-hidden bg-white d-flex flex-column" style={{ height: "650px" }}>

                  {/* Chat header — merchant identity */}
                  <div className="bg-white border-bottom py-3 px-4 d-flex align-items-center gap-3">
                    {merchantPic ? (
                      <img
                        src={merchantPic}
                        alt={merchantName}
                        className="rounded-circle object-fit-cover border shadow-sm"
                        style={{ width: "46px", height: "46px" }}
                        onError={(e) => { e.target.onerror = null; e.target.style.display = "none"; }}
                      />
                    ) : (
                      <div className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold shadow-sm" style={{ width: "46px", height: "46px", fontSize: "18px" }}>
                        {getInitials(merchantName)}
                      </div>
                    )}
                    <div>
                      <h6 className="fw-bold m-0 text-primary" style={{ fontSize: "16px" }}>{merchantName}</h6>
                      <span className="text-success small fw-semibold d-flex align-items-center gap-1" style={{ fontSize: "12px" }}>
                        <span className="bg-success rounded-circle d-inline-block" style={{ width: "7px", height: "7px" }}></span>
                        Online
                      </span>
                    </div>
                  </div>

                  {/* Message viewport */}
                  <div ref={chatBodyRef} className="flex-grow-1 p-4 overflow-y-auto d-flex flex-column gap-3" style={{ background: "#f8f9fb" }}>
                    {loading ? (
                      <div className="d-flex flex-column align-items-center justify-content-center h-100">
                        <div className="spinner-border text-primary" role="status">
                          <span className="visually-hidden">Loading chat...</span>
                        </div>
                        <p className="text-muted mt-2 small">Loading conversation...</p>
                      </div>
                    ) : error ? (
                      <div className="text-center my-auto">
                        <i className="bi bi-exclamation-circle fs-1 text-muted mb-2 d-block"></i>
                        <h6 className="fw-semibold text-dark m-0">{error}</h6>
                        <p className="text-muted small mb-0">Please try again in a moment.</p>
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="text-center my-auto">
                        <i className="bi bi-chat-left-dots fs-1 text-muted mb-2 d-block"></i>
                        <h6 className="fw-semibold text-dark m-0">Chat Not Found</h6>
                        <p className="text-muted small mb-0">Send a message to start the conversation.</p>
                      </div>
                    ) : (
                      messages.map((msg) => {
                        const isSelf = msg.senderType === "user";
                        return (
                          <div key={msg._id} className={`d-flex gap-2 ${isSelf ? "justify-content-end" : "justify-content-start"}`}>
                            {!isSelf && (
                              <div className="flex-shrink-0">
                                {msg.sender?.profilePic || merchantPic ? (
                                  <img
                                    src={msg.sender?.profilePic || merchantPic}
                                    alt={msg.sender?.name || merchantName}
                                    className="rounded-circle object-fit-cover shadow-sm border"
                                    style={{ width: "34px", height: "34px" }}
                                    onError={(e) => { e.target.onerror = null; e.target.style.display = "none"; }}
                                  />
                                ) : (
                                  <div className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold shadow-sm" style={{ width: "34px", height: "34px", fontSize: "12px" }}>
                                    {getInitials(msg.sender?.name || merchantName)}
                                  </div>
                                )}
                              </div>
                            )}
                            <div style={{ maxWidth: "72%" }} className={isSelf ? "text-end" : ""}>
                              <div
                                className={`p-3 rounded-3 shadow-sm text-start ${isSelf ? "bg-primary text-white" : "bg-white text-dark border border-light"}`}
                                style={{
                                  fontSize: "14px",
                                  borderRadius: isSelf ? "12px 12px 0 12px" : "12px 12px 12px 0",
                                  lineHeight: "1.5",
                                }}
                              >
                                {msg.content}
                              </div>
                              <div className="text-muted mt-1 px-1 small" style={{ fontSize: "10px" }}>
                                {msg.timeAgo || new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Input */}
                  <form className="p-3 bg-white border-top d-flex gap-2 align-items-center" onSubmit={handleSendMessage}>
                    <input
                      type="text"
                      className="form-control rounded-pill px-4 py-2.5 border bg-light"
                      placeholder="Type your message here..."
                      value={newMsg}
                      onChange={(e) => setNewMsg(e.target.value)}
                      style={{ fontSize: "14px" }}
                    />
                    <button
                      type="submit"
                      className="btn btn-primary rounded-circle d-flex align-items-center justify-content-center shadow-sm"
                      style={{ width: "42px", height: "42px", flexShrink: 0 }}
                      disabled={!newMsg.trim() || sending}
                    >
                      <i className="bi bi-send-fill text-white" style={{ fontSize: "15px" }}></i>
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
    <Suspense fallback={
      <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading chat...</span>
        </div>
      </div>
    }>
      <MerchantChatContent />
    </Suspense>
  );
}
