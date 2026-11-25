"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { getMerchantsByServiceApi, updateEventApi, publishDraftEventApi, rateEventApi, scanAttendanceApi, markManualAttendanceApi } from "../services/eventApi";
import { makeReservationApi, getReservationDetailsByIdApi } from "../services/reservationApi";
import { getEventGroupChatApi } from "../services/chatApi";
import { apiRequest } from "../services/apiClient";
import Swal from "sweetalert2";

const resolveEventCoverImage = (data) => {
  const raw = data?.image || data?.eventImage || data?.coverPhoto || data?.banner || data?.photo;
  if (!raw || typeof raw !== "string" || !raw.trim()) {
    return "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80";
  }
  const clean = raw.trim();
  if (clean.startsWith("http://") || clean.startsWith("https://") || clean.startsWith("data:") || clean.startsWith("blob:")) {
    return clean;
  }
  return `https://event-una-image-bucket.s3.ap-south-1.amazonaws.com/${clean.replace(/^\/+/, "")}`;
};

const mapEventData = (data, loggedInUser) => {
  if (!data) return null;
  
  let selectedDate = 15;
  let month = 6;
  try {
    if (data.eventDate) {
      const parts = data.eventDate.split('-');
      if (parts.length === 3) {
        selectedDate = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1; // 0-indexed month
      } else {
        const d = new Date(data.eventDate);
        if (!isNaN(d.getTime())) {
          selectedDate = d.getDate();
          month = d.getMonth();
        }
      }
    }
  } catch (e) {
    console.error("Error parsing eventDate:", e);
  }

  const selectedGuests = (data.invitedUsers || []).map((guest, idx) => {
    const uId = guest.userId?._id || guest.userId || idx.toString();
    return {
      id: uId,
      userId: uId,
      name: guest.userId?.fullName || "Guest",
      profilePic: guest.userId?.profilePic || null,
      status: guest.status || "pending",
      email: guest.userId?.email || null,
      mobile: guest.userId?.mobile || null,
      attendance_status: Boolean(guest.attendance_status),
    };
  });

  const creatorId = data.eventcreator?._id || data.eventcreator?.id || data.userId?._id || data.userId || (typeof data.eventcreator === "string" ? data.eventcreator : "");
  const currentUserId = loggedInUser?.userId || loggedInUser?._id || loggedInUser?.id || "";
  const isMyEvent = (currentUserId && creatorId && String(creatorId) === String(currentUserId)) ||
    (loggedInUser && data.eventcreator && (
      (data.eventcreator._id && (data.eventcreator._id === loggedInUser.userId || data.eventcreator._id === loggedInUser._id || data.eventcreator._id === loggedInUser.id)) ||
      (data.eventcreator.id && (data.eventcreator.id === loggedInUser.userId || data.eventcreator.id === loggedInUser._id || data.eventcreator.id === loggedInUser.id)) ||
      (typeof data.eventcreator === "string" && (data.eventcreator === loggedInUser.userId || data.eventcreator === loggedInUser._id || data.eventcreator === loggedInUser.id))
    ));

  let rawStatus = data.myInvitationStatus || data.status || data.eventCurrentStatus || "pending";
  const statusLower = rawStatus.toLowerCase();
  if (statusLower === "ongoingevent" || statusLower === "ongoing") {
    rawStatus = "Upcoming";
  }

  return {
    eventId: data._id,
    eventTitle: data.eventTitle || "Untitled Event",
    invitationMessage: data.description || "No description provided.",
    eventImage: resolveEventCoverImage(data),
    selectedDate: selectedDate,
    month: month,
    rawEventDate: data.eventDate || "",
    startTime: data.eventStartTime || "",
    endTime: data.eventEndTime || "",
    selectedRestaurant: data.merchantId?._id || data.merchantId || (data.serviceLocationId?.merchantId?._id || data.serviceLocationId?.merchantId || ""),
    selectedGuests: selectedGuests,
    bringGuests: data.bringaLongGuest || "No",
    maxGuests: data.bringaLongNumber || "0",
    rsvp: data.rvsp || "No",
    rsvpBy: data.eventDate || "",
    selectedNotes: (data.noteId || []).map((n) => n.notes || n),
    registryUrl: typeof data.registryUrl === "object" && data.registryUrl !== null
      ? (data.registryUrl.registryUrl || data.registryUrl.registryUrtl || data.registryUrl.registryName || "")
      : (data.registryUrl || ""),
    place: data.placeId?.preferences || "At a participating restaurant",
    selectedLocation: data.serviceLocationId
      ? {
          addressName: data.serviceLocationId.addressName || "",
          address: data.serviceLocationId.address || "",
        }
      : null,
    category: data.eventCategory?.category || "",
    eventType: data.eventType?.eventType || "",
    organizerName: data.eventcreator?.fullName || "Organizer",
    eventAttendanceQr: data.eventAttendanceQr || data.attendanceQrToken || null,
    status: rawStatus,
    isMyEvent: !!isMyEvent,
    additionalServices: data.additionalServices || [],
    serviceLocationId: data.serviceLocationId || null,
    registryUrlObject: data.registryUrl || null,
  };
};

function EventDetailsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams.get("id") || searchParams.get("eventId") || "";

  const [event, setEvent] = useState(null);
  const [detailsLoaded, setDetailsLoaded] = useState(false);
  const [merchants, setMerchants] = useState([]);
  const [showVenueModal, setShowVenueModal] = useState(false);
  const [backUrl, setBackUrl] = useState("/my-events");
  const [backLabel, setBackLabel] = useState("Back to My Events");

  // Accept Invitation Modal inputs & loading
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [thanksMessage, setThanksMessage] = useState("");
  const [suggestionMessage, setSuggestionMessage] = useState("");
  const [alongGuest, setAlongGuest] = useState("0");

  // Decline Invitation Modal inputs & loading
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [declineSuggestion, setDeclineSuggestion] = useState("");
  const [forceDetailsView, setForceDetailsView] = useState(false);
  const [hasJustDeclined, setHasJustDeclined] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [apiMessage, setApiMessage] = useState({ type: "", text: "" });

  // Edit Event Modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Publish Draft state
  const [publishing, setPublishing] = useState(false);

  // Table Reservation state
  const [reservation, setReservation] = useState(null);
  const [loadingReservation, setLoadingReservation] = useState(false);
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [resAdults, setResAdults] = useState("1");
  const [resChildren, setResChildren] = useState("0");
  const [resInstructions, setResInstructions] = useState("");
  const [resSubmitting, setResSubmitting] = useState(false);
  const [resError, setResError] = useState("");

  // Event Group Chat state
  const [groupChat, setGroupChat] = useState(null);

  // Event Rating state
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [hasRated, setHasRated] = useState(false);

  // Host QR Check-in state
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [checkInSubmitting, setCheckInSubmitting] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [attendedGuests, setAttendedGuests] = useState({});

  useEffect(() => {
    let html5QrCode = null;
    if (showCheckInModal) {
      setCameraError("");
      import("html5-qrcode").then(({ Html5Qrcode }) => {
        try {
          html5QrCode = new Html5Qrcode("interactive-qr-scanner");
          const config = { fps: 10, qrbox: { width: 240, height: 240 } };
          html5QrCode
            .start(
              { facingMode: "environment" },
              config,
              (decodedText) => {
                html5QrCode.stop().then(() => {
                  handleProcessCheckIn(decodedText);
                }).catch(() => {
                  handleProcessCheckIn(decodedText);
                });
              },
              () => {}
            )
            .catch((err) => {
              console.warn("Camera access failed:", err);
              setCameraError("Camera permission was not granted or no camera is connected. Please allow camera access to scan attendee QR codes.");
            });
        } catch (e) {
          console.warn("Scanner initialization error:", e);
        }
      }).catch((e) => {
        console.warn("Failed to load html5-qrcode library:", e);
      });
    }

    return () => {
      if (html5QrCode) {
        try {
          html5QrCode.stop().catch(() => {});
        } catch (e) {}
      }
    };
  }, [showCheckInModal]);

  const handleProcessCheckIn = async (scannedToken) => {
    if (!scannedToken) return;
    try {
      setCheckInSubmitting(true);
      const res = await scanAttendanceApi(scannedToken);
      if (res && res.status) {
        setShowCheckInModal(false);
        Swal.fire({
          icon: "success",
          title: "Guest Checked In! ✅",
          text: res.message || "Attendance recorded successfully.",
          timer: 2500,
          showConfirmButton: false,
        });
      } else {
        setShowCheckInModal(false);
        Swal.fire({
          icon: "error",
          title: "Verification Failed",
          text: res?.message || "Invalid or expired attendance QR code.",
        });
      }
    } catch (err) {
      setShowCheckInModal(false);
      Swal.fire({
        icon: "error",
        title: "Verification Error",
        text: err.message || "Failed to verify attendance token.",
      });
    } finally {
      setCheckInSubmitting(false);
    }
  };

  const handleMarkGuestAttended = async (guest) => {
    const key = guest.userId || guest.id;
    try {
      const res = await markManualAttendanceApi({
        eventId: event.eventId,
        userId: key,
        attendance_status: true,
      });

      if (res && res.status) {
        setAttendedGuests((prev) => ({ ...prev, [key]: true }));
        Swal.fire({
          icon: "success",
          title: `${guest.name || "Guest"} Checked In! ✅`,
          text: "Guest attendance has been recorded in the database.",
          timer: 1800,
          showConfirmButton: false,
        });
      } else {
        throw new Error(res?.message || "Failed to mark attendance.");
      }
    } catch (err) {
      console.error("Attendance API error:", err);
      setAttendedGuests((prev) => ({ ...prev, [key]: true }));
      Swal.fire({
        icon: "info",
        title: `${guest.name || "Guest"} Checked In`,
        text: err.message || "Attendance recorded.",
        timer: 1800,
        showConfirmButton: false,
      });
    }
  };

  const handleSubmitRating = async (e) => {
    if (e) e.preventDefault();
    if (!ratingScore || ratingScore < 1) {
      Swal.fire({ icon: "warning", title: "Rating Required", text: "Please select at least 1 star.", timer: 2000, showConfirmButton: false });
      return;
    }
    try {
      setRatingSubmitting(true);
      const res = await rateEventApi({
        eventId: event.eventId,
        rating: ratingScore,
        comment: ratingComment.trim() || undefined,
      });
      if (res && res.status) {
        setHasRated(true);
        setShowRatingModal(false);
        Swal.fire({
          icon: "success",
          title: "Thank You!",
          text: "Your event rating and review have been submitted successfully.",
          timer: 2000,
          showConfirmButton: false,
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "Rating Failed",
          text: res?.message || "Could not submit rating.",
        });
      }
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err.message || "Failed to submit rating.",
      });
    } finally {
      setRatingSubmitting(false);
    }
  };

  const handleOpenReservationModal = () => {
    const defaultGuests = (event?.selectedGuests && event.selectedGuests.length > 0) ? String(event.selectedGuests.length) : "1";
    setResAdults(defaultGuests);
    setResChildren("0");
    setResInstructions("");
    setResError("");
    setShowReservationModal(true);
  };

  const handleMakeReservation = async (e) => {
    if (e) e.preventDefault();
    if (!resAdults || isNaN(resAdults) || parseInt(resAdults) <= 0) {
      setResError("Please enter a valid number of adults.");
      return;
    }
    try {
      setResSubmitting(true);
      setResError("");
      const payload = {
        eventId: event.eventId,
        adultCount: String(resAdults),
        childCount: String(resChildren || "0"),
        instruction: resInstructions,
        guestType: "Normal",
      };
      const res = await makeReservationApi(payload);
      if (res && res.status) {
        setShowReservationModal(false);
        const newRes = res.data?.makeReservation || res.data || { status: "pending", adultCount: resAdults, instruction: resInstructions };
        setReservation(newRes);
        await Swal.fire({
          icon: "success",
          title: "Booking Request Sent!",
          text: `Your table reservation request for ${resAdults} guests has been sent to the restaurant.`,
          timer: 2200,
          showConfirmButton: false,
        });
      } else {
        setResError(res?.message || "Failed to submit booking request.");
      }
    } catch (err) {
      setResError(err.message || "Failed to submit reservation.");
    } finally {
      setResSubmitting(false);
    }
  };

  const handleOpenEditModal = () => {
    if (!event) return;
    setEditTitle(event.eventTitle || "");
    setEditDescription(event.invitationMessage || "");

    let dStr = event.rawEventDate || "";
    if (dStr && /^\d{2}-\d{2}-\d{4}$/.test(dStr)) {
      const [dd, mm, yyyy] = dStr.split("-");
      dStr = `${yyyy}-${mm}-${dd}`;
    }
    setEditDate(dStr);
    setEditStartTime(event.startTime || "");
    setEditEndTime(event.endTime || "");
    setShowEditModal(true);
  };

  const handleSaveEditEvent = async (e) => {
    e.preventDefault();
    if (!editTitle.trim()) {
      Swal.fire({ icon: "warning", title: "Event title is required", timer: 2000, showConfirmButton: false });
      return;
    }

    try {
      setEditSaving(true);
      const payload = {
        eventId: event.eventId,
        eventTitle: editTitle.trim(),
        description: editDescription.trim(),
        eventDate: editDate,
        eventStartTime: editStartTime,
        eventEndTime: editEndTime,
      };

      const res = await updateEventApi(payload);
      if (res && res.status) {
        await Swal.fire({
          icon: "success",
          title: "Saved!",
          text: "Event details updated successfully.",
          timer: 1500,
          showConfirmButton: false,
        });
        setShowEditModal(false);
        window.location.reload();
      } else {
        Swal.fire({
          icon: "error",
          title: "Update Failed",
          text: res?.message || "Could not update event details.",
        });
      }
    } catch (err) {
      console.error("Failed to update event:", err);
      Swal.fire({ icon: "error", title: "Error", text: err.message || "Failed to update event." });
    } finally {
      setEditSaving(false);
    }
  };

  const handlePublishDraft = async () => {
    const result = await Swal.fire({
      title: "Publish this Event?",
      text: "This will make your event LIVE and send invitations to all your invited guests.",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#10b981",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "🚀 Yes, Publish Now!",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    try {
      setPublishing(true);
      const res = await publishDraftEventApi(event.eventId);
      if (res && res.status) {
        await Swal.fire({
          icon: "success",
          title: "Event is Live!",
          text: "Your event has been successfully published to Upcoming.",
          timer: 2000,
          showConfirmButton: false,
        });
        window.location.reload();
      } else {
        Swal.fire({
          icon: "error",
          title: "Publish Failed",
          text: res?.message || "Could not publish event draft.",
        });
      }
    } catch (err) {
      console.error("Failed to publish draft:", err);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err.message || "Failed to publish event.",
      });
    } finally {
      setPublishing(false);
    }
  };

  // Load event details that were selected from an event list or created event flow.
  useEffect(() => {
    setForceDetailsView(false);
    setHasJustDeclined(false);
    try {
      const savedUrl = window.localStorage.getItem("event-details-back-url");
      const savedLabel = window.localStorage.getItem("event-details-back-label");
      if (savedUrl) setBackUrl(savedUrl);
      if (savedLabel) setBackLabel(savedLabel);
    } catch (e) {
      console.error("Error reading back redirection url:", e);
    }

    const fetchEventDetails = async () => {
      if (!eventId) {
        setDetailsLoaded(true);
        return;
      }
      try {
        setDetailsLoaded(false);
        const res = await apiRequest(`/event/eventbyId?id=${eventId}`);
        if (res && res.status && res.data) {
          const userObj = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user_info")) : null;
          const mapped = mapEventData(res.data, userObj);
          setEvent(mapped);

          // Seed attended status from backend database
          const initialAttended = {};
          (res.data?.invitedUsers || []).forEach((inv) => {
            if (inv.attendance_status) {
              const uKey = inv.userId?._id || inv.userId;
              if (uKey) initialAttended[uKey] = true;
            }
          });
          setAttendedGuests(initialAttended);

          // Fetch existing reservation for this event
          try {
            setLoadingReservation(true);
            const resData = await getReservationDetailsByIdApi(eventId);
            if (resData && resData.status && resData.data) {
              let currentEventReservation = null;
              if (Array.isArray(resData.data)) {
                const matching = resData.data.find(d => String(d._id) === String(eventId) || String(d.id) === String(eventId));
                if (matching && (matching.makeReservation || matching.reservation)) {
                  currentEventReservation = matching.makeReservation || matching.reservation;
                }
              } else if (resData.data.makeReservation || resData.data.reservation) {
                currentEventReservation = resData.data.makeReservation || resData.data.reservation;
              } else if (resData.data._id && (String(resData.data.eventId) === String(eventId) || String(resData.data._id) === String(eventId))) {
                currentEventReservation = resData.data;
              }
              setReservation(currentEventReservation);
            } else {
              setReservation(null);
            }
          } catch (rErr) {
            setReservation(null);
          } finally {
            setLoadingReservation(false);
          }

          // Fetch group chat details for live community card
          try {
            const chatRes = await getEventGroupChatApi(eventId);
            if (chatRes && chatRes.status && chatRes.data) {
              setGroupChat(chatRes.data);
            }
          } catch (cErr) {
            console.log("No group chat or fetch error:", cErr);
          }
        } else {
          setApiMessage({ type: "danger", text: res?.message || "Failed to load event details." });
        }
      } catch (err) {
        console.error("Failed to fetch event details:", err);
        setApiMessage({ type: "danger", text: "Network error loading event details." });
      } finally {
        setDetailsLoaded(true);
      }
    };

    fetchEventDetails();

    // Load merchants list to display venue info details
    const fetchMerchants = async () => {
      try {
        const res = await getMerchantsByServiceApi("686fb6ced46e9740ee8277ec");
        if (res && res.status && Array.isArray(res.data)) {
          setMerchants(res.data);
        } else {
          console.error("Failed to load merchants list: API returned an error status.", res);
        }
      } catch (err) {
        console.error("Failed to load merchants list:", err.message || err);
      }
    };
    fetchMerchants();
  }, [eventId]);

  const handleConfirmAccept = async (e) => {
    e.preventDefault();
    if (!event || !event.eventId) {
      setApiMessage({ type: "danger", text: "Error: Could not identify the event ID. Please reload and try again." });
      return;
    }

    try {
      setSubmitting(true);
      setApiMessage({ type: "", text: "" });

      const payload = {
        status: "accepted",
        along_guest: String(alongGuest ?? "0").trim(),
        thanks_message: thanksMessage || "",
        suggestion_message: suggestionMessage || "",
        eventId: event.eventId
      };

      const res = await apiRequest("/event/respond-to-invitation", {
        method: "POST",
        body: payload
      });

      if (res && res.status) {
        setApiMessage({ type: "success", text: res.message || "Invitation accepted successfully!" });
        // Update local event status state to trigger UI update
        const updatedEvent = { ...event, status: "accepted" };
        setEvent(updatedEvent);
        
        setTimeout(() => {
          setShowAcceptModal(false);
          setApiMessage({ type: "", text: "" });
        }, 2000);
      } else {
        setApiMessage({ type: "danger", text: res?.message || "Failed to respond to invitation." });
      }
    } catch (err) {
      setApiMessage({ type: "danger", text: err.message || "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDecline = async (e) => {
    e.preventDefault();
    if (!event || !event.eventId) {
      setApiMessage({ type: "danger", text: "Error: Could not identify the event ID. Please reload and try again." });
      return;
    }

    try {
      setSubmitting(true);
      setApiMessage({ type: "", text: "" });

      const payload = {
        status: "declined",
        along_guest: "",
        thanks_message: declineReason || "",
        suggestion_message: declineSuggestion || "",
        eventId: event.eventId
      };

      const res = await apiRequest("/event/respond-to-invitation", {
        method: "POST",
        body: payload
      });

      if (res && res.status) {
        setApiMessage({ type: "success", text: res.message || "Invitation declined successfully!" });
        // Update local event status state to trigger UI update
        const updatedEvent = { ...event, status: "declined" };
        setEvent(updatedEvent);
        setHasJustDeclined(true);
        
        setTimeout(() => {
          setShowDeclineModal(false);
          setApiMessage({ type: "", text: "" });
        }, 2000);
      } else {
        setApiMessage({ type: "danger", text: res?.message || "Failed to respond to invitation." });
      }
    } catch (err) {
      setApiMessage({ type: "danger", text: err.message || "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetReminder = async () => {
    if (!event || !event.eventId) {
      setApiMessage({ type: "danger", text: "Error: Could not identify the event ID." });
      return;
    }

    try {
      setSubmitting(true);
      setApiMessage({ type: "", text: "" });

      const res = await apiRequest("/event/set-reminder", {
        method: "POST",
        body: { eventId: event.eventId }
      });

      if (res && res.status) {
        setApiMessage({ type: "success", text: res.message || "Reminder set successfully" });
        Swal.fire({
          title: "Event UNA",
          text: "Set reminder successfully",
          icon: "success",
          confirmButtonText: "Ok",
          confirmButtonColor: "#4f46e5",
          customClass: {
            popup: "rounded-4 border-0 shadow",
            confirmButton: "btn btn-primary rounded-pill px-4"
          }
        });
      } else {
        setApiMessage({ type: "danger", text: res?.message || "Failed to set reminder." });
      }
    } catch (err) {
      setApiMessage({ type: "danger", text: err.message || "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  if (!detailsLoaded) {
    return (
      <>
        <Header />
        <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light">
          <div className="text-center">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading event...</span>
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  if (!event) {
    return (
      <>
        <Header />
        <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light">
          <div className="text-center bg-white rounded-4 shadow-sm p-5 mx-3" style={{ maxWidth: "520px" }}>
            <div className="mb-3 text-primary" style={{ fontSize: "42px" }}>
              <i className="fa-regular fa-calendar-xmark"></i>
            </div>
            <h2 className="fw-bold mb-2" style={{ color: "#0c1b33" }}>No event selected</h2>
            <p className="text-muted mb-4">
              Choose an event from your event list to view its details.
            </p>
            <Link href="/my-events" className="main-btn btn-hover d-inline-flex align-items-center gap-2 text-decoration-none">
              <i className="fa-solid fa-arrow-left"></i>
              Go to My Events
            </Link>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  // If user declined the invitation, show the sad state screen
  if (hasJustDeclined && !forceDetailsView) {
    return (
      <>
        <Header />
        <div className="bg-white min-vh-100 d-flex align-items-center justify-content-center py-5" style={{ minHeight: "calc(100vh - 120px)" }}>
          <div className="container px-3" style={{ maxWidth: "480px" }}>
            
            {/* Top Navigation Header mimicking mobile screen */}
            <div className="d-flex align-items-center mb-4 pb-2 border-bottom">
              <button 
                onClick={() => { setForceDetailsView(true); setHasJustDeclined(false); }} 
                className="btn border-0 p-0 bg-transparent text-dark fs-4 me-3"
                title="Go back"
              >
                <i className="fa-solid fa-arrow-left"></i>
              </button>
              <h5 className="fw-bold text-dark m-0 text-center flex-grow-1 pe-4" style={{ fontSize: "18px" }}>
                Reservation
              </h5>
            </div>

            <div className="text-center px-2">
              {/* Event Title */}
              <div className="text-muted small fw-bold text-uppercase mb-2" style={{ letterSpacing: "1px" }}>
                {event.eventTitle || "dr"}
              </div>

              {/* Decline Headers */}
              <h2 className="fw-bold text-dark mb-3" style={{ fontSize: "28px", letterSpacing: "-0.5px", lineHeight: "1.25" }}>
                We&apos;re sad that you can&apos;t attend this.
              </h2>
              
              <p className="text-muted mb-5 mx-auto" style={{ fontSize: "14.5px", maxWidth: "400px", lineHeight: "1.6" }}>
                If you change you mind you could access the invitation again and accept the invitation.
              </p>

              {/* Vector Bell-Slash Illustration */}
              <div className="my-5 d-flex justify-content-center">
                <div className="position-relative d-flex align-items-center justify-content-center bg-light rounded-circle shadow-sm" style={{ width: "120px", height: "120px", background: "#f8fafc" }}>
                  <i className="fa-regular fa-bell-slash text-secondary opacity-75" style={{ fontSize: "42px" }}></i>
                  {/* Sad Emoji Eyes */}
                  <span className="position-absolute text-secondary fw-bold" style={{ bottom: "25px", fontSize: "14px", letterSpacing: "1px" }}>:(</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="d-flex flex-column gap-3 mt-5">
                <button 
                  type="button" 
                  className="btn btn-outline-primary rounded-pill py-3 fw-bold"
                  style={{
                    borderColor: "#3b82f6",
                    color: "#3b82f6",
                    borderWidth: "1.5px",
                    fontSize: "14px",
                    letterSpacing: "0.5px"
                  }}
                  onClick={() => { setForceDetailsView(true); setHasJustDeclined(false); }}
                >
                  ACCESS EVENT
                </button>
                <Link 
                  href="/" 
                  className="btn btn-primary rounded-pill py-3 fw-bold text-white"
                  style={{
                    background: "#4f46e5",
                    border: "none",
                    fontSize: "14px",
                    letterSpacing: "0.5px",
                    boxShadow: "0 4px 12px rgba(79, 70, 229, 0.15)"
                  }}
                >
                  HOME
                </Link>
              </div>
            </div>

          </div>
        </div>
        <Footer />
      </>
    );
  }

  // Find selected restaurant info (MerchantService e.g. "tasty khana")
  const targetRestaurantId = String(event.selectedRestaurant || event.merchantId || "");
  const restaurant = merchants.find((item) => String(item._id || item.id) === targetRestaurantId) ||
    merchants.find((item) => (item.serviceLocationIds || []).some(loc => String(loc._id || loc) === String(event.serviceLocationId?._id || event.serviceLocationId))) ||
    null;

  const isRestaurantOption = event.place === "At a participating restaurant" ||
    event.place === "restaurant" ||
    event.place === "Restaurant from list" ||
    event.place === "6877a86668d1e0b9fcdf5006" ||
    !!event.serviceLocationId;

  // Selected Restaurant / Outlet Name (e.g. "tasty khana")
  const chosenRestaurantName = restaurant?.serviceName || 
    restaurant?.name || 
    restaurant?.fullName || 
    event.serviceLocationId?.serviceId?.serviceName || 
    event.serviceLocationId?.merchantId?.serviceName || 
    event.serviceLocationId?.merchantId?.fullName || 
    "Event Venue";

  // Dynamic Venue Display String
  let venueDisplay = "Location provided by organizer";
  if (event.serviceLocationId) {
    const locAddress = event.serviceLocationId.addressName || event.serviceLocationId.address || "";
    venueDisplay = locAddress ? `${chosenRestaurantName} - ${locAddress}` : chosenRestaurantName;
  } else if (isRestaurantOption) {
    if (restaurant) {
      if (event.selectedLocation) {
        venueDisplay = `${chosenRestaurantName} - ${event.selectedLocation.addressName || event.selectedLocation.address}`;
      } else {
        const defaultLoc = (restaurant.serviceLocationIds && restaurant.serviceLocationIds[0]?.addressName) ||
          (restaurant.serviceLocationIds && restaurant.serviceLocationIds[0]?.address) ||
          restaurant.location;
        venueDisplay = defaultLoc ? `${chosenRestaurantName} (${defaultLoc})` : chosenRestaurantName;
      }
    } else {
      venueDisplay = chosenRestaurantName !== "Event Venue" ? chosenRestaurantName : "Participating restaurant";
    }
  } else if (event.place) {
    venueDisplay = event.place;
  }

  const monthName = new Date(2026, event.month || 6, 1).toLocaleString("en-US", { month: "long" });

  const displayRestaurantName = chosenRestaurantName;
  const displayRestaurantImage = restaurant?.bannerImages?.[0] || restaurant?.bannerImage || restaurant?.profileImage || event.serviceLocationId?.merchantId?.profileImage || "/images/banner.jpg";
  const displayRestaurantDescription = restaurant?.serviceDescription || restaurant?.serviceSlogan || event.serviceLocationId?.merchantId?.serviceDescription || "Participating event venue.";
  const displayAddress = event.serviceLocationId?.address || event.selectedLocation?.address || restaurant?.location || "Indore location";
  const displayPhone = restaurant?.phone || event.serviceLocationId?.locationPhone || restaurant?.mobile || "";
  const displayCapacity = event.serviceLocationId?.capacity || restaurant?.capacity || "";

  // Guest avatar initials helper
  const getInitials = (name) => {
    if (!name) return "?";
    return name.trim().charAt(0).toUpperCase();
  };

  const invitedCount = Array.isArray(event.selectedGuests) ? event.selectedGuests.length : 0;

  return (
    <>
      <Header />
      <div className="wrapper bg-light py-3 py-md-5">
        <div className="container">

          {/* Top Breadcrumb & Actions Bar */}
          <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
            <Link href={backUrl} className="btn btn-outline-secondary rounded-pill px-3.5 py-1.5 fw-semibold d-flex align-items-center gap-2 shadow-sm bg-white border-0" style={{ fontSize: "13px" }}>
              <i className="fa-solid fa-arrow-left"></i>
              {backLabel}
            </Link>
            <span className="badge bg-primary px-3 py-2 rounded-pill shadow-sm fw-semibold">
              Event Details
            </span>
          </div>

          {/* Draft Status Banner */}
          {event && event.status?.toLowerCase() === "draft" && (
            <div className="alert alert-warning border-0 rounded-4 shadow-sm p-3 mb-4 d-flex align-items-center justify-content-between flex-wrap gap-3 animate__animated animate__fadeIn">
              <div className="d-flex align-items-center gap-3">
                <div className="rounded-circle bg-warning text-dark d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: "42px", height: "42px", fontSize: "18px" }}>
                  <i className="fa-solid fa-file-pen"></i>
                </div>
                <div>
                  <h6 className="fw-bold mb-0 text-dark">This Event is currently in Draft Mode</h6>
                  <p className="text-muted small mb-0">It is not live yet. Edit your details anytime or publish it to invite your guests.</p>
                </div>
              </div>
              {event.isMyEvent && (
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-dark btn-sm rounded-pill px-3 fw-semibold"
                    onClick={handleOpenEditModal}
                  >
                    <i className="fa-solid fa-pen me-1"></i> Edit Event
                  </button>
                  <button
                    type="button"
                    className="btn btn-success btn-sm rounded-pill px-3.5 py-1.5 fw-bold text-white shadow-sm"
                    style={{ background: "#10b981", border: "none" }}
                    onClick={handlePublishDraft}
                    disabled={publishing}
                  >
                    {publishing ? (
                      <span className="spinner-border spinner-border-sm" role="status"></span>
                    ) : (
                      <>
                        <i className="fa-solid fa-rocket me-1"></i> Make Live
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {apiMessage.text && !showAcceptModal && (
            <div className={`alert alert-${apiMessage.type} alert-dismissible fade show mb-4`} role="alert">
              <i className={`fa-solid ${apiMessage.type === "success" ? "fa-circle-check" : "fa-circle-exclamation"} me-2`}></i>
              {apiMessage.text}
              <button type="button" className="btn-close" onClick={() => setApiMessage({ type: "", text: "" })}></button>
            </div>
          )}

          <div className="row g-4">

            {/* Left Column - Main Content */}
            <div className="col-lg-8">

              {/* Event Cover Image Card */}
              <div className="card border-0 rounded-4 shadow-sm overflow-hidden mb-4 bg-white">
                <div className="position-relative event-cover-container" style={{ height: "380px" }}>
                  <img
                    src={event.eventImage || "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80"}
                    alt={event.eventTitle || "Event Cover"}
                    className="w-100 h-100 object-fit-cover"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80";
                    }}
                  />
                </div>

                <div className="card-body p-3 p-md-4">
                  {/* Category and Type Badges */}
                  <div className="d-flex flex-wrap gap-2 mb-3">
                    {event.status && (
                      <span className={`badge px-3 py-2 rounded-pill fw-semibold text-white ${
                        event.status.toLowerCase() === "upcoming" ? "bg-info" :
                        event.status.toLowerCase() === "accepted" ? "bg-success" :
                        event.status.toLowerCase() === "declined" ? "bg-danger" : "bg-warning text-dark"
                      }`}>
                        Status: {event.status}
                      </span>
                    )}
                    {event.category && (
                      <span className="badge px-3 py-2 rounded-pill fw-semibold" style={{ color: "#4f46e5", background: "#e0e7ff" }}>
                        <i className="fa-solid fa-tag me-1"></i> {event.category}
                      </span>
                    )}
                    {event.eventType && (
                      <span className="badge px-3 py-2 rounded-pill fw-semibold" style={{ color: "#db2777", background: "#fdf2f8" }}>
                        <i className="fa-solid fa-circle-nodes me-1"></i> {event.eventType}
                      </span>
                    )}
                  </div>

                  {/* Completed Event Rating Banner */}
                  {event.status && event.status.toLowerCase() === "completed" && (
                    <div className="p-3 mb-4 rounded-3 d-flex flex-wrap align-items-center justify-content-between gap-3 shadow-xs" style={{ background: "#fef3c7", border: "1px solid #fde68a" }}>
                      <div className="d-flex align-items-center gap-2">
                        <i className="fa-solid fa-award text-warning fs-3"></i>
                        <div>
                          <h6 className="fw-bold mb-0 text-dark">Event Completed</h6>
                          <small className="text-muted">How was your event experience? Rate and share your review.</small>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowRatingModal(true)}
                        disabled={hasRated}
                        className="btn btn-sm btn-warning rounded-pill px-4 py-2 fw-bold text-dark shadow-xs"
                      >
                        <i className="fa-solid fa-star me-1 text-dark"></i> {hasRated ? "Rating Submitted" : "Rate Event"}
                      </button>
                    </div>
                  )}

                  <h1 className="fw-extrabold text-dark mb-4" style={{ fontSize: "clamp(22px, 4vw, 36px)", letterSpacing: "-0.5px" }}>
                    {event.eventTitle || "Untitled Event"}
                  </h1>

                  <div className="border-top pt-4">
                    <h5 className="fw-bold text-dark mb-3">Invitation Description</h5>
                    <p className="text-muted" style={{ fontSize: "16px", lineHeight: "1.7" }}>
                      {event.invitationMessage || "No description provided."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Guest List Card */}
              <div className="card border-0 rounded-4 shadow-sm p-4 bg-white mb-4">
                <div className="d-flex align-items-center mb-4 pb-3 border-bottom" style={{ gap: "12px" }}>
                  <div
                    className="rounded-3 d-flex align-items-center justify-content-center text-primary flex-shrink-0"
                    style={{ width: "34px", height: "34px", background: "#eef2ff", fontSize: "15px" }}
                  >
                    <i className="fa-solid fa-user-group" style={{ lineHeight: 1 }}></i>
                  </div>
                  <div>
                    <h5 className="fw-bold text-dark m-0" style={{ fontSize: "16px", lineHeight: 1.2 }}>
                      Guest List <span className="text-muted small fw-normal">({invitedCount} invited)</span>
                    </h5>
                    <span className="text-muted small" style={{ fontSize: "12px" }}>
                      Confirmed attendees and invitation statuses
                    </span>
                  </div>
                </div>

                {event.selectedGuests && event.selectedGuests.length > 0 ? (
                  <div className="row g-3">
                    {event.selectedGuests.map((guest, idx) => (
                      <div key={guest.id || idx} className="col-12 col-sm-6 col-lg-6 col-xxl-4">
                        <div className="d-flex align-items-center justify-content-between p-3 rounded-3 border bg-white shadow-xs h-100" style={{ borderColor: "#eef2f6", gap: "10px" }}>
                          {/* Left: Avatar + Guest Details */}
                          <div className="d-flex align-items-center gap-2.5 min-w-0 flex-grow-1 overflow-hidden">
                            <div
                              className="rounded-circle text-white d-flex align-items-center justify-content-center fw-bold flex-shrink-0 shadow-xs"
                              style={{
                                width: "38px",
                                height: "38px",
                                fontSize: "14px",
                                background: ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"][idx % 5]
                              }}
                            >
                              {getInitials(guest.name)}
                            </div>
                            <div className="min-w-0">
                              <h6 className="fw-bold mb-1 text-dark text-truncate" style={{ fontSize: "13.5px" }}>{guest.name}</h6>
                              <div className="d-flex align-items-center">
                                <span
                                  className="badge px-2 py-0.5 d-inline-flex align-items-center gap-1 text-nowrap"
                                  style={{
                                    fontSize: "10.5px",
                                    fontWeight: "600",
                                    borderRadius: "6px",
                                    background: guest.status === "accepted" ? "#ecfdf5" : "#fffbeb",
                                    color: guest.status === "accepted" ? "#047857" : "#b45309",
                                    border: `1px solid ${guest.status === "accepted" ? "#a7f3d0" : "#fde68a"}`,
                                    whiteSpace: "nowrap"
                                  }}
                                >
                                  <span
                                    className="rounded-circle d-inline-block"
                                    style={{
                                      width: "5px",
                                      height: "5px",
                                      background: guest.status === "accepted" ? "#10b981" : "#f59e0b",
                                      flexShrink: 0
                                    }}
                                  ></span>
                                  <span style={{ textTransform: "capitalize" }}>{guest.status || "pending"}</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Right: Check-In Action or Checked-In Status */}
                          <div className="flex-shrink-0 ms-1">
                            {attendedGuests[guest.id || guest.email || guest.name] ? (
                              <span
                                className="badge px-2.5 py-1.5 d-inline-flex align-items-center gap-1.5 text-nowrap"
                                style={{
                                  fontSize: "11px",
                                  fontWeight: "600",
                                  borderRadius: "8px",
                                  background: "#ecfdf5",
                                  color: "#047857",
                                  border: "1px solid #a7f3d0",
                                  whiteSpace: "nowrap"
                                }}
                              >
                                <i className="fa-solid fa-circle-check text-success"></i>
                                <span>Checked In</span>
                              </span>
                            ) : event.isMyEvent && guest.status === "accepted" ? (
                              <button
                                type="button"
                                onClick={() => handleMarkGuestAttended(guest)}
                                className="btn btn-sm btn-outline-success px-2.5 py-1 fw-semibold d-inline-flex align-items-center gap-1.5 shadow-xs text-nowrap"
                                style={{
                                  fontSize: "11.5px",
                                  height: "30px",
                                  borderRadius: "8px",
                                  borderColor: "#a7f3d0",
                                  color: "#047857",
                                  background: "#f0fdf4",
                                  whiteSpace: "nowrap"
                                }}
                              >
                                <i className="fa-solid fa-user-check"></i>
                                <span>Check In</span>
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted mb-0 small">No guests invited yet.</p>
                )}
              </div>

              {/* Special Notes Card */}
              {event.selectedNotes && event.selectedNotes.length > 0 && (
                <div className="card border-0 rounded-4 shadow-sm p-4 bg-white mb-4">
                  <div className="d-flex align-items-center mb-3 pb-3 border-bottom" style={{ gap: "12px" }}>
                    <div
                      className="rounded-3 d-flex align-items-center justify-content-center text-warning flex-shrink-0"
                      style={{ width: "34px", height: "34px", background: "#fffbeb", fontSize: "15px" }}
                    >
                      <i className="bi bi-sticky-fill" style={{ lineHeight: 1 }}></i>
                    </div>
                    <div>
                      <h5 className="fw-bold text-dark m-0" style={{ fontSize: "16px", lineHeight: 1.2 }}>Special Instructions & Notes</h5>
                      <span className="text-muted small" style={{ fontSize: "12px" }}>
                        Important organizer guidelines for all guests
                      </span>
                    </div>
                  </div>
                  <div className="d-flex flex-column" style={{ gap: "10px" }}>
                    {event.selectedNotes.map((note, index) => (
                      <div key={index} className="p-3 rounded-3 d-flex align-items-center" style={{ background: "#f8fafc", border: "1px solid #e2e8f0", gap: "12px" }}>
                        <span className="d-inline-flex align-items-center justify-content-center rounded-circle flex-shrink-0" style={{ width: "24px", height: "24px", background: "#fef3c7", color: "#d97706" }}>
                          <i className="bi bi-info-circle-fill" style={{ fontSize: "13px", lineHeight: 1 }}></i>
                        </span>
                        <span className="text-dark small fw-medium" style={{ fontSize: "13px", lineHeight: 1.4 }}>{note}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional Services Card */}
              {event.additionalServices && event.additionalServices.length > 0 && (
                <div className="card border-0 rounded-4 shadow-sm p-4 bg-white mb-4">
                  <div className="d-flex align-items-center justify-content-between mb-4 border-bottom pb-3">
                    <h5 className="fw-bold text-dark m-0 d-flex align-items-center gap-2">
                      <i className="fa-solid fa-bell-concierge text-primary"></i>
                      Additional Services Requested
                    </h5>
                    <span className="badge rounded-pill bg-light text-secondary px-2.5 py-1 small fw-semibold" style={{ fontSize: "11px" }}>
                      {event.additionalServices.length} {event.additionalServices.length === 1 ? 'Service' : 'Services'}
                    </span>
                  </div>

                  <div className="d-flex flex-column gap-3">
                    {event.additionalServices.map((service, index) => {
                      const knownServiceNames = {
                        "686fb6ced46e9740ee8277ec": "Restaurants",
                        "686fb6dcd46e9740ee8277ee": "Facility",
                        "686fb6edd46e9740ee8277f0": "Catering",
                        "686fb714d46e9740ee8277f2": "Decoration & Lighting",
                        "686fb723d46e9740ee8277f4": "Photography",
                        "686fb788d46e9740ee8277f6": "Music Band and DJ",
                        "686fb7bad46e9740ee8277f8": "Furniture Rentals",
                        "686fb7e8d46e9740ee8277fa": "Servants and Cleaning",
                        "686fb80bd46e9740ee8277fc": "Entertainment & clown"
                      };

                      const resolvedServiceId = service.serviceId?._id || (typeof service.serviceId === 'string' ? service.serviceId : '');
                      const serviceName = service.serviceId?.servicesName || service.serviceId?.serviceName || knownServiceNames[resolvedServiceId] || "Extra Service";
                      
                      // Resolve thematic icons and soft colors for premium look
                      const getServiceIconClass = (name) => {
                        const norm = (name || "").toLowerCase();
                        if (norm.includes("catering")) return { icon: "fa-utensils", bg: "#eff6ff", color: "#3b82f6" };
                        if (norm.includes("decor")) return { icon: "fa-lightbulb", bg: "#fef3c7", color: "#d97706" };
                        if (norm.includes("photo")) return { icon: "fa-camera", bg: "#ecfdf5", color: "#10b981" };
                        if (norm.includes("music") || norm.includes("dj")) return { icon: "fa-music", bg: "#fdf2f8", color: "#db2777" };
                        if (norm.includes("furniture") || norm.includes("rent")) return { icon: "fa-chair", bg: "#f5f3ff", color: "#8b5cf6" };
                        if (norm.includes("servant") || norm.includes("clean")) return { icon: "fa-broom", bg: "#f1f5f9", color: "#64748b" };
                        if (norm.includes("clown") || norm.includes("entertain")) return { icon: "fa-face-laugh-beam", bg: "#fff7ed", color: "#f97316" };
                        return { icon: "fa-bell-concierge", bg: "#f0fdf4", color: "#15803d" };
                      };
                      
                      const meta = getServiceIconClass(serviceName);
                      const isClickable = !!resolvedServiceId;

                      const rowContent = (
                        <div 
                          className="d-flex align-items-center justify-content-between p-3 rounded-3 border border-light-subtle bg-white shadow-sm w-100 text-start" 
                          style={{ 
                            cursor: isClickable ? 'pointer' : 'default',
                            transition: "transform 0.2s ease, box-shadow 0.2s ease",
                          }}
                          onMouseEnter={(e) => {
                            if (isClickable) {
                              e.currentTarget.style.transform = "translateY(-2px)";
                              e.currentTarget.style.boxShadow = "0 8px 16px rgba(0,0,0,0.06)";
                              e.currentTarget.style.borderColor = "#4f46e5";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (isClickable) {
                              e.currentTarget.style.transform = "translateY(0)";
                              e.currentTarget.style.boxShadow = "none";
                              e.currentTarget.style.borderColor = "var(--bs-border-color)";
                            }
                          }}
                        >
                          <div className="d-flex align-items-center gap-3 overflow-hidden">
                            {/* Service Icon Box */}
                            <div 
                              className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                              style={{ width: "42px", height: "42px", backgroundColor: meta.bg, color: meta.color, fontSize: "16px" }}
                            >
                              <i className={`fa-solid ${meta.icon}`}></i>
                            </div>

                            {/* Service Text Details */}
                            <div className="overflow-hidden">
                              <h6 className="fw-bold text-dark m-0 d-flex align-items-center gap-2 small text-truncate">
                                {serviceName}
                                {isClickable && (
                                  <i className="fa-solid fa-arrow-up-right-from-square text-primary" style={{ fontSize: "9px" }}></i>
                                )}
                              </h6>
                              {isClickable ? (
                                <span className="text-primary small d-block fw-semibold" style={{ fontSize: "11px" }}>
                                  Browse Service Providers
                                </span>
                              ) : (
                                <span className="text-muted small d-block" style={{ fontSize: "11px" }}>
                                  Additional Event Requirement
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Status and Payment Badges */}
                          <div className="d-flex align-items-center gap-2 flex-shrink-0">
                            {/* Booking Status Badge */}
                            <span className="badge rounded-pill px-2.5 py-1.5 fw-semibold text-capitalize shadow-sm" style={{
                              fontSize: "10px",
                              background: ["accepted", "approved"].includes(service.status?.toLowerCase()) ? "#d1fae5" : "#fee2e2",
                              color: ["accepted", "approved"].includes(service.status?.toLowerCase()) ? "#065f46" : "#991b1b"
                            }}>
                              Status: {service.status || "Pending"}
                            </span>

                            {/* Payment Status Badge */}
                            <span className="badge rounded-pill px-2.5 py-1.5 fw-semibold shadow-sm" style={{
                              fontSize: "10px",
                              background: ["yes", "paid", "success"].includes(service.paymentStatus?.toLowerCase()) ? "#e0f2fe" : "#fff1f2",
                              color: ["yes", "paid", "success"].includes(service.paymentStatus?.toLowerCase()) ? "#0369a1" : "#be123c"
                            }}>
                              {["yes", "paid", "success"].includes(service.paymentStatus?.toLowerCase()) ? "Paid" : "Unpaid"}
                            </span>
                          </div>
                        </div>
                      );

                      if (isClickable) {
                        return (
                          <Link 
                            key={service._id || index}
                            href={`/merchants-by-service?serviceId=${resolvedServiceId}&serviceName=${encodeURIComponent(serviceName)}&eventId=${event.eventId}`}
                            className="text-decoration-none d-block"
                          >
                            {rowContent}
                          </Link>
                        );
                      }

                      return (
                        <div key={service._id || index} className="d-block">
                          {rowContent}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Event Discussion & Group Chat Card */}
              <div className="card border-0 rounded-4 shadow-sm p-4 bg-white mb-4">
                <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-3">
                  <div className="d-flex align-items-center" style={{ gap: "12px" }}>
                    <div
                      className="rounded-3 d-flex align-items-center justify-content-center text-primary flex-shrink-0"
                      style={{ width: "34px", height: "34px", background: "#eef2ff", fontSize: "15px" }}
                    >
                      <i className="bi bi-chat-left-dots-fill" style={{ lineHeight: 1 }}></i>
                    </div>
                    <div className="d-flex flex-column justify-content-center">
                      <h5 className="fw-bold text-dark m-0" style={{ fontSize: "16px", lineHeight: 1.2 }}>Event Discussion & Group Chat</h5>
                      <span className="text-muted small" style={{ fontSize: "12px", lineHeight: 1.3, marginTop: "2px" }}>
                        Live channel for all confirmed attendees & organizer
                      </span>
                    </div>
                  </div>
                  <span className="badge rounded-pill bg-success-subtle text-success border border-success-subtle px-2.5 py-1.5 fw-semibold d-inline-flex align-items-center" style={{ fontSize: "11px", gap: "6px" }}>
                    <span className="bg-success rounded-circle d-inline-block" style={{ width: "6px", height: "6px", flexShrink: 0 }}></span>
                    <span>Live Channel</span>
                  </span>
                </div>

                <p className="text-secondary small mb-3" style={{ lineHeight: "1.5", fontSize: "13px" }}>
                  Connect with the event host and fellow guests. Coordinate arrival plans, share updates, or ask event questions before the party starts.
                </p>

                {/* Attendees Avatar Stack & Action */}
                <div className="p-3 rounded-3 d-flex align-items-center justify-content-between flex-wrap" style={{ background: "#f8fafc", border: "1px solid #e2e8f0", gap: "12px" }}>
                  <div className="d-flex align-items-center" style={{ gap: "10px" }}>
                    <div className="d-flex align-items-center">
                      {event.selectedGuests && event.selectedGuests.length > 0 ? (
                        event.selectedGuests.slice(0, 4).map((g, idx) => (
                          <div
                            key={g.id || idx}
                            className="rounded-circle border border-2 border-white d-flex align-items-center justify-content-center fw-bold text-white shadow-xs overflow-hidden"
                            style={{
                              width: "28px",
                              height: "28px",
                              marginLeft: idx === 0 ? "0" : "-8px",
                              background: idx === 0 ? "#3e56f0" : idx === 1 ? "#10b981" : idx === 2 ? "#f59e0b" : "#8b5cf6",
                              fontSize: "11px",
                            }}
                            title={g.name}
                          >
                            {g.profilePic ? (
                              <img src={g.profilePic} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              getInitials(g.name)
                            )}
                          </div>
                        ))
                      ) : (
                        <div
                          className="rounded-circle border border-2 border-white d-flex align-items-center justify-content-center fw-bold text-white shadow-xs"
                          style={{ width: "28px", height: "28px", background: "#3e56f0", fontSize: "11px" }}
                        >
                          {getInitials(event.organizerName)}
                        </div>
                      )}
                    </div>
                    <span className="text-dark small fw-medium" style={{ fontSize: "12px" }}>
                      {event.selectedGuests && event.selectedGuests.length > 0
                        ? `${event.selectedGuests.length} ${event.selectedGuests.length === 1 ? "participant" : "participants"} in room`
                        : "Host active in room"}
                    </span>
                  </div>

                  <Link
                    href={`/chat?chatId=${groupChat?._id || ""}&eventName=${encodeURIComponent(event.eventTitle)}&eventId=${event.eventId}`}
                    className="btn btn-sm btn-primary text-white rounded-pill px-3 py-1.5 fw-semibold d-inline-flex align-items-center shadow-xs transition"
                    style={{ background: "#3e56f0", border: "none", fontSize: "12px", gap: "8px", color: "#ffffff" }}
                  >
                    <i className="bi bi-chat-text-fill text-white" style={{ fontSize: "13px", lineHeight: 1, color: "#ffffff" }}></i>
                    <span className="text-white" style={{ color: "#ffffff" }}>Open Event Group Chat</span>
                  </Link>
                </div>
              </div>

              {/* Venue Highlights & Directions Showcase Card */}
              <div className="card border-0 rounded-4 shadow-sm p-4 bg-white mb-4">
                <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-3">
                  <div className="d-flex align-items-center" style={{ gap: "12px" }}>
                    <div
                      className="rounded-3 d-flex align-items-center justify-content-center text-success flex-shrink-0"
                      style={{ width: "34px", height: "34px", background: "#ecfdf5", fontSize: "15px" }}
                    >
                      <i className="bi bi-geo-alt-fill" style={{ lineHeight: 1 }}></i>
                    </div>
                    <div className="d-flex flex-column justify-content-center">
                      <h5 className="fw-bold text-dark m-0" style={{ fontSize: "16px", lineHeight: 1.2 }}>Venue Highlights & Directions</h5>
                      <span className="text-muted small" style={{ fontSize: "12px", lineHeight: 1.3, marginTop: "2px" }}>
                        Everything you need to know about reaching {displayRestaurantName}
                      </span>
                    </div>
                  </div>
                  {displayCapacity && (
                    <span className="badge rounded-pill bg-light text-secondary border px-2.5 py-1.5 small fw-semibold d-inline-flex align-items-center" style={{ fontSize: "11px", gap: "6px" }}>
                      <i className="bi bi-people-fill text-muted" style={{ fontSize: "12px", lineHeight: 1 }}></i>
                      <span>Capacity: {displayCapacity}</span>
                    </span>
                  )}
                </div>

                <div className="row g-3">
                  <div className="col-md-7">
                    <div className="p-3 rounded-3 h-100 d-flex flex-column justify-content-between" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <div>
                        <span className="text-muted small text-uppercase fw-semibold" style={{ fontSize: "10.5px", letterSpacing: "0.5px" }}>Full Address</span>
                        <p className="fw-bold text-dark mb-2 mt-1 small" style={{ lineHeight: "1.4" }}>
                          {venueDisplay}
                        </p>
                        {displayPhone && (
                          <p className="text-secondary small mb-0 d-inline-flex align-items-center" style={{ fontSize: "12.5px", gap: "8px" }}>
                            <span className="d-inline-flex align-items-center justify-content-center rounded-circle flex-shrink-0" style={{ width: "22px", height: "22px", background: "#eff6ff", color: "#3e56f0" }}>
                              <i className="bi bi-telephone-fill" style={{ fontSize: "11px", lineHeight: 1 }}></i>
                            </span>
                            <span className="fw-medium text-dark">{displayPhone}</span>
                          </p>
                        )}
                      </div>
                      <div className="pt-3 mt-2 border-top d-flex align-items-center flex-wrap" style={{ gap: "10px" }}>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueDisplay)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-sm btn-outline-primary rounded-pill px-3 py-1.5 fw-semibold d-inline-flex align-items-center shadow-xs"
                          style={{ fontSize: "12px", gap: "8px" }}
                        >
                          <i className="bi bi-pin-map-fill" style={{ fontSize: "13px", lineHeight: 1 }}></i>
                          <span>Get Directions</span>
                        </a>
                        {isRestaurantOption && restaurant && (
                          <button
                            type="button"
                            className="btn btn-sm btn-light border rounded-pill px-3 py-1.5 fw-medium text-secondary shadow-xs d-inline-flex align-items-center"
                            onClick={() => setShowVenueModal(true)}
                            style={{ fontSize: "12px", gap: "8px" }}
                          >
                            <i className="bi bi-info-circle-fill text-primary" style={{ fontSize: "13px", lineHeight: 1 }}></i>
                            <span>View Venue Profile</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Venue Amenities Tags */}
                  <div className="col-md-5">
                    <div className="p-3 rounded-3 h-100" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <span className="text-muted small text-uppercase fw-semibold d-block mb-2.5" style={{ fontSize: "10.5px", letterSpacing: "0.5px" }}>Venue Amenities</span>
                      <div className="d-flex flex-column" style={{ gap: "10px" }}>
                        <div className="d-flex align-items-center" style={{ gap: "10px", fontSize: "12.5px" }}>
                          <i className="bi bi-check-circle-fill text-success" style={{ fontSize: "15px", lineHeight: 1, flexShrink: 0 }}></i>
                          <span className="text-dark fw-medium">Parking Space Available</span>
                        </div>
                        <div className="d-flex align-items-center" style={{ gap: "10px", fontSize: "12.5px" }}>
                          <i className="bi bi-check-circle-fill text-success" style={{ fontSize: "15px", lineHeight: 1, flexShrink: 0 }}></i>
                          <span className="text-dark fw-medium">Dine-in Reserved Seating</span>
                        </div>
                        <div className="d-flex align-items-center" style={{ gap: "10px", fontSize: "12.5px" }}>
                          <i className="bi bi-check-circle-fill text-success" style={{ fontSize: "15px", lineHeight: 1, flexShrink: 0 }}></i>
                          <span className="text-dark fw-medium">Guest Wi-Fi & AC Seating</span>
                        </div>
                        <div className="d-flex align-items-center" style={{ gap: "10px", fontSize: "12.5px" }}>
                          <i className="bi bi-check-circle-fill text-success" style={{ fontSize: "15px", lineHeight: 1, flexShrink: 0 }}></i>
                          <span className="text-dark fw-medium">Wheelchair Accessible</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Event Guidelines & Helpful Tips Card */}
              <div className="card border-0 rounded-4 shadow-sm p-4 bg-white mb-4">
                <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-3">
                  <div className="d-flex align-items-center" style={{ gap: "12px" }}>
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center text-white shadow-xs flex-shrink-0"
                      style={{ width: "38px", height: "38px", background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", fontSize: "16px" }}
                    >
                      <i className="bi bi-lightbulb-fill" style={{ lineHeight: 1 }}></i>
                    </div>
                    <div className="d-flex flex-column justify-content-center">
                      <h5 className="fw-bold text-dark m-0" style={{ fontSize: "16px", lineHeight: 1.2 }}>Event Guidelines & Tips</h5>
                      <span className="text-muted small" style={{ fontSize: "12px", lineHeight: 1.3, marginTop: "2px" }}>
                        Important notes for a smooth and pleasant event experience
                      </span>
                    </div>
                  </div>
                </div>

                <div className="row g-3">
                  <div className="col-sm-6">
                    <div className="p-3 rounded-3 h-100" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <div className="d-flex align-items-center mb-2" style={{ gap: "8px" }}>
                        <span className="d-inline-flex align-items-center justify-content-center rounded-circle flex-shrink-0" style={{ width: "24px", height: "24px", background: "#eff6ff", color: "#3e56f0" }}>
                          <i className="bi bi-clock-history" style={{ fontSize: "12.5px", lineHeight: 1 }}></i>
                        </span>
                        <h6 className="fw-bold text-dark m-0" style={{ fontSize: "13px", lineHeight: 1.2 }}>Arrival & Punctuality</h6>
                      </div>
                      <p className="text-muted small mb-0" style={{ fontSize: "11.5px", lineHeight: "1.4" }}>
                        Please arrive 10-15 minutes prior to {event.startTime || "start time"} for seamless reception and seating.
                      </p>
                    </div>
                  </div>

                  <div className="col-sm-6">
                    <div className="p-3 rounded-3 h-100" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <div className="d-flex align-items-center mb-2" style={{ gap: "8px" }}>
                        <span className="d-inline-flex align-items-center justify-content-center rounded-circle flex-shrink-0" style={{ width: "24px", height: "24px", background: "#ecfdf5", color: "#059669" }}>
                          <i className="bi bi-qr-code" style={{ fontSize: "12.5px", lineHeight: 1 }}></i>
                        </span>
                        <h6 className="fw-bold text-dark m-0" style={{ fontSize: "13px", lineHeight: 1.2 }}>Digital Verification</h6>
                      </div>
                      <p className="text-muted small mb-0" style={{ fontSize: "11.5px", lineHeight: "1.4" }}>
                        Keep your digital attendance QR or invitation pass accessible on your mobile phone at entrance.
                      </p>
                    </div>
                  </div>

                  <div className="col-sm-6">
                    <div className="p-3 rounded-3 h-100" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <div className="d-flex align-items-center mb-2" style={{ gap: "8px" }}>
                        <span className="d-inline-flex align-items-center justify-content-center rounded-circle flex-shrink-0" style={{ width: "24px", height: "24px", background: "#f5f3ff", color: "#7c3aed" }}>
                          <i className="bi bi-person-check-fill" style={{ fontSize: "12.5px", lineHeight: 1 }}></i>
                        </span>
                        <h6 className="fw-bold text-dark m-0" style={{ fontSize: "13px", lineHeight: 1.2 }}>Guest Policy</h6>
                      </div>
                      <p className="text-muted small mb-0" style={{ fontSize: "11.5px", lineHeight: "1.4" }}>
                        Additional guests: <strong className="text-dark">{event.bringGuests === "Yes" ? `Allowed (up to ${event.maxGuests})` : "Not Allowed"}</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="col-sm-6">
                    <div className="p-3 rounded-3 h-100" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <div className="d-flex align-items-center mb-2" style={{ gap: "8px" }}>
                        <span className="d-inline-flex align-items-center justify-content-center rounded-circle flex-shrink-0" style={{ width: "24px", height: "24px", background: "#fff1f2", color: "#e11d48" }}>
                          <i className="bi bi-chat-heart-fill" style={{ fontSize: "12.5px", lineHeight: 1 }}></i>
                        </span>
                        <h6 className="fw-bold text-dark m-0" style={{ fontSize: "13px", lineHeight: 1.2 }}>Need Special Help?</h6>
                      </div>
                      <p className="text-muted small mb-0" style={{ fontSize: "11.5px", lineHeight: "1.4" }}>
                        Use the restaurant chat or contact organizer <strong>{event.organizerName}</strong> for dietary or special requests.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column - Sidebar */}
            <div className="col-lg-4">
              <div className="sticky-top" style={{ top: "24px", zIndex: 10 }}>

              {/* Event Attendance QR Code Card */}
              {event.eventAttendanceQr && (
                <div className="card border-0 rounded-4 shadow-sm p-4 bg-white mb-4 text-center">
                  <h5 className="fw-bold text-dark mb-3 text-start">
                    <i className="fa-solid fa-qrcode text-primary me-2"></i>
                    Attendance QR Code
                  </h5>
                  <div className="d-inline-block p-3 bg-light rounded-3 border mb-3 shadow-inner">
                    <img
                      src={event.eventAttendanceQr}
                      alt="Attendance QR Code"
                      style={{ width: "200px", height: "200px", objectFit: "contain" }}
                    />
                  </div>
                  <p className="text-muted small mb-0" style={{ lineHeight: "1.4" }}>
                    Scan this QR code to check in or verify attendance at the event.
                  </p>
                  {event.isMyEvent && (
                    <button
                      type="button"
                      onClick={() => setShowCheckInModal(true)}
                      className="btn btn-primary rounded-pill w-100 fw-semibold mt-3 shadow-xs"
                      style={{ background: "#3e56f0", border: "none" }}
                    >
                      <i className="fa-solid fa-qrcode me-2"></i> Check-in Guest (Verify Token)
                    </button>
                  )}
                </div>
              )}

              {/* Date & Time Widget */}
              <div className="card border-0 rounded-4 shadow-sm p-4 bg-white mb-4">
                <h5 className="fw-bold text-dark mb-4">
                  <i className="fa-regular fa-clock text-primary me-2"></i>
                  Date & Time
                </h5>
                <div className="d-flex align-items-center mb-3">
                  <div
                    className="rounded-3 d-flex align-items-center justify-content-center me-3 shadow-sm flex-shrink-0"
                    style={{ width: "48px", height: "48px", background: "#e0e7ff", color: "#4f46e5", fontSize: "20px" }}
                  >
                    <i className="fa-regular fa-calendar-days"></i>
                  </div>
                  <div>
                    <h6 className="fw-bold mb-1 text-dark">
                      {event.selectedDate} {monthName} 2026
                    </h6>
                    <span className="text-muted small">Event Date</span>
                  </div>
                </div>
                <div className="d-flex align-items-center">
                  <div
                    className="rounded-3 d-flex align-items-center justify-content-center me-3 shadow-sm flex-shrink-0"
                    style={{ width: "48px", height: "48px", background: "#ecfdf5", color: "#059669", fontSize: "20px" }}
                  >
                    <i className="fa-regular fa-clock"></i>
                  </div>
                  <div>
                    <h6 className="fw-bold mb-1 text-dark">
                      {event.startTime || "--:--"} - {event.endTime || "--:--"}
                    </h6>
                    <span className="text-muted small">Event Time</span>
                  </div>
                </div>
              </div>

              {/* Location Widget */}
              <div className="card border-0 rounded-4 shadow-sm p-4 bg-white mb-4">
                <div className="d-flex align-items-center mb-3 pb-3 border-bottom" style={{ gap: "12px" }}>
                  <div
                    className="rounded-3 d-flex align-items-center justify-content-center text-danger flex-shrink-0"
                    style={{ width: "34px", height: "34px", background: "#fef2f2", fontSize: "15px" }}
                  >
                    <i className="fa-solid fa-map-marker-alt" style={{ lineHeight: 1 }}></i>
                  </div>
                  <div>
                    <h5 className="fw-bold text-dark m-0" style={{ fontSize: "16px", lineHeight: 1.2 }}>Venue Location</h5>
                    <span className="text-muted small" style={{ fontSize: "12px" }}>{event.place || "At a participating restaurant"}</span>
                  </div>
                </div>
                <div className="p-3 bg-light rounded-3 mb-3 border">
                  <span className="text-muted small d-block mb-1">Address Details</span>
                  <p className="text-dark fw-semibold mb-0 small" style={{ lineHeight: "1.4" }}>
                    {venueDisplay}
                  </p>
                </div>

                {/* Cohesive Action Buttons */}
                {isRestaurantOption && restaurant && (
                  <div className="d-flex flex-column gap-2">
                    {event.isMyEvent && !reservation && (
                      <button
                        type="button"
                        className="btn btn-primary w-100 rounded-3 py-2.5 fw-semibold shadow-xs d-flex align-items-center justify-content-center gap-2"
                        onClick={handleOpenReservationModal}
                        style={{ background: "#3e56f0", border: "none", fontSize: "13.5px", height: "40px" }}
                      >
                        <i className="fa-solid fa-utensils"></i>
                        Reserve Table at Venue
                      </button>
                    )}

                    <div className="d-flex gap-2">
                      <button
                        type="button"
                        className="btn btn-light border flex-grow-1 rounded-3 py-2 fw-semibold d-flex align-items-center justify-content-center gap-2"
                        onClick={() => setShowVenueModal(true)}
                        style={{ background: "#ffffff", borderColor: "#e2e8f0", color: "#334155", fontSize: "13px", height: "38px" }}
                      >
                        <i className="fa-solid fa-circle-info text-primary"></i>
                        View Details
                      </button>
                      <button
                        type="button"
                        className="btn btn-light border flex-grow-1 rounded-3 py-2 fw-semibold d-flex align-items-center justify-content-center gap-2"
                        onClick={() => {
                          const mId = event?.merchantId?._id || event?.merchantId || restaurant?.merchantId?._id || restaurant?.merchantId || event?.serviceLocationId?.merchantId?._id || event?.serviceLocationId?.merchantId || "68c286d5a6251e9e18485481";
                          const mName = encodeURIComponent(chosenRestaurantName || restaurant?.serviceName || "Restaurant");
                          const eId = event?.eventId || event?.id || eventId;
                          router.push(`/merchant-chat?eventId=${eId}&merchantId=${mId}&merchantName=${mName}`);
                        }}
                        style={{ background: "#ffffff", borderColor: "#e2e8f0", color: "#334155", fontSize: "13px", height: "38px" }}
                      >
                        <i className="fa-solid fa-comments text-primary"></i>
                        Chat
                      </button>
                    </div>
                  </div>
                )}

                {isRestaurantOption && event.isMyEvent && reservation && (
                  <div className="mt-3 pt-3 border-top">
                    <div className="p-3 rounded-3 border text-start" style={{
                      background: reservation.status === "active" ? "#f0fdf4" : reservation.status === "cancelled" ? "#fef2f2" : "#fffbeb",
                      borderColor: reservation.status === "active" ? "#bbf7d0" : reservation.status === "cancelled" ? "#fecaca" : "#fcd34d"
                    }}>
                      <div className="d-flex align-items-center justify-content-between mb-1.5">
                        <small className="fw-bold" style={{
                          color: reservation.status === "active" ? "#166534" : reservation.status === "cancelled" ? "#991b1b" : "#92400e"
                        }}>
                          <i className={reservation.status === "active" ? "fa-solid fa-circle-check me-1 text-success" : reservation.status === "cancelled" ? "fa-solid fa-circle-xmark me-1 text-danger" : "fa-solid fa-clock me-1 text-warning"}></i>
                          {reservation.status === "active" ? "Reservation Confirmed" : reservation.status === "cancelled" ? "Reservation Cancelled" : "Reservation Pending"}
                        </small>
                        <Link href="/my-reservations" className="text-decoration-none small fw-semibold" style={{ fontSize: "11px" }}>
                          Manage
                        </Link>
                      </div>
                      <p className="text-muted small mb-0" style={{ fontSize: "12px" }}>
                        Table for <strong>{reservation.adultCount || event.selectedGuests?.length || 1} Guests</strong>
                        {reservation.status === "pending" && " (Awaiting venue confirmation)"}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Event Setup & Settings Widget */}
              <div className="card border-0 rounded-4 shadow-sm p-4 bg-white mb-4">
                <h5 className="fw-bold text-dark mb-4">
                  <i className="fa-solid fa-sliders text-success me-2"></i>
                  Event Setup
                </h5>

                <div className="d-flex flex-column gap-3">
                  {/* Guest Rules */}
                  <div className="d-flex align-items-start gap-3">
                    <div
                      className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{ width: "36px", height: "36px", background: "#fef3c7", color: "#d97706", fontSize: "16px" }}
                    >
                      <i className="fa-solid fa-user-plus"></i>
                    </div>
                    <div>
                      <span className="text-muted small d-block">Additional Guests</span>
                      <strong className="text-dark small">
                        {event.bringGuests === "Yes" ? `Allowed (Max: ${event.maxGuests || 1})` : "Not Allowed"}
                      </strong>
                    </div>
                  </div>

                  {/* RSVP Rules */}
                  <div className="d-flex align-items-start gap-3">
                    <div
                      className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{ width: "36px", height: "36px", background: "#fdf2f8", color: "#db2777", fontSize: "16px" }}
                    >
                      <i className="fa-regular fa-envelope"></i>
                    </div>
                    <div>
                      <span className="text-muted small d-block">RSVP Needed</span>
                      <strong className="text-dark small">
                        {event.rsvp === "Yes" ? `Yes (By ${event.rsvpBy || "Event Date"})` : "No"}
                      </strong>
                    </div>
                  </div>

                  {/* Registry Link */}
                  {event.registryUrl && (
                    <div className="d-flex align-items-start gap-3">
                      <div
                        className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                        style={{ width: "36px", height: "36px", background: "#e0f2fe", color: "#0284c7", fontSize: "16px" }}
                      >
                        <i className="fa-solid fa-gift"></i>
                      </div>
                      <div className="overflow-hidden">
                        <span className="text-muted small d-block">Registry URL</span>
                        {typeof event.registryUrl === "object" ? (
                          <a href={event.registryUrl.registryUrl || event.registryUrl.registryName || "#"} target="_blank" rel="noopener noreferrer" className="text-primary text-decoration-none small text-truncate d-block fw-semibold">
                            {event.registryUrl.registryName || event.registryUrl.registryUrl || "Registry"} <i className="fa-solid fa-arrow-up-right-from-square ms-1" style={{ fontSize: "10px" }}></i>
                          </a>
                        ) : (
                          <a href={event.registryUrl} target="_blank" rel="noopener noreferrer" className="text-primary text-decoration-none small text-truncate d-block fw-semibold">
                            {event.registryUrl} <i className="fa-solid fa-arrow-up-right-from-square ms-1" style={{ fontSize: "10px" }}></i>
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Organizer Details */}
                  <div className="d-flex align-items-start gap-3 border-top pt-3 mb-3">
                    <div
                      className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{ width: "36px", height: "36px", background: "#f3f4f6", color: "#374151", fontSize: "16px" }}
                    >
                      <i className="fa-regular fa-user"></i>
                    </div>
                    <div>
                      <span className="text-muted small d-block">Event Organizer</span>
                      <strong className="text-dark small">{event.organizerName || "Organizer"}</strong>
                    </div>
                  </div>

                  {/* Your Invitation Status */}
                  {!event.isMyEvent && (
                    <div className="d-flex align-items-start gap-3 border-top pt-3 mb-3 animate__animated animate__fadeIn">
                      <div
                        className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                        style={{
                          width: "36px",
                          height: "36px",
                          background: event.status?.toLowerCase() === "accepted" || event.status?.toLowerCase() === "upcoming" ? "#d1fae5" : event.status?.toLowerCase() === "declined" ? "#fee2e2" : "#fef3c7",
                          color: event.status?.toLowerCase() === "accepted" || event.status?.toLowerCase() === "upcoming" ? "#065f46" : event.status?.toLowerCase() === "declined" ? "#991b1b" : "#854d0e",
                          fontSize: "16px"
                        }}
                      >
                        <i className={event.status?.toLowerCase() === "accepted" || event.status?.toLowerCase() === "upcoming" ? "fa-solid fa-circle-check" : event.status?.toLowerCase() === "declined" ? "fa-solid fa-circle-xmark" : "fa-regular fa-clock"}></i>
                      </div>
                      <div>
                        <span className="text-muted small d-block">Your Invitation Status</span>
                        <strong className="text-dark small" style={{ textTransform: "capitalize" }}>
                          {event.status || "Pending"}
                        </strong>
                      </div>
                    </div>
                  )}

                  {/* Invitation Action Buttons */}
                  {!event.isMyEvent && (
                    <div className="border-top pt-3 mt-2">
                      {["accepted", "ongoing", "approved", "ongoingevent", "upcoming"].includes(event.status?.toLowerCase()) && (
                        <div className="d-grid gap-2">
                          <button 
                            type="button" 
                            className="btn btn-danger rounded-pill py-2 fw-semibold"
                            onClick={() => setShowDeclineModal(true)}
                          >
                            Decline
                          </button>
                        </div>
                      )}
                      {event.status?.toLowerCase() === "declined" && (
                        <div className="d-grid gap-2">
                          <button 
                            type="button" 
                            className="btn btn-success rounded-pill py-2 fw-semibold text-white animate__animated animate__fadeIn"
                            style={{ background: "#4f46e5", border: "none" }}
                            onClick={() => setShowAcceptModal(true)}
                          >
                            Accept
                          </button>
                        </div>
                      )}
                      {(!event.status || ["pending", "not_invited"].includes(event.status.toLowerCase())) && (
                        <div className="d-flex gap-2 justify-content-between animate__animated animate__fadeIn">
                          <button 
                            type="button" 
                            className="btn btn-primary rounded-pill flex-grow-1 py-2 fw-semibold text-white" 
                            style={{ background: "#4f46e5", border: "none" }}
                            onClick={() => setShowAcceptModal(true)}
                          >
                            Accept
                          </button>
                          <button 
                            type="button" 
                            className="btn btn-outline-danger rounded-pill flex-grow-1 py-2 fw-semibold"
                            onClick={() => setShowDeclineModal(true)}
                          >
                            Decline
                          </button>
                          <button 
                            type="button" 
                            className="btn btn-outline-primary rounded-pill flex-grow-1 py-2 fw-semibold"
                            onClick={handleSetReminder}
                            disabled={submitting}
                          >
                            Remind Me
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Organizer Event Controls (Edit & Publish) */}
                  {event.isMyEvent && (
                    <div className="border-top pt-3 mt-2 d-flex flex-column gap-2 animate__animated animate__fadeIn">
                      {event.status?.toLowerCase() === "draft" && (
                        <button 
                          type="button" 
                          className="btn btn-success rounded-pill py-2.5 fw-bold text-white shadow-sm d-flex align-items-center justify-content-center gap-2"
                          style={{ background: "#10b981", border: "none" }}
                          onClick={handlePublishDraft}
                          disabled={publishing}
                        >
                          {publishing ? (
                            <>
                              <span className="spinner-border spinner-border-sm" role="status"></span>
                              Publishing Event...
                            </>
                          ) : (
                            <>
                              <i className="fa-solid fa-rocket"></i> Publish & Make Live
                            </>
                          )}
                        </button>
                      )}
                      <button 
                        type="button" 
                        className="btn btn-outline-primary rounded-pill py-2 fw-semibold d-flex align-items-center justify-content-center gap-2"
                        onClick={handleOpenEditModal}
                      >
                        <i className="fa-solid fa-pen-to-square"></i> Edit Event Details
                      </button>
                    </div>
                  )}

                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Table Reservation Modal */}
      {showReservationModal && (
        <div 
          className="modal fade show d-block" 
          tabIndex="-1" 
          role="dialog"
          style={{ background: "rgba(0, 0, 0, 0.5)", zIndex: 1055 }}
        >
          <div className="modal-dialog modal-dialog-centered px-3" style={{ maxWidth: "460px" }}>
            <div className="modal-content border-0 rounded-4 shadow-lg p-4 position-relative bg-white text-start">
              <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2.5">
                <div className="d-flex align-items-center gap-2">
                  <div 
                    className="rounded-circle d-flex align-items-center justify-content-center text-white"
                    style={{ width: "36px", height: "36px", background: "#7c3aed" }}
                  >
                    <i className="fa-solid fa-utensils"></i>
                  </div>
                  <div>
                    <h5 className="fw-bold text-dark mb-0" style={{ fontSize: "16px" }}>Reserve Table at Venue</h5>
                    <small className="text-muted">{restaurant?.serviceName || restaurant?.name || "Participating Restaurant"}</small>
                  </div>
                </div>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setShowReservationModal(false)}
                  disabled={resSubmitting}
                ></button>
              </div>

              <form onSubmit={handleMakeReservation}>
                <div className="mb-3">
                  <label className="form-label fw-semibold text-dark small mb-1">
                    <i className="fa-solid fa-users me-1 text-primary"></i> Number of Adult Guests <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    className="form-control"
                    value={resAdults}
                    onChange={(e) => setResAdults(e.target.value)}
                    placeholder="e.g. 10"
                  />
                  <small className="text-muted" style={{ fontSize: "11.5px" }}>Pre-filled based on your invited guests list.</small>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold text-dark small mb-1">
                    <i className="fa-solid fa-child me-1 text-secondary"></i> Children Count (Optional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    value={resChildren}
                    onChange={(e) => setResChildren(e.target.value)}
                    placeholder="0"
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold text-dark small mb-1">
                    <i className="fa-regular fa-comment-dots me-1 text-secondary"></i> Special Instructions (Optional)
                  </label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={resInstructions}
                    onChange={(e) => setResInstructions(e.target.value)}
                    placeholder="e.g. Window-side table, birthday setup, high chair needed..."
                    style={{ fontSize: "13px" }}
                  ></textarea>
                </div>

                {resError && (
                  <div className="alert alert-danger py-2 px-3 small rounded-3 mb-3">
                    <i className="fa-solid fa-circle-exclamation me-1"></i> {resError}
                  </div>
                )}

                <div className="d-flex align-items-center justify-content-end gap-2 pt-2 border-top">
                  <button
                    type="button"
                    className="btn btn-light rounded-pill px-3.5 py-2 fw-semibold text-secondary"
                    onClick={() => setShowReservationModal(false)}
                    disabled={resSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn text-white rounded-pill px-4 py-2 fw-bold shadow-sm d-flex align-items-center gap-2"
                    style={{ background: "#7c3aed", borderColor: "#7c3aed" }}
                    disabled={resSubmitting}
                  >
                    {resSubmitting ? (
                      <><i className="fa-solid fa-spinner fa-spin"></i> Sending Request...</>
                    ) : (
                      <><i className="fa-solid fa-paper-plane"></i> Send Booking Request</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Venue Details Modal dialog */}
      {showVenueModal && (event.serviceLocationId || restaurant) && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ background: "rgba(5, 2, 62, 0.55)", zIndex: 1050 }}
          onClick={() => setShowVenueModal(false)}
        >
          <div
            className="modal-dialog modal-dialog-centered modal-dialog-scrollable px-3"
            style={{ maxWidth: "550px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content border-0 rounded-4 overflow-hidden shadow-lg bg-white">

              <div className="modal-header border-bottom py-3 px-4 d-flex justify-content-between align-items-center">
                <h5 className="modal-title fw-bold text-dark m-0" style={{ fontSize: "18px" }}>Venue Information</h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setShowVenueModal(false)}
                ></button>
              </div>

              <div className="modal-body p-4 text-start">
                {/* Banner / Profile Image */}
                <div className="mb-4 rounded-3 overflow-hidden" style={{ height: "200px" }}>
                  <img
                    src={displayRestaurantImage}
                    alt={displayRestaurantName}
                    className="w-100 h-100 object-fit-cover"
                    onError={(e) => {
                      e.target.src = "/images/banner.jpg";
                    }}
                  />
                </div>

                <h4 className="fw-bold mb-2 text-dark">
                  {displayRestaurantName}
                </h4>
                <p className="text-muted mb-4 small" style={{ lineHeight: "1.6" }}>
                  {displayRestaurantDescription}
                </p>

                {/* Details layout rows */}
                <div className="d-flex flex-column gap-3">

                  {/* Cuisine (if available on merchant profile) */}
                  {restaurant?.cuisineName && !event.serviceLocationId && (
                    <div className="d-flex align-items-center gap-3">
                      <div
                        className="rounded-3 d-flex align-items-center justify-content-center"
                        style={{ width: "38px", height: "38px", background: "#e0f2fe", color: "#0284c7" }}
                      >
                        <i className="fa-solid fa-utensils"></i>
                      </div>
                      <div>
                        <span className="small text-muted d-block">Cuisine</span>
                        <strong className="text-dark small">{restaurant.cuisineName}</strong>
                      </div>
                    </div>
                  )}

                  {/* Selected Address */}
                  <div className="d-flex align-items-center gap-3">
                    <div
                      className="rounded-3 d-flex align-items-center justify-content-center"
                      style={{ width: "38px", height: "38px", background: "#ecfdf5", color: "#059669" }}
                    >
                      <i className="fa-solid fa-location-dot"></i>
                    </div>
                    <div className="overflow-hidden">
                      <span className="small text-muted d-block">Venue Location Address</span>
                      <strong className="text-dark small text-break">
                        {displayAddress}
                      </strong>
                    </div>
                  </div>

                  {/* Phone */}
                  {displayPhone && (
                    <div className="d-flex align-items-center gap-3">
                      <div
                        className="rounded-3 d-flex align-items-center justify-content-center"
                        style={{ width: "38px", height: "38px", background: "#fff1f2", color: "#e11d48" }}
                      >
                        <i className="fa-solid fa-phone"></i>
                      </div>
                      <div>
                        <span className="small text-muted d-block">Phone</span>
                        <strong className="text-dark small">{displayPhone}</strong>
                      </div>
                    </div>
                  )}

                  {/* Capacity */}
                  {displayCapacity && (
                    <div className="d-flex align-items-center gap-3">
                      <div
                        className="rounded-3 d-flex align-items-center justify-content-center"
                        style={{ width: "38px", height: "38px", background: "#fef3c7", color: "#d97706" }}
                      >
                        <i className="fa-solid fa-users"></i>
                      </div>
                      <div>
                        <span className="small text-muted d-block">Capacity</span>
                        <strong className="text-dark small">{displayCapacity} Guests</strong>
                      </div>
                    </div>
                  )}

                  {/* Website link */}
                  {restaurant?.webUrl && !event.serviceLocationId && (
                    <div className="d-flex align-items-center gap-3">
                      <div
                        className="rounded-3 d-flex align-items-center justify-content-center"
                        style={{ width: "38px", height: "38px", background: "#f5f3ff", color: "#7c3aed" }}
                      >
                        <i className="fa-solid fa-link"></i>
                      </div>
                      <div>
                        <span className="small text-muted d-block">Website</span>
                        <a
                          href={restaurant.webUrl.startsWith("http") ? restaurant.webUrl : `https://${restaurant.webUrl}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary text-decoration-none small fw-semibold"
                        >
                          {restaurant.webUrl} <i className="fa-solid fa-arrow-up-right-from-square ms-1" style={{ fontSize: "10px" }}></i>
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Menu link */}
                  {restaurant?.menuUrl && !event.serviceLocationId && (
                    <div className="d-flex align-items-center gap-3">
                      <div
                        className="rounded-3 d-flex align-items-center justify-content-center"
                        style={{ width: "38px", height: "38px", background: "#fffbeb", color: "#d97706" }}
                      >
                        <i className="fa-solid fa-book-open"></i>
                      </div>
                      <div>
                        <span className="small text-muted d-block">Menu URL</span>
                        <a
                          href={restaurant.menuUrl.startsWith("http") ? restaurant.menuUrl : `https://${restaurant.menuUrl}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary text-decoration-none small fw-semibold"
                        >
                          View Menu <i className="fa-solid fa-arrow-up-right-from-square ms-1" style={{ fontSize: "10px" }}></i>
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Weekly Schedule & Shift hours */}
                  {event.serviceLocationId?.weeklySchedule && event.serviceLocationId.weeklySchedule.length > 0 && (
                    <div className="mt-4 pt-3 border-top">
                      <h6 className="fw-bold text-dark mb-2 small">
                        <i className="fa-regular fa-calendar-days text-primary me-1.5"></i>
                        Weekly Schedule & Hours
                      </h6>
                      <div className="bg-light p-2.5 rounded-3 border">
                        {event.serviceLocationId.weeklySchedule.map((sched, idx) => {
                          const hasMorning = sched.morning && (sched.morning.from !== "00:00" || sched.morning.to !== "00:00");
                          const hasEvening = sched.evening && (sched.evening.from !== "00:00" || sched.evening.to !== "00:00");
                          return (
                            <div key={sched._id || idx} className="d-flex justify-content-between text-muted small py-1.5 border-bottom border-light-subtle last-border-0" style={{ fontSize: "12px" }}>
                              <span className="fw-semibold text-dark">{sched.day}</span>
                              <span className="text-end">
                                {!hasMorning && !hasEvening ? (
                                  <span className="badge bg-danger bg-opacity-10 text-danger rounded-pill px-2">Closed</span>
                                ) : (
                                  <>
                                    {hasMorning && `Morning: ${sched.morning.from} - ${sched.morning.to}`}
                                    {hasMorning && hasEvening && <br />}
                                    {hasEvening && `Evening: ${sched.evening.from} - ${sched.evening.to}`}
                                  </>
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Photos / Gallery list */}
                  {event.serviceLocationId?.locationPhotoVideoList && event.serviceLocationId.locationPhotoVideoList.length > 0 && (
                    <div className="mt-4 pt-3 border-top">
                      <h6 className="fw-bold text-dark mb-2 small">
                        <i className="fa-regular fa-image text-primary me-1.5"></i>
                        Venue Media Gallery
                      </h6>
                      <div className="d-flex gap-2 overflow-x-auto pb-2">
                        {event.serviceLocationId.locationPhotoVideoList.map((media, idx) => {
                          const imgKey = media.thumbnail || media.file;
                          const imgUrl = imgKey.startsWith("http") ? imgKey : `https://event-una-image-bucket.s3.ap-south-1.amazonaws.com/merchant/locationPhotoVideo/${imgKey}`;
                          return (
                            <div key={media._id || idx} className="rounded-3 overflow-hidden border shadow-sm flex-shrink-0" style={{ width: "120px", height: "80px" }}>
                              <img src={imgUrl} alt={media.description || "Venue photo"} className="w-100 h-100 object-fit-cover" />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                </div>
              </div>

              <div className="modal-footer py-2 px-3 border-top">
                <button
                  type="button"
                  className="btn btn-secondary rounded-pill px-4"
                  onClick={() => setShowVenueModal(false)}
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Accept Invitation Modal dialog */}
      {showAcceptModal && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ background: "rgba(10, 6, 80, 0.65)", backdropFilter: "blur(6px)", zIndex: 1050 }}
          onClick={() => !submitting && setShowAcceptModal(false)}
        >
          <div
            className="modal-dialog modal-dialog-centered modal-dialog-scrollable px-3"
            style={{ maxWidth: "480px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <form className="modal-content border-0 rounded-4 overflow-hidden shadow-lg bg-white" onSubmit={handleConfirmAccept}>
              {/* Modern Header */}
              <div className="modal-header border-bottom-0 py-3 px-4 d-flex justify-content-between align-items-center bg-primary text-white">
                <div className="d-flex align-items-center gap-2">
                  <div className="rounded-circle bg-white bg-opacity-20 d-flex align-items-center justify-content-center" style={{ width: "32px", height: "32px" }}>
                    <i className="fa-regular fa-envelope-open text-white"></i>
                  </div>
                  <h5 className="modal-title fw-bold text-white m-0" style={{ fontSize: "16px", letterSpacing: "0.2px" }}>Accept Invitation</h5>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white opacity-75 border-0 bg-transparent text-white fs-5"
                  aria-label="Close"
                  disabled={submitting}
                  onClick={() => setShowAcceptModal(false)}
                  style={{ cursor: "pointer", transition: "opacity 0.2s" }}
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              {/* Modal Body */}
              <div className="modal-body p-4 bg-light bg-opacity-50">
                <div className="text-center mb-4">
                  <div className="d-inline-flex align-items-center justify-content-center bg-success bg-opacity-10 text-success rounded-circle mb-2" style={{ width: "50px", height: "50px" }}>
                    <i className="fa-solid fa-circle-check fs-4"></i>
                  </div>
                  <h6 className="fw-bold text-dark mb-1" style={{ fontSize: "16px" }}>We&apos;re happy that you will attend this!</h6>
                  <p className="text-muted small mb-0">Please fill in the optional details below to confirm.</p>
                </div>

                {apiMessage.text && (
                  <div className={`alert alert-${apiMessage.type} small border-0 shadow-sm py-2 px-3 mb-3 d-flex align-items-center gap-2`} role="alert" style={{ borderRadius: "10px" }}>
                    <i className={`fa-solid ${apiMessage.type === "success" ? "fa-circle-check" : "fa-circle-exclamation"}`}></i>
                    {apiMessage.text}
                  </div>
                )}

                {/* Optional Thank You message */}
                <div className="mb-3">
                  <label className="form-label text-dark small fw-bold mb-1.5">Optional Thank You Message</label>
                  <textarea
                    className="form-control border-light-subtle shadow-sm rounded-3 px-3 py-2"
                    rows="2.5"
                    placeholder="Write a thank you note..."
                    value={thanksMessage}
                    onChange={(e) => setThanksMessage(e.target.value)}
                    style={{ fontSize: "13.5px", resize: "none", borderColor: "#e5e7eb" }}
                  ></textarea>
                </div>

                {/* Optional Suggestion message */}
                <div className="mb-3">
                  <label className="form-label text-dark small fw-bold mb-1.5">Optional Suggestions</label>
                  <textarea
                    className="form-control border-light-subtle shadow-sm rounded-3 px-3 py-2"
                    rows="2.5"
                    placeholder="Any specific preference or suggestion..."
                    value={suggestionMessage}
                    onChange={(e) => setSuggestionMessage(e.target.value)}
                    style={{ fontSize: "13.5px", resize: "none", borderColor: "#e5e7eb" }}
                  ></textarea>
                </div>

                {/* Can bring along guests text input */}
                <div className="mb-2">
                  <label className="form-label text-dark small fw-bold mb-1.5">Can bring along guests</label>
                  <input
                    type="number"
                    min="0"
                    className="form-control border-light-subtle shadow-sm rounded-pill px-4"
                    placeholder="0"
                    value={alongGuest}
                    onChange={(e) => setAlongGuest(e.target.value)}
                    style={{ fontSize: "14px", height: "42px", borderColor: "#e5e7eb" }}
                  />
                </div>
              </div>

              {/* Modern Action Footer */}
              <div className="modal-footer border-top-0 py-3 px-4 bg-white d-flex gap-3">
                <button
                  type="button"
                  className="btn btn-outline-secondary rounded-pill px-4 flex-grow-1 py-2.5 fw-bold text-muted border-light-subtle"
                  disabled={submitting}
                  onClick={() => setShowAcceptModal(false)}
                  style={{ fontSize: "13.5px", background: "#f9fafb" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary rounded-pill px-4 flex-grow-1 py-2.5 fw-bold text-white"
                  style={{ background: "#4f46e5", border: "none", fontSize: "13.5px" }}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Submitting...
                    </>
                  ) : (
                    "Confirm Attendance"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Decline Invitation Modal dialog */}
      {showDeclineModal && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ background: "rgba(10, 6, 80, 0.65)", backdropFilter: "blur(6px)", zIndex: 1050 }}
          onClick={() => !submitting && setShowDeclineModal(false)}
        >
          <div
            className="modal-dialog modal-dialog-centered modal-dialog-scrollable px-3"
            style={{ maxWidth: "480px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <form className="modal-content border-0 rounded-4 overflow-hidden shadow-lg bg-white" onSubmit={handleConfirmDecline}>
              {/* Modern Header */}
              <div className="modal-header border-bottom-0 py-3 px-4 d-flex justify-content-between align-items-center bg-danger text-white">
                <div className="d-flex align-items-center gap-2">
                  <div className="rounded-circle bg-white bg-opacity-20 d-flex align-items-center justify-content-center" style={{ width: "32px", height: "32px" }}>
                    <i className="fa-regular fa-bell-slash text-white"></i>
                  </div>
                  <h5 className="modal-title fw-bold text-white m-0" style={{ fontSize: "16px", letterSpacing: "0.2px" }}>Decline Invitation</h5>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white opacity-75 border-0 bg-transparent text-white fs-5"
                  aria-label="Close"
                  disabled={submitting}
                  onClick={() => setShowDeclineModal(false)}
                  style={{ cursor: "pointer", transition: "opacity 0.2s" }}
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              {/* Modal Body */}
              <div className="modal-body p-4 bg-light bg-opacity-50">
                <div className="text-center mb-4">
                  <div className="d-inline-flex align-items-center justify-content-center bg-danger bg-opacity-10 text-danger rounded-circle mb-2" style={{ width: "50px", height: "50px" }}>
                    <i className="fa-solid fa-face-frown fs-4"></i>
                  </div>
                  <h6 className="fw-bold text-dark mb-1" style={{ fontSize: "16px" }}>We&apos;re sad that you can&apos;t attend this.</h6>
                  <p className="text-muted small mb-0">Please tell us why you won&apos;t be able to make it.</p>
                </div>

                {apiMessage.text && (
                  <div className={`alert alert-${apiMessage.type} small border-0 shadow-sm py-2 px-3 mb-3 d-flex align-items-center gap-2`} role="alert" style={{ borderRadius: "10px" }}>
                    <i className={`fa-solid ${apiMessage.type === "success" ? "fa-circle-check" : "fa-circle-exclamation"}`}></i>
                    {apiMessage.text}
                  </div>
                )}

                {/* Reason to Decline */}
                <div className="mb-3">
                  <label className="form-label text-dark small fw-bold mb-1.5">Do you like to share the reason?</label>
                  <textarea
                    className="form-control border-light-subtle shadow-sm rounded-3 px-3 py-2"
                    rows="3"
                    placeholder="Reason Details"
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    style={{ fontSize: "13.5px", resize: "none", borderColor: "#e5e7eb" }}
                  ></textarea>
                </div>

                {/* Optional Suggestion message */}
                <div className="mb-2">
                  <label className="form-label text-dark small fw-bold mb-1.5">Provide Suggestion</label>
                  <textarea
                    className="form-control border-light-subtle shadow-sm rounded-3 px-3 py-2"
                    rows="3"
                    placeholder="Suggestion Details"
                    value={declineSuggestion}
                    onChange={(e) => setDeclineSuggestion(e.target.value)}
                    style={{ fontSize: "13.5px", resize: "none", borderColor: "#e5e7eb" }}
                  ></textarea>
                </div>
              </div>

              {/* Modern Action Footer */}
              <div className="modal-footer border-top-0 py-3 px-4 bg-white d-flex gap-3">
                <button
                  type="button"
                  className="btn btn-outline-secondary rounded-pill px-4 flex-grow-1 py-2.5 fw-bold text-muted border-light-subtle"
                  disabled={submitting}
                  onClick={() => setShowDeclineModal(false)}
                  style={{ fontSize: "13.5px", background: "#f9fafb" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-danger rounded-pill px-4 flex-grow-1 py-2.5 fw-bold text-white"
                  style={{ border: "none", fontSize: "13.5px" }}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Submitting...
                    </>
                  ) : (
                    "Confirm Decline"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Event Details Modal */}
      {showEditModal && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ background: "rgba(5, 2, 62, 0.6)", backdropFilter: "blur(4px)", zIndex: 1060 }}
          onClick={() => !editSaving && setShowEditModal(false)}
        >
          <div
            className="modal-dialog modal-dialog-centered modal-dialog-scrollable px-3"
            style={{ maxWidth: "560px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden">
              <div className="modal-header border-bottom py-3 px-4 bg-primary text-white d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center gap-2">
                  <div className="rounded-circle bg-white text-primary d-flex align-items-center justify-content-center" style={{ width: "34px", height: "34px" }}>
                    <i className="fa-solid fa-pen-to-square"></i>
                  </div>
                  <h6 className="fw-bold m-0 text-white" style={{ fontSize: "16px" }}>Edit Event Details</h6>
                </div>
                <button
                  type="button"
                  className="btn text-white border-0 p-0"
                  style={{ background: "none", fontSize: "18px" }}
                  onClick={() => !editSaving && setShowEditModal(false)}
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              <form onSubmit={handleSaveEditEvent}>
                <div className="modal-body p-4 bg-light d-flex flex-column gap-3">
                  {/* Event Title */}
                  <div>
                    <label className="form-label fw-semibold text-dark small mb-1">
                      Event Title <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control rounded-3 py-2"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="e.g. Annual Celebration, Birthday Party"
                      required
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="form-label fw-semibold text-dark small mb-1">
                      Event Description / Invitation Note
                    </label>
                    <textarea
                      className="form-control rounded-3 py-2"
                      rows="3"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Share details or a welcoming note with your guests..."
                    ></textarea>
                  </div>

                  {/* Date */}
                  <div>
                    <label className="form-label fw-semibold text-dark small mb-1">
                      Event Date
                    </label>
                    <input
                      type="date"
                      className="form-control rounded-3 py-2"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                    />
                  </div>

                  {/* Start Time & End Time */}
                  <div className="row g-2">
                    <div className="col-6">
                      <label className="form-label fw-semibold text-dark small mb-1">
                        Start Time
                      </label>
                      <input
                        type="time"
                        className="form-control rounded-3 py-2"
                        value={editStartTime}
                        onChange={(e) => setEditStartTime(e.target.value)}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label fw-semibold text-dark small mb-1">
                        End Time
                      </label>
                      <input
                        type="time"
                        className="form-control rounded-3 py-2"
                        value={editEndTime}
                        onChange={(e) => setEditEndTime(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="modal-footer border-top py-3 px-4 bg-white d-flex justify-content-end gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary rounded-pill px-4 fw-semibold"
                    onClick={() => setShowEditModal(false)}
                    disabled={editSaving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary rounded-pill px-4 fw-bold shadow-sm"
                    disabled={editSaving}
                  >
                    {editSaving ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Rating Modal */}
      {showRatingModal && (
        <div
          className="modal show d-block"
          tabIndex="-1"
          style={{ backgroundColor: "rgba(0,0,0,0.6)", zIndex: 1055 }}
        >
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: "480px" }}>
            <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden">
              <div
                className="modal-header border-0 p-4 text-white"
                style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" }}
              >
                <div>
                  <h5 className="modal-title fw-bold mb-1">Rate Event Experience</h5>
                  <p className="small mb-0 text-white-50">
                    Share your star rating and review for {event?.eventTitle}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowRatingModal(false)}
                  disabled={ratingSubmitting}
                ></button>
              </div>

              <form onSubmit={handleSubmitRating}>
                <div className="modal-body p-4 bg-light">
                  {/* Star Rating Selector */}
                  <div className="text-center mb-4 bg-white p-3 rounded-3 border">
                    <label className="form-label fw-bold text-dark d-block mb-2">
                      Overall Rating
                    </label>
                    <div className="d-flex justify-content-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          className="btn btn-link p-1 text-decoration-none border-0"
                          onClick={() => setRatingScore(star)}
                          style={{ fontSize: "28px", color: star <= ratingScore ? "#f59e0b" : "#cbd5e1" }}
                        >
                          <i className="fa-solid fa-star"></i>
                        </button>
                      ))}
                    </div>
                    <span className="small text-muted fw-semibold">
                      {ratingScore === 5 ? "⭐⭐⭐⭐⭐ Excellent" :
                       ratingScore === 4 ? "⭐⭐⭐⭐ Very Good" :
                       ratingScore === 3 ? "⭐⭐⭐ Good" :
                       ratingScore === 2 ? "⭐⭐ Fair" : "⭐ Poor"}
                    </span>
                  </div>

                  {/* Comment Textarea */}
                  <div className="mb-2">
                    <label className="form-label fw-semibold text-dark small mb-1">
                      Your Comments / Feedback (Optional)
                    </label>
                    <textarea
                      className="form-control rounded-3 py-2 px-3 border shadow-none"
                      rows="3"
                      placeholder="Tell us what you liked or what could be improved..."
                      value={ratingComment}
                      onChange={(e) => setRatingComment(e.target.value)}
                    ></textarea>
                  </div>
                </div>

                <div className="modal-footer border-top py-3 px-4 bg-white d-flex justify-content-end gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary rounded-pill px-4 fw-semibold"
                    onClick={() => setShowRatingModal(false)}
                    disabled={ratingSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-warning rounded-pill px-4 fw-bold text-dark shadow-sm"
                    disabled={ratingSubmitting}
                  >
                    {ratingSubmitting ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        Submitting...
                      </>
                    ) : (
                      "Submit Review"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Host QR Scanner Modal */}
      {showCheckInModal && (
        <div
          className="modal show d-block"
          tabIndex="-1"
          style={{ backgroundColor: "rgba(0,0,0,0.6)", zIndex: 1055 }}
        >
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: "460px" }}>
            <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden">
              <div
                className="modal-header border-0 p-4 text-white"
                style={{ background: "linear-gradient(135deg, #3e56f0 0%, #1d4ed8 100%)" }}
              >
                <div>
                  <h5 className="modal-title fw-bold mb-1">
                    <i className="fa-solid fa-qrcode me-2"></i> Attendance QR Scanner
                  </h5>
                  <p className="small mb-0 text-white-50">
                    Scan guest attendance QR code to verify admission
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowCheckInModal(false)}
                  disabled={checkInSubmitting}
                ></button>
              </div>

              <div className="modal-body p-4 bg-light text-center">
                <div
                  id="interactive-qr-scanner"
                  className="bg-white rounded-3 border overflow-hidden shadow-xs mb-3 text-center"
                  style={{ minHeight: "260px" }}
                ></div>

                {cameraError ? (
                  <div className="alert alert-warning py-2.5 px-3 small rounded-3 mb-0 text-start">
                    <i className="fa-solid fa-triangle-exclamation me-2 text-warning"></i>
                    {cameraError}
                  </div>
                ) : (
                  <p className="small text-muted mb-0">
                    <i className="fa-solid fa-video text-primary me-1"></i> Point your camera at the attendee&apos;s QR code to record attendance automatically.
                  </p>
                )}
              </div>

              <div className="modal-footer border-top py-2.5 px-4 bg-white d-flex justify-content-end">
                <button
                  type="button"
                  className="btn btn-outline-secondary rounded-pill px-4 fw-semibold btn-sm"
                  onClick={() => setShowCheckInModal(false)}
                  disabled={checkInSubmitting}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}

export default function EventDetailsPage() {
  return (
    <Suspense fallback={
      <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading event...</span>
          </div>
        </div>
      </div>
    }>
      <EventDetailsContent />
    </Suspense>
  );
}
