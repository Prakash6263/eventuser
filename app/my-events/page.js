"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "../components/Header";
import Footer from "../components/Footer";
import SafeImage from "../components/SafeImage";
import { getMyCreatedEventsApi } from "../services/eventApi";
import { authService } from "../services/authService";

export default function MyEventsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("All");
  const [events, setEvents] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        // Fetch user profile
        const profRes = await authService.getUserProfile();
        if (profRes && profRes.status && profRes.user) {
          setProfile(profRes.user);
        } else {
          const localUser = authService.getUser();
          if (localUser) setProfile(localUser);
        }

        // Fetch events list
        const eventsRes = await getMyCreatedEventsApi();
        if (eventsRes && eventsRes.status && Array.isArray(eventsRes.data)) {
          // Map backend events to UI structure
          const mapped = eventsRes.data.map((evt) => {
            // Date parsing & formatting
            let formattedDate = "";
            try {
              if (evt.eventDate) {
                const parts = evt.eventDate.split('-');
                if (parts.length === 3) {
                  // Format: DD-MM-YYYY (e.g. 05-08-2026)
                  const day = parts[0];
                  const monthIndex = parseInt(parts[1]) - 1;
                  const year = parts[2];

                  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                  const monthStr = monthNames[monthIndex] || parts[1];
                  const timePart = evt.eventStartTime || "";
                  formattedDate = `${day} ${monthStr} ${year} | ${timePart}`;
                } else {
                  const d = new Date(evt.eventDate);
                  if (!isNaN(d.getTime())) {
                    const options = { month: "short", day: "numeric", year: "numeric" };
                    const datePart = d.toLocaleDateString("en-US", options);
                    const timePart = evt.eventStartTime || "";
                    formattedDate = `${datePart} | ${timePart}`;
                  } else {
                    formattedDate = `${evt.eventDate || ""} | ${evt.eventStartTime || ""}`;
                  }
                }
              }
            } catch (e) {
              formattedDate = `${evt.eventDate || ""} | ${evt.eventStartTime || ""}`;
            }

            // Location formatting
            let locationStr = "Location TBD";
            if (evt.serviceLocationId) {
              const addrName = evt.serviceLocationId.addressName || "";
              const addr = evt.serviceLocationId.address || "";
              locationStr = addrName && addr ? `${addrName} - ${addr}` : (addr || addrName || "At a participating restaurant");
            } else if (evt.placeId?.preferences) {
              locationStr = evt.placeId.preferences;
            }

            // Status mapping to "Accepted" | "Waiting for Action" | "Completed" | "Upcoming" | "Ongoing"
            let uiStatus = "Ongoing";
            let badgeClass = "bg-primary";
            const rawStatus = (evt.status || evt.eventCurrentStatus || "").toLowerCase();

            if (rawStatus === "expired" || rawStatus === "completed") {
              uiStatus = "Completed";
              badgeClass = "bg-secondary";
            } else if (rawStatus === "pending") {
              uiStatus = "Waiting for Action";
              badgeClass = "bg-warning text-dark";
            } else if (rawStatus === "accepted") {
              uiStatus = "Accepted";
              badgeClass = "bg-success";
            } else if (rawStatus === "ongoingevent" || rawStatus === "ongoing") {
              uiStatus = "Upcoming";
              badgeClass = "bg-info text-dark";
            }

            return {
              id: evt._id,
              title: evt.eventTitle || "Untitled Event",
              date: formattedDate,
              location: locationStr,
              organizer: evt.eventcreator?.fullName || "Unknown Organizer",
              status: uiStatus,
              badgeClass: badgeClass,
              img: evt.image || "",
              rawEvent: evt,
            };
          });
          setEvents(mapped);
        } else {
          setError(eventsRes?.message || "Failed to load events.");
        }
      } catch (err) {
        console.error("Failed loading data:", err);
        setError(err.message || "An error occurred while fetching events.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const handleViewDetails = (rawEvent) => {
    localStorage.setItem("event-details-back-url", "/my-events");
    localStorage.setItem("event-details-back-label", "Back to My Events");
    router.push(`/event-details?id=${rawEvent._id}`);
  };

  const filteredEvents =
    activeTab === "All" ? events : events.filter((evt) => evt.status === activeTab);

  return (
    <>
      <Header />
      <div className="wrapper">
        <div className="hero-banner pb-5 pt-5">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-xl-8 col-lg-8 col-md-10">
                <div className="hero-banner-content">
                  <h2>My Account</h2>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="event-dt-block p-80">
          <div className="container">
            <div className="row">
              {/* Sidebar Navigation */}
              <div className="col-lg-3">
                <div className="user-profile-sidebar border p-4 bg-white rounded-3 shadow-sm mb-4">
                  <div className="user-profile-sidebar-top text-center mb-4">
                    <div className="user-profile-img position-relative d-inline-block mb-3">
                      <SafeImage
                        alt="Profile avatar"
                        src={profile?.profilePic || "https://st2.depositphotos.com/1006318/5909/v/450/depositphotos_59094701-stock-illustration-businessman-profile-icon.jpg"}
                        variant="profile"
                        className="rounded-circle border"
                        width="100"
                        height="100"
                        style={{ objectFit: "cover" }}
                      />
                    </div>
                    <h5 className="fw-bold">{profile?.fullName || "Loading..."}</h5>
                  </div>
                  <ul className="user-profile-sidebar-list list-unstyled m-0">
                    <li className="mb-2">
                      <Link className="d-block p-3 rounded-2 text-decoration-none fw-semibold text-muted" href="/user-profile">
                        <i className="fa fa-user me-2"></i> My Profile
                      </Link>
                    </li>
                    <li className="mb-2">
                      <Link className="active d-block p-3 rounded-2 text-decoration-none fw-semibold" href="/my-events">
                        <i className="fa fa-layer-group me-2"></i> My Events
                      </Link>
                    </li>
                    <li className="mb-2">
                      <Link className="d-block p-3 rounded-2 text-decoration-none fw-semibold text-muted" href="/my-reservations">
                        <i className="fa fa-calendar me-2"></i> My Reservations
                      </Link>
                    </li>
                    <li className="mb-2">
                      <Link className="d-block p-3 rounded-2 text-decoration-none fw-semibold text-muted" href="/notifications">
                        <i className="fa fa-bell me-2"></i> Notifications
                      </Link>
                    </li>
                    <li className="mb-2">
                      <Link className="d-block p-3 rounded-2 text-decoration-none fw-semibold text-muted" href="#">
                        <i className="fa fa-gear me-2"></i> Settings
                      </Link>
                    </li>
                    <li>
                      <Link className="d-block p-3 rounded-2 text-decoration-none fw-semibold text-muted" href="/login">
                        <i className="fa fa-sign-out me-2"></i> Logout
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>

              {/* My Events Cards Timeline */}
              <div className="col-lg-9">
                <div className="user-profile-wrapper border p-4 bg-white rounded-3 shadow-sm">
                  <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                    <h4 className="user-profile-card-title fw-bold m-0">My Events</h4>
                    {/* Status Tabs Filter */}
                    <div className="btn-group btn-group-sm" role="group">
                      {["All", "Accepted", "Completed", "Upcoming", "Ongoing"].map((tab) => (
                        <button
                          key={tab}
                          type="button"
                          className={`btn ${activeTab === tab ? "btn-primary" : "btn-outline-secondary"
                            }`}
                          onClick={() => setActiveTab(tab)}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="user-profile-form">
                    {loading ? (
                      <div className="text-center py-5">
                        <div className="spinner-border text-primary" role="status">
                          <span className="visually-hidden">Loading events...</span>
                        </div>
                      </div>
                    ) : error ? (
                      <div className="alert alert-danger text-center my-3" role="alert">
                        <i className="fa-solid fa-triangle-exclamation me-2"></i>
                        {error}
                      </div>
                    ) : filteredEvents.length === 0 ? (
                      <div className="text-center py-5">
                        <i className="fa-solid fa-calendar-xmark fs-2 text-muted mb-2"></i>
                        <p className="text-muted mb-0">No events found matching this status.</p>
                      </div>
                    ) : (
                      <div className="row g-4">
                        {filteredEvents.map((evt) => (
                          <div key={evt.id} className="col-12 col-md-6 col-lg-4">
                            <div className="event-card border rounded-3 overflow-hidden shadow-sm bg-white h-100 d-flex flex-column">
                              <SafeImage
                                src={evt.img}
                                className="event-img w-100 object-fit-cover"
                                alt={evt.title}
                                height="150"
                                variant="event"
                                fallbackLabel={evt.title}
                                fallbackSubLabel={evt.status}
                              />
                              <div className="p-3 d-flex flex-column flex-grow-1">
                                <h5 className="fw-bold text-dark text-truncate mb-2">{evt.title}</h5>
                                <p className="small text-muted mb-1">
                                  <i className="fa fa-calendar me-2"></i>
                                  {evt.date}
                                </p>
                                <p className="small text-muted mb-1 text-truncate">
                                  <i className="fa fa-map-marker me-2"></i>
                                  {evt.location}
                                </p>
                                <p className="small text-muted mb-3 text-truncate">
                                  <i className="fa fa-user-circle me-2"></i>
                                  {evt.organizer}
                                </p>
                                <div className="mt-auto d-flex justify-content-between align-items-center">
                                  <span className={`badge ${evt.badgeClass} px-2 py-1`}>
                                    {evt.status}
                                  </span>
                                  <button
                                    className="btn btn-sm btn-primary rounded-pill px-3 fw-semibold"
                                    onClick={() => handleViewDetails(evt.rawEvent)}
                                    style={{ fontSize: "12px", background: "#4f46e5", border: "none" }}
                                  >
                                    Detail
                                  </button>
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
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
