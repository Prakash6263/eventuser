"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Header from "./components/Header";
import Footer from "./components/Footer";
import SafeImage from "./components/SafeImage";
import { handleAuthFailure, isAuthFailureResponse, isLoggedIn } from "./services/apiClient";
import { getEventGroupChatApi } from "./services/chatApi";
import { getEventMediaApi } from "./services/eventApi";

export default function Home() {
  const router = useRouter();
  const [eventName, setEventName] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("");

  // Modal states for simulated actions (Chat & Gallery)
  const [activeChatEvent, setActiveChatEvent] = useState(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatGroupData, setChatGroupData] = useState(null);
  const [chatMode, setChatMode] = useState("members"); // "members" or "conversation"
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");

  const [activeGalleryEvent, setActiveGalleryEvent] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [galleryLoading, setGalleryLoading] = useState(false);

  const handleCreateEventClick = (e) => {
    e.preventDefault();
    if (isLoggedIn()) {
      router.push("/create-event");
    } else {
      router.push("/login");
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    // Redirect or search filter logic here if needed
  };

  // Dynamic services and merchants states
  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [servicesError, setServicesError] = useState(null);

  const [selectedService, setSelectedService] = useState(null);
  const [merchants, setMerchants] = useState([]);
  const [loadingMerchants, setLoadingMerchants] = useState(false);
  const [merchantsError, setMerchantsError] = useState(null);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        setLoadingServices(true);
        setServicesError(null);
        const res = await fetch("https://eventuna.com/api/merchant/services");
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const json = await res.json();
        if (json.status) {
          setServices(json.services);
        } else {
          setServicesError(json.message || "Failed to fetch services");
        }
      } catch (err) {
        setServicesError(err.message || "Network error fetching services");
      } finally {
        setLoadingServices(false);
      }
    };
    fetchServices();
  }, []);

  const handleServiceClick = async (service) => {
    setSelectedService(service);
    try {
      setLoadingMerchants(true);
      setMerchantsError(null);
      setMerchants([]);
      const res = await fetch(`https://eventuna.com/api/merchant/merchants-by-service?serviceId=${service._id}`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const json = await res.json();
      if (json.status) {
        setMerchants(json.data || []);
      } else {
        setMerchantsError(json.message || "Failed to fetch merchants");
      }
    } catch (err) {
      setMerchantsError(err.message || "Network error fetching merchants");
    } finally {
      setLoadingMerchants(false);
    }
  };

  const handleViewMerchantDetails = (merchant) => {
    localStorage.setItem("eventuna-latest-merchant", JSON.stringify(merchant));
    setSelectedService(null); // Close the modal
    router.push(`/merchant-details?id=${merchant._id}`);
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
  const handleOpenGallery = async (evt, e) => {
    e.stopPropagation();
    const userStatus = evt.status?.toLowerCase();
    const isAccepted = ["accepted", "ongoing", "approved", "ongoingevent"].includes(userStatus);
    
    if (!isAccepted) {
      setActiveGalleryEvent({
        ...evt,
        photos: [],
        notAcceptedMessage: "You can only view event media files once your invitation has been accepted."
      });
      setGalleryLoading(false);
      return;
    }

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

  const handleViewEventDetails = (evt) => {
    const rawEvent = evt.rawEvent;
    localStorage.setItem("event-details-back-url", "/");
    localStorage.setItem("event-details-back-label", "Back to Home");
    router.push(`/event-details?id=${rawEvent._id || evt.id}`);
  };

  const getServiceIcon = (name) => {
    const n = name.toLowerCase();
    if (n.includes("restaurant")) return "/images/icons/venue-events.png";
    if (n.includes("facility")) return "/images/icons/online-class.png";
    if (n.includes("catering")) return "/images/icons/training-workshop.png";
    if (n.includes("decoration")) return "/images/icons/webinar.png";
    if (n.includes("photography")) return "/images/icons/talk-show.png";
    if (n.includes("music") || n.includes("dj")) return "/images/icons/venue-events.png";
    if (n.includes("furniture")) return "/images/icons/training-workshop.png";
    if (n.includes("servant") || n.includes("cleaning")) return "/images/icons/online-class.png";
    if (n.includes("entertainment") || n.includes("clown")) return "/images/icons/talk-show.png";
    return null;
  };

  const getServiceColorClass = (name) => {
    const colors = [
      "bg-primary-subtle text-primary border border-primary-subtle",
      "bg-success-subtle text-success border border-success-subtle",
      "bg-danger-subtle text-danger border border-danger-subtle",
      "bg-warning-subtle text-warning border border-warning-subtle",
      "bg-info-subtle text-info border border-info-subtle",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };


  // Dynamic upcoming events states
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [eventsError, setEventsError] = useState(null);
  const [token, setToken] = useState(null);

  // Auto-scroll refs
  const servicesScrollRef = useRef(null);
  const eventsScrollRef = useRef(null);

  // Auto-scroll services slider (every 2 seconds)
  useEffect(() => {
    if (loadingServices || services.length === 0) return;
    const interval = setInterval(() => {
      const container = servicesScrollRef.current;
      if (container) {
        const maxScroll = container.scrollWidth - container.clientWidth;
        if (container.scrollLeft >= maxScroll - 10) {
          container.scrollTo({ left: 0, behavior: "smooth" });
        } else {
          // Cards are 220px wide + 24px gap = 244px
          container.scrollBy({ left: 244, behavior: "smooth" });
        }
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [services, loadingServices]);

  // Auto-scroll upcoming events slider (every 2 seconds)
  useEffect(() => {
    if (loadingEvents || upcomingEvents.length === 0) return;
    const interval = setInterval(() => {
      const container = eventsScrollRef.current;
      if (container) {
        const maxScroll = container.scrollWidth - container.clientWidth;
        if (container.scrollLeft >= maxScroll - 10) {
          container.scrollTo({ left: 0, behavior: "smooth" });
        } else {
          // Cards are 280px wide + 24px gap = 304px
          container.scrollBy({ left: 304, behavior: "smooth" });
        }
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [upcomingEvents, loadingEvents]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setToken(localStorage.getItem("user_token"));
    }
  }, []);

  useEffect(() => {
    const fetchUpcomingEvents = async () => {
      const activeToken = typeof window !== "undefined" ? localStorage.getItem("user_token") : null;
      if (!activeToken) {
        setLoadingEvents(false);
        return;
      }
      try {
        setLoadingEvents(true);
        setEventsError(null);
        const res = await fetch("https://eventuna.com/api/event/events?myevent=true", {
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
        if (json.status && Array.isArray(json.data)) {
          const mapped = json.data.map((evt) => {
            let formattedMonthDay = "";
            let formattedTime = evt.eventStartTime || "";
            try {
              if (evt.eventDate) {
                const parts = evt.eventDate.split('-');
                if (parts.length === 3) {
                  const day = parts[0];
                  const monthIndex = parseInt(parts[1]) - 1;
                  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                  const monthStr = monthNames[monthIndex] || parts[1];
                  formattedMonthDay = `${day} ${monthStr}`;
                } else {
                  const d = new Date(evt.eventDate);
                  if (!isNaN(d.getTime())) {
                    formattedMonthDay = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
              location: locationStr,
              img: evt.image || "",
              date: formattedMonthDay,
              time: formattedTime,
              status: evt.myInvitationStatus || evt.status || evt.eventCurrentStatus || "pending",
              duration: evt.eventEndTime ? `to ${evt.eventEndTime}` : "",
              rawEvent: evt
            };
          });
          setUpcomingEvents(mapped.slice(0, 8)); // Limit to first 8 upcoming events on home page
        } else {
          setEventsError(json.message || "Failed to fetch events");
        }
      } catch (err) {
        setEventsError(err.message || "Network error fetching events");
      } finally {
        setLoadingEvents(false);
      }
    };

    fetchUpcomingEvents();
  }, []);

  return (
    <>
      <Header />
      <div className="wrapper">
        {/* Hero Banner */}
        <div className="hero-banner">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-lg-10">
                <div className="hero-banner-content">
                  <h2>Find & Organize Unforgettable Events</h2>
                  <p>Discover premium wedding venues, live music bands, and top-rated photographers near you.</p>
                  
                  {/* Search form removed */}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Categories Block */}
        <div className="host-engaging-event-block p-80">
          <div className="container">
            <div className="row">
              <div className="col-lg-10">
                <div className="main-title">
                  <h3>Services</h3>
                  <p>Explore merchant services to build your event.</p>
                </div>
              </div>
              <div className="col-lg-12 mt-4">
                <div 
                  ref={servicesScrollRef}
                  className="d-flex flex-nowrap overflow-auto gap-4 pb-3 no-scrollbar" 
                  style={{ scrollSnapType: "x mandatory" }}
                >
                  {loadingServices ? (
                    <div className="w-100 text-center py-5">
                      <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                      <p className="text-muted mt-2 small">Loading categories...</p>
                    </div>
                  ) : servicesError ? (
                    <div className="w-100">
                      <div className="alert alert-danger border-0 rounded-3 p-3 text-center my-3" role="alert">
                        <i className="bi bi-exclamation-triangle me-2"></i>
                        {servicesError}
                      </div>
                    </div>
                  ) : services.length > 0 ? (
                    <>
                      {services.map((service) => (
                        <div 
                          key={service._id} 
                          className="flex-shrink-0"
                          onClick={() => handleServiceClick(service)}
                          style={{ width: "220px", cursor: "pointer", scrollSnapAlign: "start" }}
                        >
                          <div className="main-card h-100">
                            <div className="host-item text-center h-100 d-flex flex-column justify-content-center">
                              <div className="host-img mb-3 d-flex align-items-center justify-content-center" style={{ height: "45px" }}>
                                {getServiceIcon(service.servicesName) ? (
                                  <img src={getServiceIcon(service.servicesName)} alt={service.servicesName} className="mx-auto" />
                                ) : (
                                  <div 
                                    className={`d-flex align-items-center justify-content-center rounded-circle mx-auto fw-bold ${getServiceColorClass(service.servicesName)}`}
                                    style={{ width: "45px", height: "45px", fontSize: "18px" }}
                                  >
                                    {service.servicesName.charAt(0).toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <h4 style={{ fontSize: "14px", fontWeight: "600", margin: 0 }}>{service.servicesName}</h4>
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className="flex-shrink-0" style={{ width: "20px" }}></div>
                    </>
                  ) : (
                    <div className="w-100 text-center py-5">
                      <p className="text-muted small">No categories found.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Upcoming Events Grid */}
        <div className="explore-events p-80">
          <div className="container">
            <div className="row">
              <div className="col-xl-12 col-lg-12 col-md-12">
                <div className="main-title">
                  <h3>Upcoming Events</h3>
                </div>
              </div>
              <div className="col-xl-12 col-lg-12 col-md-12 mt-4">
                <div className="event-filter-items">
                  <div className="featured-controls">
                    {loadingEvents ? (
                      <div className="text-center py-5">
                        <div className="spinner-border text-primary" role="status">
                          <span className="visually-hidden">Loading...</span>
                        </div>
                        <p className="text-muted mt-2 small">Loading upcoming events...</p>
                      </div>
                    ) : !token ? (
                      <div className="text-center py-5 bg-light rounded-4 border p-4 my-3">
                        <i className="bi bi-calendar-event fs-1 text-muted d-block mb-2"></i>
                        <h5 className="fw-bold text-dark mb-1">Your Upcoming Events</h5>
                        <p className="text-muted small mb-3">Please sign in to see your personalized upcoming events list.</p>
                        <Link href="/login" className="btn btn-primary rounded-pill px-4 fw-bold">
                          Login Now
                        </Link>
                      </div>
                    ) : eventsError ? (
                      <div>
                        <div className="alert alert-danger border-0 rounded-3 p-3 text-center my-3" role="alert">
                          <i className="bi bi-exclamation-triangle me-2"></i>
                          {eventsError}
                        </div>
                      </div>
                    ) : upcomingEvents.length > 0 ? (
                      <div 
                        ref={eventsScrollRef}
                        className="d-flex flex-nowrap overflow-auto gap-4 pb-3 no-scrollbar" 
                        style={{ scrollSnapType: "x mandatory" }}
                      >
                        {upcomingEvents.map((evt) => (
                          <div 
                            key={evt.id} 
                            className="flex-shrink-0" 
                            style={{ width: "280px", scrollSnapAlign: "start" }}
                          >
                            <div className="main-card mt-0 h-100" style={{ cursor: "pointer" }} onClick={() => handleViewEventDetails(evt)}>
                              <div className="event-thumbnail" style={{ height: "180px", overflow: "hidden", position: "relative" }}>
                                <div className="thumbnail-img h-100 w-100">
                                  <SafeImage
                                    src={evt.img}
                                    alt={evt.title}
                                    className="w-100 h-100"
                                    style={{ objectFit: "cover" }}
                                    variant="event"
                                    fallbackLabel={evt.title}
                                    fallbackSubLabel="Upcoming event"
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
                              <div className="event-content">
                                <div className="event-title fw-bold text-dark mb-1">
                                  {evt.title}
                                </div>
                                <div className="featuredeventcardtext card-text">
                                  <div>
                                    <i className="fa fa-map"></i>
                                  </div>
                                  <div className="featuredeventlocation">{evt.location}</div>
                                </div>
                              </div>
                              <div className="event-footer">
                                <div className="event-timing">
                                  <div className="publish-date">
                                    <span>
                                      <i className="fa-solid fa-calendar-day me-2"></i>
                                      {evt.date}
                                    </span>
                                    <span className="dot">
                                      <i className="fa-solid fa-circle"></i>
                                    </span>
                                    <span>{evt.time}</span>
                                  </div>
                                  <span className="publish-time">
                                    <i className="fa-solid fa-clock me-2"></i>
                                    {evt.duration}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                        {/* Trailing scroll margin spacer */}
                        <div className="flex-shrink-0" style={{ width: "20px" }}></div>
                      </div>
                    ) : (
                      <div className="text-center py-5">
                        <p className="text-muted small">No upcoming events found.</p>
                      </div>
                    )}
                    <div className="browse-btn text-center mt-5">
                      <Link href="/events" className="main-btn btn-hover">
                        Browse All
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Banner */}
        <div className="p-80 bg-white">
          <div className="container">
            <div className="cta-banner rounded-4 p-5 position-relative overflow-hidden shadow-lg">
              <div className="row align-items-center z-index-2 position-relative">
                <div className="col-lg-9 text-white mb-4 mb-lg-0">
                  <span className="badge bg-white text-primary rounded-pill px-3 py-2 fw-semibold mb-3">
                    CREATE EVENT
                  </span>
                  <h2 className="fw-bold display-6 mb-2 text-white">Have an Event Idea? Let&apos;s make it Real</h2>
                  <p className="text-white mb-0">
                    Create events effortlessly, reserve spectacular spaces, and book verified premium services simultaneously.
                  </p>
                </div>
                <div className="col-lg-3 text-lg-end">
                  <a href="/create-event" className="btn btn-light text-primary rounded-pill fw-bold px-5 py-3 border-0 shadow-sm shadow-hover" onClick={handleCreateEventClick}>
                    Create Event Now <i className="fa-solid fa-chevron-right ms-2 fs-6"></i>
                  </a>
                </div>
              </div>
              <div className="cta-circle-1"></div>
              <div className="cta-circle-2"></div>
            </div>
          </div>
        </div>



        {/* Testimonials Slider Area */}
        <div className="testimonial-block p-80 bg-dark-new">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-lg-10">
                <div className="main-title text-center">
                  <h3 className="text-white">Testimonials</h3>
                  <p className="text-white">
                    We are continuously thriving to bring the best to our customers so they can easily participate in your events. Here is what some of our clients have to say:
                  </p>
                </div>
              </div>
              <div className="col-lg-12 mt-4">
                <div className="row g-4 row-cols-1 row-cols-md-2 justify-content-center">
                  <div className="col">
                    <div className="main-card p-4 bg-white rounded-3">
                      <div className="testimonial-content">
                        <div className="testimonial-text mb-3">
                          <p>
                            &quot;Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus maximus arcu et ligula maximus vehicula. Phasellus at luctus lacus, quis eleifend nibh. Nam vitae convallis nisi, vitae tempus risus.&quot;
                          </p>
                        </div>
                        <div className="testimonial-user-dt d-flex justify-content-between align-items-center">
                          <div>
                            <h5 className="mb-0 fw-bold">Madeline S.</h5>
                            <span className="small text-muted">Events Co-ordinator</span>
                          </div>
                          <ul className="list-inline mb-0 text-warning">
                            <li className="list-inline-item m-0"><i className="fa-solid fa-star"></i></li>
                            <li className="list-inline-item m-0"><i className="fa-solid fa-star"></i></li>
                            <li className="list-inline-item m-0"><i className="fa-solid fa-star"></i></li>
                            <li className="list-inline-item m-0"><i className="fa-solid fa-star"></i></li>
                            <li className="list-inline-item m-0"><i className="fa-solid fa-star"></i></li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col">
                    <div className="main-card p-4 bg-white rounded-3">
                      <div className="testimonial-content">
                        <div className="testimonial-text mb-3">
                          <p>
                            &quot;Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus maximus arcu et ligula maximus vehicula. Phasellus at luctus lacus, quis eleifend nibh. Nam vitae convallis nisi, vitae tempus risus.&quot;
                          </p>
                        </div>
                        <div className="testimonial-user-dt d-flex justify-content-between align-items-center">
                          <div>
                            <h5 className="mb-0 fw-bold">Gabrielle B.</h5>
                            <span className="small text-muted">Administration</span>
                          </div>
                          <ul className="list-inline mb-0 text-warning">
                            <li className="list-inline-item m-0"><i className="fa-solid fa-star"></i></li>
                            <li className="list-inline-item m-0"><i className="fa-solid fa-star"></i></li>
                            <li className="list-inline-item m-0"><i className="fa-solid fa-star"></i></li>
                            <li className="list-inline-item m-0"><i className="fa-solid fa-star"></i></li>
                            <li className="list-inline-item m-0"><i className="fa-solid fa-star"></i></li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Latest Blogs Block */}
        <div className="p-80 bg-white">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-lg-10">
                <div className="main-title text-center">
                  <h3>Latest Blogs</h3>
                  <p>Stay updated with the most recent Blogs</p>
                </div>
              </div>
            </div>
            <div className="isdesktop row mt-4">
              <div className="latestblog3 col-xxl-6 col-xl-6 col-lg-6 col-md-6 col-sm-6 mb-4">
                <div className="latestblogcard card shadow-sm border-0">
                  <div className="latestblogcardimage">
                    <img className="card-img-top latestblogimage" src="/images/1.jpg" alt="Blog 1" />
                  </div>
                  <div className="latestblogbody card-body">
                    <p className="latestblogdate card-text small text-muted">July 05, 2025</p>
                    <h5 className="latestblogtitle card-title fw-bold">
                      The Magic of Christmas: A Season of Joy and Celebration
                    </h5>
                    <p className="latestblogdescription card-text small text-muted">
                      Christmas is more than just a holiday—it’s a time of love, joy, and togetherness. From sparkling lights and festive decorations to heartfelt traditions, this season brings warmth and happiness to people around the world.
                    </p>
                    <button className="latestblogbutton border-0 bg-transparent text-primary fw-bold p-0 d-flex align-items-center">
                      Read More
                      <span className="latestblogarrow ms-2">
                        <svg height="12" viewBox="0 0 12 12" width="12" xmlns="http://www.w3.org/2000/svg">
                          <path clipRule="evenodd" d="M11.7803 5.46967C12.0732 5.76256 12.0732 6.23744 11.7803 6.53033L7.28033 11.0303C6.98744 11.3232 6.51256 11.3232 6.21967 11.0303C5.92678 10.7374 5.92678 10.2626 6.21967 9.96967L9.43934 6.75L0.75 6.75C0.335787 6.75 0 6.41421 0 6C0 5.58579 0.335787 5.25 0.75 5.25L9.43934 5.25L6.21967 2.03033C5.92678 1.73744 5.92678 1.26256 6.21967 0.96967C6.51256 0.676777 6.98744 0.676777 7.28033 0.96967L11.7803 5.46967Z" fill="#0D263C" fillRule="evenodd"></path>
                        </svg>
                      </span>
                    </button>
                  </div>
                </div>
              </div>
              <div className="latestblog3 col-xxl-6 col-xl-6 col-lg-6 col-md-6 col-sm-6">
                <div className="row g-3">
                  <div className="col-12">
                    <div className="latestblogcard1 card shadow-sm border-0 d-flex flex-row p-3 align-items-center">
                      <img className="latestblogimage1 rounded-3 object-fit-cover" src="/images/2.jpg" alt="Blog 2" width="120" height="120" />
                      <div className="ms-3 flex-grow-1 min-w-0">
                        <p className="latestblogdate1 card-text small text-muted mb-1">July 05, 2025</p>
                        <h6 className="latestblogtitle1 card-title fw-bold mb-1 text-truncate">
                          The Rise of Green Energy: Powering a Sustainable Future
                        </h6>
                        <p className="latestblogdescription1 card-text small text-muted mb-2 text-truncate">
                          As the world shifts towards sustainability, green energy is revolutionizing the way we power our lives.
                        </p>
                        <button className="latestblogbutton border-0 bg-transparent text-primary fw-bold p-0 d-flex align-items-center">
                          Read More
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="col-12">
                    <div className="latestblogcard1 card shadow-sm border-0 d-flex flex-row p-3 align-items-center">
                      <img className="latestblogimage1 rounded-3 object-fit-cover" src="/images/3.jpg" alt="Blog 3" width="120" height="120" />
                      <div className="ms-3 flex-grow-1 min-w-0">
                        <p className="latestblogdate1 card-text small text-muted mb-1">July 05, 2025</p>
                        <h6 className="latestblogtitle1 card-title fw-bold mb-1 text-truncate">
                          Colors of Tradition: A Journey Through Cultural Festivals
                        </h6>
                        <p className="latestblogdescription1 card-text small text-muted mb-2 text-truncate">
                          Cultural festivals are a vibrant celebration of heritage, bringing together traditions, art, and music.
                        </p>
                        <button className="latestblogbutton border-0 bg-transparent text-primary fw-bold p-0 d-flex align-items-center">
                          Read More
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="col-12">
                    <div className="latestblogcard1 card shadow-sm border-0 d-flex flex-row p-3 align-items-center">
                      <img className="latestblogimage1 rounded-3 object-fit-cover" src="/images/4.jpg" alt="Blog 4" width="120" height="120" />
                      <div className="ms-3 flex-grow-1 min-w-0">
                        <p className="latestblogdate1 card-text small text-muted mb-1">July 05, 2025</p>
                        <h6 className="latestblogtitle1 card-title fw-bold mb-1 text-truncate">
                          Rhythms of the Night: The Ultimate Concert Experience
                        </h6>
                        <p className="latestblogdescription1 card-text small text-muted mb-2 text-truncate">
                          Music concerts are more than just performances; they are electrifying experiences.
                        </p>
                        <button className="latestblogbutton border-0 bg-transparent text-primary fw-bold p-0 d-flex align-items-center">
                          Read More
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedService && (
        <div className="modal fade show d-block" style={{ background: "rgba(5, 2, 62, 0.65)", backdropFilter: "blur(4px)", zIndex: 1050 }}>
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable px-3" style={{ maxWidth: "800px" }}>
            <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden" style={{ maxHeight: "85vh" }}>
              <div className="modal-header border-bottom py-3 px-4 d-flex justify-content-between align-items-center bg-light">
                <div>
                  <h5 className="modal-title fw-bold text-dark m-0" style={{ fontSize: "19px" }}>
                    {selectedService.servicesName} Providers
                  </h5>
                  <p className="text-muted small m-0 mt-0.5">Explore available merchants in this category</p>
                </div>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setSelectedService(null)}
                  style={{ background: "none", border: "none", fontSize: "20px", color: "#333", cursor: "pointer" }}
                >
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>

              <div className="modal-body p-4 bg-light" style={{ overflowY: "auto" }}>
                {loadingMerchants ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="text-muted mt-2 small">Loading providers...</p>
                  </div>
                ) : merchantsError ? (
                  <div className="alert alert-danger border-0 rounded-3 p-3 text-center my-3" role="alert">
                    <i className="bi bi-exclamation-triangle me-2"></i>
                    {merchantsError}
                  </div>
                ) : merchants.length > 0 ? (
                  <div className="d-flex flex-column gap-3">
                    {merchants.map((merchant) => (
                      <div key={merchant._id} className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white p-3 mb-2">
                        <div className="row g-3">
                          {/* Image */}
                          <div className="col-md-4">
                            <div className="position-relative h-100 rounded-3 overflow-hidden" style={{ minHeight: "150px" }}>
                              <img 
                                src={merchant.bannerImage || "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80"} 
                                alt={merchant.serviceName}
                                className="w-100 h-100"
                                style={{ objectFit: "cover", position: "absolute", top: 0, left: 0 }}
                              />
                              {merchant.isVerified && (
                                <span className="position-absolute top-2 start-2 badge bg-success shadow-sm">
                                  <i className="bi bi-patch-check-fill me-1"></i>Verified
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Info */}
                          <div className="col-md-8 d-flex flex-column justify-content-between">
                            <div>
                              <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
                                <h5 className="fw-bold text-dark m-0" style={{ fontSize: "17px" }}>
                                  {merchant.serviceName}
                                </h5>
                                {merchant.onlineReservation && (
                                  <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                                    Online Booking
                                  </span>
                                )}
                              </div>
                              {merchant.serviceSlogan && (
                                <p className="text-primary fw-medium small mb-2">{merchant.serviceSlogan}</p>
                              )}
                              <p className="text-muted small mb-3" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: "1.5" }}>
                                {merchant.serviceDescription || "No description provided."}
                              </p>

                              {/* Location & Capacity info */}
                              <div className="row g-2 mb-3 bg-light rounded-3 p-2.5">
                                <div className="col-sm-8 d-flex align-items-start gap-1.5 text-muted small">
                                  <i className="bi bi-geo-alt text-primary mt-0.5"></i>
                                  <span>
                                    {merchant.serviceLocationIds?.[0]?.address || "Location not specified"}
                                  </span>
                                </div>
                                {merchant.serviceLocationIds?.[0]?.capacity && (
                                  <div className="col-sm-4 d-flex align-items-center gap-1.5 text-muted small justify-content-sm-end">
                                    <i className="bi bi-people text-primary"></i>
                                    <span>Max {merchant.serviceLocationIds[0].capacity} guests</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 border-top pt-3 mt-1">
                              {/* Coupon offers */}
                              <div>
                                {merchant.couponIds?.[0] && (
                                  <div className="badge bg-danger-subtle text-danger border border-danger-subtle px-2.5 py-1.5 rounded-pill d-flex align-items-center gap-1">
                                    <i className="bi bi-tag-fill"></i>
                                    <span className="fw-bold">{merchant.couponIds[0].couponName}</span>
                                    <span>({merchant.couponIds[0].discount}% OFF)</span>
                                  </div>
                                )}
                              </div>

                              {/* Contact options */}
                              <div className="d-flex gap-2">
                                <button 
                                  onClick={() => handleViewMerchantDetails(merchant)} 
                                  className="btn btn-primary rounded-pill px-4 py-2 text-white fw-bold shadow-sm border-0 d-flex align-items-center gap-1"
                                  style={{ fontSize: "13px", transition: "all 0.2s ease" }}
                                >
                                  Details
                                  <i className="bi bi-arrow-right-short fs-5"></i>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-5">
                    <i className="bi bi-building-dash fs-1 text-muted"></i>
                    <h5 className="fw-bold mt-2">No providers found</h5>
                    <p className="text-muted small">There are currently no merchants registered under this service category.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
                {activeGalleryEvent.notAcceptedMessage ? (
                  <div className="text-center py-5 px-3">
                    <i className="bi bi-lock-fill fs-1 text-warning mb-3 d-block"></i>
                    <h5 className="fw-bold text-dark mb-2">Access Restricted</h5>
                    <p className="text-muted small mb-0">{activeGalleryEvent.notAcceptedMessage}</p>
                  </div>
                ) : galleryLoading ? (
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
