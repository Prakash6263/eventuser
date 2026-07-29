"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "./components/Header";
import Footer from "./components/Footer";
import SafeImage from "./components/SafeImage";
import { handleAuthFailure, isAuthFailureResponse, isLoggedIn } from "./services/apiClient";

export default function Home() {
  const router = useRouter();
  const [eventName, setEventName] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("");

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

    localStorage.setItem("event-details-back-url", "/");
    localStorage.setItem("event-details-back-label", "Back to Home");
    localStorage.setItem("eventuna-latest-event", JSON.stringify(detailEvent));
    router.push("/event-details");
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
                <div className="d-flex flex-nowrap overflow-auto gap-4 pb-3 no-scrollbar" style={{ scrollSnapType: "x mandatory" }}>
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
                    services.map((service) => (
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
                    ))
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
              <div className="col-xl-12 col-lg-12 col-md-12">
                <div className="event-filter-items">
                  <div className="featured-controls">
                    <div className="row">
                      {loadingEvents ? (
                        <div className="col-12 text-center py-5">
                          <div className="spinner-border text-primary" role="status">
                            <span className="visually-hidden">Loading...</span>
                          </div>
                          <p className="text-muted mt-2 small">Loading upcoming events...</p>
                        </div>
                      ) : !token ? (
                        <div className="col-12 text-center py-5 bg-light rounded-4 border p-4 my-3">
                          <i className="bi bi-calendar-event fs-1 text-muted d-block mb-2"></i>
                          <h5 className="fw-bold text-dark mb-1">Your Upcoming Events</h5>
                          <p className="text-muted small mb-3">Please sign in to see your personalized upcoming events list.</p>
                          <Link href="/login" className="btn btn-primary rounded-pill px-4 fw-bold">
                            Login Now
                          </Link>
                        </div>
                      ) : eventsError ? (
                        <div className="col-12">
                          <div className="alert alert-danger border-0 rounded-3 p-3 text-center my-3" role="alert">
                            <i className="bi bi-exclamation-triangle me-2"></i>
                            {eventsError}
                          </div>
                        </div>
                      ) : upcomingEvents.length > 0 ? (
                        upcomingEvents.map((evt) => (
                          <div key={evt.id} className="col-xl-3 col-lg-4 col-md-6 col-sm-12">
                            <div className="main-card mt-4" style={{ cursor: "pointer" }} onClick={() => handleViewEventDetails(evt)}>
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
                        ))
                      ) : (
                        <div className="col-12 text-center py-5">
                          <p className="text-muted small">No upcoming events found.</p>
                        </div>
                      )}
                    </div>
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
                  <h2 className="fw-bold display-6 mb-2 text-white">Have an Event Idea? Let's make it Real</h2>
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

        {/* Nearby Services Lists */}
        <div className="p-80">
          <div className="container">
            <div className="row g-4">
              {/* Nearby Places */}
              <div className="col-lg-4">
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <h4 className="fw-bold text-dark mb-0">Nearby Places</h4>
                  <Link href="#" className="small text-decoration-none">
                    See All
                  </Link>
                </div>
                <div className="d-flex flex-column gap-3">
                  <div className="list-item-card d-flex align-items-center p-3 rounded-3 bg-white shadow-sm border">
                    <img
                      src="https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=150"
                      alt="venue"
                      className="rounded-3 flex-shrink-0 object-fit-cover"
                      width="70"
                      height="70"
                    />
                    <div className="ms-3 flex-grow-1 min-w-0">
                      <h6 className="fw-bold mb-1 text-truncate text-dark">Royal Wedding Palace</h6>
                      <p className="text-muted small mb-1 text-truncate">
                        <i className="fa-solid fa-location-dot me-1"></i>Radius Gallery - Santa Cruz
                      </p>
                      <span className="badge bg-success-subtle text-success border border-success-subtle px-2">Open</span>
                    </div>
                    <div className="d-flex flex-column align-items-end justify-content-between h-100 gap-3">
                      <i className="fa-solid fa-bookmark text-danger cursor-pointer"></i>
                      <Link href="#" className="detail-link font-weight-bold">
                        DETAILS
                      </Link>
                    </div>
                  </div>
                  <div className="list-item-card d-flex align-items-center p-3 rounded-3 bg-white shadow-sm border">
                    <img
                      src="https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=150"
                      alt="venue"
                      className="rounded-3 flex-shrink-0 object-fit-cover"
                      width="70"
                      height="70"
                    />
                    <div className="ms-3 flex-grow-1 min-w-0">
                      <h6 className="fw-bold mb-1 text-truncate text-dark">Grand Ballroom Palace</h6>
                      <p className="text-muted small mb-1 text-truncate">
                        <i className="fa-solid fa-location-dot me-1"></i>Radius Gallery - Santa Cruz
                      </p>
                      <span className="badge bg-success-subtle text-success border border-success-subtle px-2">Open</span>
                    </div>
                    <div className="d-flex flex-column align-items-end justify-content-between h-100 gap-3">
                      <i className="fa-regular fa-bookmark cursor-pointer text-muted"></i>
                      <Link href="#" className="detail-link">
                        DETAILS
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              {/* Nearby Bands */}
              <div className="col-lg-4">
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <h4 className="fw-bold text-dark mb-0">Nearby Music Bands</h4>
                  <Link href="#" className="small text-decoration-none">
                    See All
                  </Link>
                </div>
                <div className="d-flex flex-column gap-3">
                  <div className="list-item-card d-flex align-items-center p-3 rounded-3 bg-white shadow-sm border">
                    <img
                      src="https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=150"
                      alt="band"
                      className="rounded-3 flex-shrink-0 object-fit-cover"
                      width="70"
                      height="70"
                    />
                    <div className="ms-3 flex-grow-1 min-w-0">
                      <h6 className="fw-bold mb-1 text-truncate text-dark">The Symphony Band 1</h6>
                      <p className="text-muted small mb-1 text-truncate">
                        <i className="fa-solid fa-location-dot me-1"></i>Radius Gallery - Santa Cruz
                      </p>
                      <span className="badge bg-success-subtle text-success border border-success-subtle px-2">Open</span>
                    </div>
                    <div className="d-flex flex-column align-items-end justify-content-between h-100 gap-3">
                      <i className="fa-solid fa-bookmark text-danger cursor-pointer"></i>
                      <Link href="#" className="detail-link">
                        DETAILS
                      </Link>
                    </div>
                  </div>
                  <div className="list-item-card d-flex align-items-center p-3 rounded-3 bg-white shadow-sm border">
                    <img
                      src="https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=150"
                      alt="band"
                      className="rounded-3 flex-shrink-0 object-fit-cover"
                      width="70"
                      height="70"
                    />
                    <div className="ms-3 flex-grow-1 min-w-0">
                      <h6 className="fw-bold mb-1 text-truncate text-dark">Rock Beats - Band 2</h6>
                      <p className="text-muted small mb-1 text-truncate">
                        <i className="fa-solid fa-location-dot me-1"></i>Radius Gallery - Santa Cruz
                      </p>
                      <span className="badge bg-success-subtle text-success border border-success-subtle px-2">Open</span>
                    </div>
                    <div className="d-flex flex-column align-items-end justify-content-between h-100 gap-3">
                      <i className="fa-regular fa-bookmark cursor-pointer text-muted"></i>
                      <Link href="#" className="detail-link">
                        DETAILS
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              {/* Nearby Photographers */}
              <div className="col-lg-4">
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <h4 className="fw-bold text-dark mb-0">Nearby Photographers</h4>
                  <Link href="#" className="small text-decoration-none">
                    See All
                  </Link>
                </div>
                <div className="d-flex flex-column gap-3">
                  <div className="list-item-card d-flex align-items-center p-3 rounded-3 bg-white shadow-sm border">
                    <img
                      src="https://images.unsplash.com/photo-1554080353-a576cf803bda?w=150"
                      alt="photography"
                      className="rounded-3 flex-shrink-0 object-fit-cover"
                      width="70"
                      height="70"
                    />
                    <div className="ms-3 flex-grow-1 min-w-0">
                      <h6 className="fw-bold mb-1 text-truncate text-dark">Jon Photography Studio</h6>
                      <p className="text-muted small mb-1 text-truncate">
                        <i className="fa-solid fa-location-dot me-1"></i>Radius Gallery - Santa Cruz
                      </p>
                      <span className="badge bg-success-subtle text-success border border-success-subtle px-2">Open</span>
                    </div>
                    <div className="d-flex flex-column align-items-end justify-content-between h-100 gap-3">
                      <i className="fa-solid fa-bookmark text-danger cursor-pointer"></i>
                      <Link href="#" className="detail-link">
                        DETAILS
                      </Link>
                    </div>
                  </div>
                  <div className="list-item-card d-flex align-items-center p-3 rounded-3 bg-white shadow-sm border">
                    <img
                      src="https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=150"
                      alt="photography"
                      className="rounded-3 flex-shrink-0 object-fit-cover"
                      width="70"
                      height="70"
                    />
                    <div className="ms-3 flex-grow-1 min-w-0">
                      <h6 className="fw-bold mb-1 text-truncate text-dark">The Frame Image Studio</h6>
                      <p className="text-muted small mb-1 text-truncate">
                        <i className="fa-solid fa-location-dot me-1"></i>Radius Gallery - Santa Cruz
                      </p>
                      <span className="badge bg-success-subtle text-success border border-success-subtle px-2">Open</span>
                    </div>
                    <div className="d-flex flex-column align-items-end justify-content-between h-100 gap-3">
                      <i className="fa-regular fa-bookmark cursor-pointer text-muted"></i>
                      <Link href="#" className="detail-link">
                        DETAILS
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
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
                            "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus maximus arcu et ligula maximus vehicula. Phasellus at luctus lacus, quis eleifend nibh. Nam vitae convallis nisi, vitae tempus risus."
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
                            "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus maximus arcu et ligula maximus vehicula. Phasellus at luctus lacus, quis eleifend nibh. Nam vitae convallis nisi, vitae tempus risus."
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
      <Footer />
    </>
  );
}
