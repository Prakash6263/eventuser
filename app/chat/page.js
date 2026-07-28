"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { authService } from "../services/authService";
import { getEventGroupChatApi, getChatMessagesApi, sendChatMessageApi } from "../services/chatApi";

function ChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const chatId = searchParams.get("chatId") || "6a4cca33db2ad40b3d32e882";
  const eventName = searchParams.get("eventName") || "Group Chat";
  const eventId = searchParams.get("eventId") || "";

  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newMsg, setNewMsg] = useState("");
  const [profile, setProfile] = useState(null);
  const [eventDetails, setEventDetails] = useState(null);
  
  const chatBodyRef = useRef(null);

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

  // Fetch group details / members list
  useEffect(() => {
    async function fetchGroupDetails() {
      if (!eventId) return;
      try {
        const res = await getEventGroupChatApi(eventId);
        if (res && res.status && res.data && Array.isArray(res.data.members)) {
          setMembers(res.data.members);
        }
      } catch (err) {
        console.error("Failed to load group details:", err);
      }
    }
    fetchGroupDetails();
  }, [eventId]);

  // Fetch event details to get invitation status of members
  useEffect(() => {
    async function loadEventDetails() {
      if (!eventId) return;
      const token = typeof window !== "undefined" ? localStorage.getItem("user_token") : null;
      try {
        const res = await fetch("https://eventuna.com/api/event/events", {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (res.ok) {
          const json = await res.json();
          if (json.status && Array.isArray(json.data)) {
            const match = json.data.find(e => e._id === eventId);
            if (match) {
              setEventDetails(match);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load event details:", err);
      }
    }
    loadEventDetails();
  }, [eventId]);

  // Fetch group messages from backend
  const fetchMessages = async () => {
    try {
      const res = await getChatMessagesApi(chatId);
      if (res && res.status && Array.isArray(res.data)) {
        setMessages(res.data);
      } else {
        setError(res?.message || "Failed to load messages.");
      }
    } catch (err) {
      setError(err.message || "Network error loading chat messages.");
    } finally {
      setLoading(false);
    }
  };

  // Smart Polling Configuration (Visibility and Focus Aware)
  useEffect(() => {
    fetchMessages();
    
    let intervalId = null;

    const startPolling = () => {
      if (!intervalId) {
        intervalId = setInterval(() => {
          if (typeof document !== "undefined" && !document.hidden) {
            fetchMessages();
          }
        }, 4000); // Poll every 4s only when tab is active
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
  }, [chatId]);

  // Scroll inner container to bottom smoothly, without moving the main browser viewport window
  const scrollToBottom = () => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTo({
        top: chatBodyRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMsg.trim()) return;

    const token = typeof window !== "undefined" ? localStorage.getItem("user_token") : null;
    const msgContent = newMsg.trim();
    setNewMsg("");

    // Optimistic UI Update
    const optimisticMessage = {
      _id: `temp-${Date.now()}`,
      chatId: chatId,
      sender: {
        _id: profile?._id || "user-self",
        fullName: profile?.fullName || "You",
        profilePic: profile?.profilePic || null,
        email: profile?.email || ""
      },
      content: msgContent,
      createdAt: new Date().toISOString(),
      timeAgo: "Just now"
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      const res = await sendChatMessageApi(chatId, msgContent);
      if (res && res.status && res.data) {
        fetchMessages();
      }
    } catch (err) {
      console.error("Failed to send message to group:", err);
    }
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name.trim().charAt(0).toUpperCase();
  };

  const getMemberStatus = (memberId) => {
    if (!eventDetails) return null;
    if (Array.isArray(eventDetails.contactList)) {
      const match = eventDetails.contactList.find(c => c._id === memberId || c.userId === memberId);
      if (match && match.status) return match.status;
    }
    if (Array.isArray(eventDetails.invitedUsers)) {
      const match = eventDetails.invitedUsers.find(u => u.userId?._id === memberId || u.userId === memberId || u._id === memberId);
      if (match && match.status) return match.status;
    }
    return null;
  };

  return (
    <>
      <Header />
      <div className="wrapper">
        <div className="event-dt-block p-80 bg-light" style={{ paddingTop: "120px", paddingBottom: "100px" }}>
          <div className="container">
            
            {/* Header Action Row */}
            <div className="d-flex justify-content-between align-items-center mb-4">
              <Link href="/events" className="btn btn-outline-secondary rounded-pill px-4 py-2 fw-semibold d-flex align-items-center gap-2 shadow-sm bg-white border-0">
                <i className="fa-solid fa-arrow-left"></i>
                Back to Events
              </Link>
              <span className="badge bg-success-subtle text-success px-3 py-2 rounded-pill shadow-sm fw-semibold d-flex align-items-center gap-2">
                <span className="bg-success rounded-circle d-inline-block animate-pulse" style={{ width: "8px", height: "8px" }}></span>
                Live Event Channel
              </span>
            </div>

            <div className="row justify-content-center">
              <div className="col-12 col-xl-10">
                
                {/* Premium 2-Column Chat Widget */}
                <div className="card border-0 rounded-4 shadow overflow-hidden bg-white d-flex flex-row" style={{ height: "650px" }}>
                  
                  {/* Left Sidebar: Event & Members (Hidden on Mobile) */}
                  <div className="d-none d-md-flex flex-column border-end bg-white" style={{ width: "300px", flexShrink: 0 }}>
                    <div className="p-4 border-bottom bg-light">
                      <span className="badge bg-primary-subtle text-primary mb-2 px-2.5 py-1.5 rounded-pill fw-bold text-uppercase" style={{ fontSize: "10px" }}>
                        Event Chat
                      </span>
                      <h5 className="fw-bold text-dark mb-1 line-clamp-2" style={{ fontSize: "16px", lineHeight: "1.4" }}>
                        {eventName}
                      </h5>
                      <p className="text-muted small mb-0">Secure collaboration channel</p>
                    </div>
                    <div className="p-4 overflow-y-auto flex-grow-1">
                      <h6 className="fw-bold text-dark mb-3" style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        Group Members
                      </h6>
                      <div className="d-flex flex-column gap-3">
                        {members.length > 0 ? (
                          members.map((member) => (
                            <div key={member._id} className="d-flex align-items-center justify-content-between gap-2">
                              <div className="d-flex align-items-center gap-3 overflow-hidden">
                                <div className="position-relative">
                                  {member.profilePic ? (
                                    <img src={member.profilePic} alt={member.fullName} className="rounded-circle object-fit-cover border" style={{ width: "36px", height: "36px" }} />
                                  ) : (
                                    <div className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold text-uppercase" style={{ width: "36px", height: "36px", fontSize: "13px" }}>
                                      {getInitials(member.fullName)}
                                    </div>
                                  )}
                                  <span className="position-absolute bottom-0 end-0 bg-success border border-white rounded-circle" style={{ width: "10px", height: "10px" }}></span>
                                </div>
                                <div className="overflow-hidden">
                                  <h6 className="text-dark fw-bold m-0 small text-truncate" style={{ fontSize: "13px" }}>{member.fullName}</h6>
                                  <span className="text-muted small text-truncate d-block" style={{ fontSize: "11px" }}>{member.email}</span>
                                </div>
                              </div>
                              <div className="flex-shrink-0">
                                {getMemberStatus(member._id) === "accepted" && (
                                  <span className="badge bg-success-subtle text-success rounded-pill px-2.5 py-0.5 fw-bold text-uppercase" style={{ fontSize: "8px" }}>Accepted</span>
                                )}
                                {getMemberStatus(member._id) === "pending" && (
                                  <span className="badge bg-warning-subtle text-warning rounded-pill px-2.5 py-0.5 fw-bold text-uppercase" style={{ fontSize: "8px" }}>Pending</span>
                                )}
                                {getMemberStatus(member._id) === "not_invited" && (
                                  <span className="badge bg-secondary-subtle text-secondary rounded-pill px-2.5 py-0.5 fw-bold text-uppercase" style={{ fontSize: "8px" }}>Not Invited</span>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-4 bg-light rounded-3">
                            <i className="bi bi-people fs-4 text-muted mb-2 d-block"></i>
                            <p className="text-muted small mb-0">No active members found.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Messaging Area */}
                  <div className="d-flex flex-column flex-grow-1 bg-light">
                    
                    {/* Active Header */}
                    <div className="bg-white border-bottom py-3 px-4 d-flex align-items-center justify-content-between">
                      <div className="d-flex align-items-center gap-3">
                        <div className="bg-primary-subtle text-primary rounded-circle d-flex align-items-center justify-content-center" style={{ width: "40px", height: "40px" }}>
                          <i className="bi bi-chat-left-text-fill" style={{ fontSize: "18px" }}></i>
                        </div>
                        <div>
                          <h6 className="fw-bold m-0 text-dark" style={{ fontSize: "15px" }}>Conversation Feed</h6>
                          <span className="text-muted small" style={{ fontSize: "11px" }}>{messages.length} messages</span>
                        </div>
                      </div>
                    </div>

                    {/* Message viewport */}
                    <div 
                      ref={chatBodyRef}
                      className="flex-grow-1 p-4 overflow-y-auto d-flex flex-column gap-3.5"
                    >
                      {loading ? (
                        <div className="d-flex flex-column align-items-center justify-content-center h-100">
                          <div className="spinner-border text-primary" role="status">
                            <span className="visually-hidden">Loading chat...</span>
                          </div>
                          <p className="text-muted mt-2 small">Loading conversation history...</p>
                        </div>
                      ) : messages.length === 0 ? (
                        <div className="text-center my-auto">
                          <i className="bi bi-chat-left-dots fs-1 text-muted mb-2 d-block"></i>
                          <h6 className="fw-semibold text-dark m-0">No Messages Yet</h6>
                          <p className="text-muted small mb-0">Start the conversation by typing below.</p>
                        </div>
                      ) : (
                        messages.map((msg) => {
                          const isSelf = profile && msg.sender?._id === profile._id;
                          return (
                            <div key={msg._id} className={`d-flex gap-3 ${isSelf ? "justify-content-end" : "justify-content-start"}`}>
                              {!isSelf && (
                                <div className="flex-shrink-0">
                                  {msg.sender?.profilePic ? (
                                    <img 
                                      src={msg.sender.profilePic} 
                                      alt={msg.sender.fullName}
                                      className="rounded-circle object-fit-cover shadow-sm border"
                                      style={{ width: "36px", height: "36px" }}
                                    />
                                  ) : (
                                    <div className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold shadow-sm" style={{ width: "36px", height: "36px", fontSize: "13px" }}>
                                      {getInitials(msg.sender?.fullName)}
                                    </div>
                                  )}
                                </div>
                              )}
                              <div style={{ maxWidth: "70%" }} className={isSelf ? "text-end" : ""}>
                                {!isSelf && (
                                  <div className="text-muted fw-semibold mb-1 ps-1" style={{ fontSize: "11px" }}>
                                    {msg.sender?.fullName || "Participant"}
                                  </div>
                                )}
                                <div 
                                  className={`p-3 rounded-3 shadow-sm text-start ${
                                    isSelf 
                                      ? "bg-primary text-white" 
                                      : "bg-white text-dark border border-light"
                                  }`} 
                                  style={{ 
                                    fontSize: "14px", 
                                    borderRadius: isSelf ? "12px 12px 0 12px" : "12px 12px 12px 0",
                                    lineHeight: "1.5"
                                  }}
                                >
                                  {msg.content}
                                </div>
                                <div className="text-muted mt-1.5 px-1 small" style={{ fontSize: "10px" }}>
                                  {msg.timeAgo || new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Input form */}
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
                        disabled={!newMsg.trim()}
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
      </div>
      <Footer />
    </>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading event chat room...</span>
        </div>
      </div>
    }>
      <ChatContent />
    </Suspense>
  );
}
