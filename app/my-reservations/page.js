"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "../components/Header";
import Footer from "../components/Footer";
import SafeImage from "../components/SafeImage";
import { authService } from "../services/authService";
import { apiRequest } from "../services/apiClient";
import { getReservationDetailsApi, cancelReservationApi, resendReservationApi, getCancelReasonsApi, makeReservationApi } from "../services/reservationApi";
import Swal from "sweetalert2";

export default function MyReservationsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [cancelModal, setCancelModal] = useState({ show: false, id: null, reservationId: null, comment: "", reason: "" });
  const [cancelSuccessPopup, setCancelSuccessPopup] = useState({ show: false, message: "" });
  const [modifySuccessPopup, setModifySuccessPopup] = useState({ show: false, message: "" });
  const [successMessage, setSuccessMessage] = useState("");
  const [modifyModal, setModifyModal] = useState({
    show: false,
    id: null,
    eventId: null,
    reservationId: null,
    adultCount: "",
    childCount: "",
    instruction: "",
    couponId: "",
    guestType: "All",
  });
  const [cancelReasonsList, setCancelReasonsList] = useState([]);
  const [resSubmitting, setResSubmitting] = useState(false);
  const [resError, setResError] = useState("");

  // Map backend reservation event object to frontend format
  const mapReservationItem = (item) => {
    let formattedDate = item.eventDate || "Date TBD";
    try {
      if (item.eventDate) {
        const parts = item.eventDate.split('-');
        if (parts.length === 3) {
          const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          const monthStr = monthNames[parseInt(parts[1]) - 1] || parts[1];
          formattedDate = `${parts[0]} ${monthStr} ${parts[2]}`;
        }
      }
    } catch (e) { }

    const resObj = item.makeReservation || null;
    const hasReservation = Boolean(resObj && resObj._id);

    const merchantObj = resObj?.merchantId || {};
    const locationObj = resObj?.serviceLocationId || item.serviceLocationId || {};

    let venueAddress = "Location TBD";
    if (locationObj?.addressName || locationObj?.address) {
      venueAddress = locationObj.addressName && locationObj.address
        ? `${locationObj.addressName} - ${locationObj.address}`
        : (locationObj.address || locationObj.addressName);
    }

    let displayStatus = "Rejected";
    if (hasReservation) {
      const rawStatus = (resObj.status || "active").toLowerCase();
      if (rawStatus === "cancelled" || rawStatus === "rejected") {
        displayStatus = "Cancelled";
      } else {
        displayStatus = "Confirmed";
      }
    } else {
      displayStatus = "Rejected";
    }

    const guests = resObj?.adultCount ? `${resObj.adultCount.padStart(2, '0')} Guests` : "01 Guest";

    let totalAmount = 0;
    if (Array.isArray(item.serviceBookings) && item.serviceBookings.length > 0) {
      totalAmount = item.serviceBookings.reduce((sum, sb) => sum + (sb.finalAmount || 0), 0);
    }

    return {
      id: item._id,
      hasReservation: hasReservation,
      reservationId: resObj?._id || null,
      eventTitle: item.eventTitle || merchantObj.serviceName || "Event Reservation",
      eventDate: formattedDate,
      eventStartTime: item.eventStartTime || "12:00 PM",
      eventEndTime: item.eventEndTime || "04:00 PM",
      venue: venueAddress,
      status: displayStatus,
      rawStatus: resObj?.status || item.status,
      guestsCount: guests,
      reservedOn: item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-GB", { day: 'numeric', month: 'short', year: 'numeric' }) : "Recently",
      img: item.image || merchantObj.bannerImage || "",
      eventId: item._id,
      packagePrice: totalAmount || 35,
      tax: 5,
      discount: 5,
      totalPaid: totalAmount || 35,
      tableNumber: resObj?.instruction || "Table-Standard",
      organizerName: item.eventcreator?.fullName || merchantObj.serviceName || "Event Host",
      organizerEmail: item.eventcreator?.email || merchantObj.email || "support@eventuna.com",
      organizerPhone: merchantObj.mobile || merchantObj.phone || "+91 810300655",
      attendanceQr: resObj?.attendanceQr || null,
      serviceBookings: item.serviceBookings || [],
      contactList: item.contactList || [],
      invitedUsers: item.invitedUsers || [],
      rawItem: item
    };
  };

  // Load profile and reservations
  useEffect(() => {
    // Profile load
    const loadProfile = async () => {
      try {
        const profRes = await authService.getUserProfile();
        if (profRes && profRes.status && profRes.user) {
          setProfile(profRes.user);
        } else {
          const localUser = authService.getUser();
          if (localUser) setProfile(localUser);
        }
      } catch (err) {
        console.error("Profile load failed:", err);
      }
    };
    loadProfile();

    // Live Reservations API load
    const fetchReservations = async () => {
      try {
        setLoading(true);
        const res = await getReservationDetailsApi();
        if (res && res.status && Array.isArray(res.data) && res.data.length > 0) {
          const mapped = res.data.map(mapReservationItem);
          setReservations(mapped);
          localStorage.setItem("eventuna-reservations", JSON.stringify(mapped));
        } else {
          setReservations([]);
          localStorage.removeItem("eventuna-reservations");
        }
      } catch (e) {
        console.error("Failed to load live reservations:", e);
        setReservations([]);
        localStorage.removeItem("eventuna-reservations");
      } finally {
        setLoading(false);
      }
    };

    fetchReservations();

    // Load cancel reasons
    const loadCancelReasons = async () => {
      try {
        const res = await getCancelReasonsApi();
        if (res && res.status === true && Array.isArray(res.data)) {
          setCancelReasonsList(res.data);
        }
      } catch (err) {
        console.error("Failed to load cancel reasons:", err);
      }
    };
    loadCancelReasons();
  }, []);

  const handleCancelClick = (res) => {
    const realReservationId = res.reservationId || res.rawItem?.makeReservation?._id;
    if (!realReservationId) {
      Swal.fire({
        title: "Reservation Not Found",
        text: "This event does not have an active venue reservation record to cancel.",
        icon: "warning",
        confirmButtonColor: "#3e56f0"
      });
      return;
    }
    const defaultReason = cancelReasonsList.length > 0 ? cancelReasonsList[0]._id : "";
    setCancelModal({
      show: true,
      id: res.id,
      reservationId: realReservationId,
      comment: "",
      reason: defaultReason,
    });
  };

  const handleModifyClick = (res) => {
    const realReservationId = res.reservationId || res.rawItem?.makeReservation?._id;
    if (!realReservationId) {
      Swal.fire({
        title: "Reservation Not Found",
        text: "This event does not have an active venue reservation record to modify.",
        icon: "warning",
        confirmButtonColor: "#3e56f0"
      });
      return;
    }
    const resObj = res.rawItem?.makeReservation || {};
    setResError("");
    setModifyModal({
      show: true,
      id: res.id,
      eventId: res.eventId || res.id,
      reservationId: realReservationId,
      adultCount: String(resObj.adultCount || "1"),
      childCount: String(resObj.childCount || "0"),
      instruction: resObj.instruction || "",
      couponId: "",
      guestType: resObj.guestType || "All",
    });
  };

  const handleAdultCountChange = (delta) => {
    const current = parseInt(modifyModal.adultCount, 10) || 0;
    const next = Math.max(1, current + delta);
    setModifyModal((prev) => ({ ...prev, adultCount: String(next) }));
  };

  const handleChildCountChange = (delta) => {
    const current = parseInt(modifyModal.childCount, 10) || 0;
    const next = Math.max(0, current + delta);
    setModifyModal((prev) => ({ ...prev, childCount: String(next) }));
  };

  const handleModifyReservation = async (e) => {
    e && e.preventDefault && e.preventDefault();
    setResSubmitting(true);
    setResError("");
    try {
      const payload = {
        eventId: modifyModal.eventId,
        reservationId: modifyModal.reservationId,
        adultCount: modifyModal.adultCount,
        childCount: modifyModal.childCount,
        instruction: modifyModal.instruction,
        guestType: modifyModal.guestType || "All",
      };

      const enteredCoupon = (modifyModal.couponId || "").trim();
      if (enteredCoupon) {
        if (/^[0-9a-fA-F]{24}$/.test(enteredCoupon)) {
          payload.couponId = enteredCoupon;
        } else {
          try {
            const couponRes = await apiRequest("/merchant/all-coupons");
            let matched = null;
            if (couponRes && couponRes.status && Array.isArray(couponRes.data)) {
              matched = couponRes.data.find(
                (c) => c.couponName && c.couponName.toLowerCase() === enteredCoupon.toLowerCase()
              );
            }
            if (matched && matched._id) {
              payload.couponId = matched._id;
            } else {
              setResError(`Coupon "${enteredCoupon}" is invalid or expired. Please enter a valid coupon code or leave it blank.`);
              setResSubmitting(false);
              return;
            }
          } catch (cErr) {
            setResError(`Unable to validate coupon code "${enteredCoupon}". Please leave blank to continue.`);
            setResSubmitting(false);
            return;
          }
        }
      }

      const res = await makeReservationApi(payload);
      if (res && res.status === true) {
        setModifyModal({ show: false, id: null, eventId: null, reservationId: null, adultCount: "", childCount: "", instruction: "", couponId: "", guestType: "All" });
        setModifySuccessPopup({ show: true, message: res.message || "Reservation updated successfully" });
        // Refresh reservations
        const freshRes = await getReservationDetailsApi();
        if (freshRes && freshRes.status && Array.isArray(freshRes.data)) {
          setReservations(freshRes.data.map(mapReservationItem));
        }
      } else {
        throw new Error(res?.message || "Failed to modify reservation.");
      }
    } catch (err) {
      setResError(err.message || "Something went wrong while modifying reservation.");
    } finally {
      setResSubmitting(false);
    }
  };

  const confirmCancel = async () => {
    if (!cancelModal.reason) {
      alert("Please select a reason for cancellation.");
      return;
    }
    setResSubmitting(true);
    try {
      const payload = {
        reservationId: cancelModal.reservationId,
        cancelReason: cancelModal.reason,
      };
      if (cancelModal.comment) {
        payload.comment = cancelModal.comment;
      }

      const response = await cancelReservationApi(payload);
      if (response && response.status === true) {
        const updated = reservations.map((r) => {
          if (r.id === cancelModal.id || r.reservationId === cancelModal.reservationId) {
            return { ...r, status: "Cancelled" };
          }
          return r;
        });
        setReservations(updated);
        localStorage.setItem("eventuna-reservations", JSON.stringify(updated));
        setCancelModal({ show: false, id: null, reservationId: null, comment: "", reason: "" });
        setCancelSuccessPopup({ show: true, message: response.message || "Reservation Canceled successfully" });
      } else {
        Swal.fire({
          title: "Error",
          text: response?.message || "Failed to cancel reservation on server.",
          icon: "error",
          confirmButtonColor: "#3e56f0"
        });
      }
    } catch (err) {
      console.error("Cancel API error:", err);
      Swal.fire({
        title: "Error",
        text: err.message || "An error occurred while cancelling the reservation.",
        icon: "error",
        confirmButtonColor: "#3e56f0"
      });
    } finally {
      setResSubmitting(false);
    }
  };

  const handleViewDetails = (res) => {
    router.push(`/reservation-details?id=${res.id}`);
  };

  const handleResend = async (res) => {
    try {
      const payload = {
        reservationId: res.reservationId || res.id
      };
      const response = await resendReservationApi(payload);
      if (response && response.status === true) {
        setSuccessMessage(`Reservation details and QR pass for "${res.eventTitle}" (ID: ${res.id}) have been resent to your registered email!`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => setSuccessMessage(""), 5000);
      } else {
        Swal.fire({
          title: "Error",
          text: response?.message || "Failed to resend reservation details.",
          icon: "error",
          confirmButtonColor: "#3e56f0"
        });
      }
    } catch (err) {
      console.error("Resend API error:", err);
      Swal.fire({
        title: "Error",
        text: err.message || "An error occurred while resending reservation.",
        icon: "error",
        confirmButtonColor: "#3e56f0"
      });
    }
  };

  // Filter reservations by search
  const filteredReservations = reservations.filter((res) => {
    const searchString = `${res.eventTitle} ${res.id} ${res.venue}`.toLowerCase();
    return searchString.includes(searchQuery.toLowerCase());
  });

  // Calculate dynamic stats
  const upcomingCount = reservations.filter((r) => r.status === "Reservation Confirmed" || r.status === "Confirmed" || r.status === "active").length;
  const completedCount = reservations.filter((r) => r.status === "Completed").length;
  const cancelledCount = reservations.filter((r) => r.status === "Cancelled").length;

  return (
    <>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css" rel="stylesheet" />
      <style>{`
        /* Modern Dashboard & Reservation Styles */
        .res-dashboard-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 12px;
        }
        .res-dashboard-title {
          font-size: 24px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.4px;
          margin: 0;
        }
        .res-dashboard-sub {
          font-size: 14px;
          color: #64748b;
          margin: 4px 0 0 0;
        }

        /* Stat Cards */
        .res-stat-card {
          background: #ffffff;
          border-radius: 16px;
          padding: 20px 22px;
          border: 1px solid #eef2f6;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);
          display: flex;
          align-items: center;
          gap: 16px;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .res-stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.06);
        }
        .res-stat-icon-wrap {
          width: 50px;
          height: 50px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          flex-shrink: 0;
        }
        .stat-upcoming .res-stat-icon-wrap {
          background: #eff6ff;
          color: #2563eb;
        }
        .stat-completed .res-stat-icon-wrap {
          background: #ecfdf5;
          color: #059669;
        }
        .stat-cancelled .res-stat-icon-wrap {
          background: #fff1f2;
          color: #e11d48;
        }
        .res-stat-number {
          font-size: 26px;
          font-weight: 800;
          color: #0f172a;
          line-height: 1.1;
          margin: 0;
        }
        .res-stat-label {
          font-size: 13px;
          font-weight: 500;
          color: #64748b;
          margin: 4px 0 0 0;
        }

        /* Search bar */
        .res-search-input-wrap {
          position: relative;
          max-width: 420px;
        }
        .res-search-input {
          width: 100%;
          height: 44px;
          border-radius: 12px;
          border: 1.5px solid #e2e8f0;
          background: #ffffff;
          padding: 10px 16px 10px 42px;
          font-size: 14px;
          color: #1e293b;
          transition: all 0.2s ease;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
        }
        .res-search-input:focus {
          border-color: #3e56f0;
          box-shadow: 0 0 0 3px rgba(62, 86, 240, 0.12);
          outline: none;
        }
        .res-search-icon {
          position: absolute;
          top: 50%;
          left: 14px;
          transform: translateY(-50%);
          color: #94a3b8;
          font-size: 15px;
          pointer-events: none;
        }

        /* Modern Reservation Card */
        .modern-reservation-card {
          background: #ffffff;
          border-radius: 18px;
          border: 1px solid #eef2f6;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);
          margin-bottom: 20px;
          overflow: hidden;
          transition: all 0.25s ease;
        }
        .modern-reservation-card:hover {
          border-color: #cbd5e1;
          box-shadow: 0 10px 24px rgba(30, 41, 59, 0.07);
          transform: translateY(-2px);
        }
        .modern-reservation-body {
          padding: 22px 24px;
        }
        .modern-event-thumb {
          width: 130px;
          height: 110px;
          border-radius: 14px;
          overflow: hidden;
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
          background: #f1f5f9;
        }
        .modern-event-title {
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 8px;
          letter-spacing: -0.2px;
        }
        .modern-event-meta-line {
          font-size: 13px;
          color: #475569;
          margin-bottom: 6px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .modern-event-meta-line i {
          font-size: 14px;
          width: 16px;
          text-align: center;
        }

        /* Modern Status Badge / Pill */
        .res-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: 9999px;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
          letter-spacing: 0.2px;
          line-height: 1.2;
        }
        .pill-confirmed {
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #a7f3d0;
        }
        .pill-confirmed .res-status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.25);
          flex-shrink: 0;
        }
        .pill-cancelled {
          background: #fef2f2;
          color: #b91c1c;
          border: 1px solid #fecaca;
        }
        .pill-cancelled .res-status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #ef4444;
          box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2);
          flex-shrink: 0;
        }

        /* Modern Action Buttons */
        .res-btn-view {
          background: #3e56f0;
          color: #ffffff !important;
          border: none;
          font-weight: 600;
          font-size: 13px;
          padding: 8px 16px;
          border-radius: 10px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(62, 86, 240, 0.25);
          cursor: pointer;
          white-space: nowrap;
        }
        .res-btn-view:hover {
          background: #2f45d8;
          box-shadow: 0 4px 12px rgba(62, 86, 240, 0.35);
          transform: translateY(-1px);
        }

        .res-btn-secondary {
          background: #f8fafc;
          color: #334155 !important;
          border: 1.5px solid #e2e8f0;
          font-weight: 600;
          font-size: 13px;
          padding: 7px 14px;
          border-radius: 10px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s ease;
          cursor: pointer;
          white-space: nowrap;
        }
        .res-btn-secondary:hover {
          background: #eef2ff;
          border-color: #3e56f0;
          color: #3e56f0 !important;
          transform: translateY(-1px);
        }

        .res-btn-cancel {
          background: #fff;
          color: #e11d48 !important;
          border: 1.5px solid #fecdd3;
          font-weight: 600;
          font-size: 13px;
          padding: 7px 14px;
          border-radius: 10px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s ease;
          cursor: pointer;
          white-space: nowrap;
        }
        .res-btn-cancel:hover:not(:disabled) {
          background: #fff1f2;
          border-color: #e11d48;
          transform: translateY(-1px);
        }
        .res-btn-cancel:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          border-color: #e2e8f0;
          color: #94a3b8 !important;
        }

        /* Modern Bottom Meta Strip */
        .modern-card-footer {
          background: #f8fafc;
          border-top: 1px solid #f1f5f9;
          padding: 12px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
        }
        .modern-footer-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
        }
        .modern-footer-label {
          color: #64748b;
          font-size: 12px;
          font-weight: 500;
        }
        .modern-footer-val {
          color: #1e293b;
          font-weight: 600;
          font-size: 13px;
        }
        .res-id-chip {
          font-family: monospace;
          background: #e2e8f0;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 12px;
          color: #334155;
          letter-spacing: 0.3px;
        }

        /* Modern Modal Styling */
        .modal-custom-backdrop {
          background: rgba(15, 23, 42, 0.55);
          backdrop-filter: blur(4px);
        }
        .modern-modal-card {
          border-radius: 20px;
          border: 1px solid rgba(0, 0, 0, 0.08);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          background: #ffffff;
        }
        .guest-counter-box {
          background: #f8fafc;
          border: 1.5px solid #e2e8f0;
          border-radius: 14px;
          padding: 12px 16px;
          transition: all 0.2s ease;
        }
        .guest-counter-box:hover {
          border-color: #cbd5e1;
        }
        .guest-counter-box:focus-within {
          border-color: #3e56f0;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(62, 86, 240, 0.12);
        }
        .stepper-btn {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: 1.5px solid #cbd5e1;
          background: #ffffff;
          color: #334155;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .stepper-btn:hover:not(:disabled) {
          border-color: #3e56f0;
          color: #3e56f0;
          background: #eef2ff;
        }
        .stepper-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
          background: #f1f5f9;
        }
        .stepper-input {
          width: 48px;
          text-align: center;
          font-weight: 700;
          font-size: 16px;
          border: none;
          background: transparent;
          color: #0f172a;
          outline: none;
        }
        .stepper-input::-webkit-outer-spin-button,
        .stepper-input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .stepper-input {
          -moz-appearance: textfield;
        }
        .modern-form-input {
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          padding: 10px 14px;
          font-size: 14px;
          color: #1e293b;
          transition: all 0.2s ease;
          background: #f8fafc;
        }
        .modern-form-input:focus {
          border-color: #3e56f0;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(62, 86, 240, 0.12);
          outline: none;
        }
        .modern-primary-btn {
          background: linear-gradient(135deg, #3e56f0 0%, #2b3fc2 100%);
          border: none;
          border-radius: 12px;
          padding: 12px 20px;
          font-weight: 600;
          font-size: 15px;
          color: #ffffff;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(62, 86, 240, 0.25);
        }
        .modern-primary-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(62, 86, 240, 0.35);
          color: #ffffff;
        }
        .modern-secondary-btn {
          background: #f1f5f9;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          padding: 12px 18px;
          font-weight: 600;
          font-size: 15px;
          color: #475569;
          transition: all 0.2s ease;
        }
        .modern-secondary-btn:hover {
          background: #e2e8f0;
          color: #1e293b;
        }
        @media (max-width: 768px) {
          .res-stat-card {
            flex-direction: column;
            text-align: center;
            padding: 12px 6px;
            gap: 6px;
            border-radius: 12px;
          }
          .res-stat-icon-wrap {
            width: 34px;
            height: 34px;
            font-size: 15px;
            border-radius: 10px;
            margin: 0 auto;
          }
          .res-stat-number {
            font-size: 18px;
          }
          .res-stat-label {
            font-size: 10.5px;
            margin-top: 2px;
            line-height: 1.2;
          }
          .res-search-input-wrap {
            max-width: 100%;
          }
          .modern-reservation-body {
            padding: 16px;
          }
          .res-actions-grid {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 8px !important;
            width: 100% !important;
            margin-top: 14px !important;
          }
          .res-actions-grid .res-btn-view {
            grid-column: span 2 !important;
            width: 100% !important;
            justify-content: center !important;
            padding: 10px 14px !important;
            font-size: 13.5px !important;
          }
          .res-actions-grid .res-btn-secondary,
          .res-actions-grid .res-btn-cancel {
            width: 100% !important;
            justify-content: center !important;
            padding: 8px 10px !important;
            font-size: 12px !important;
          }
        }
      `}</style>
      <Header />
      <div className="wrapper">
        <div className="hero-banner pb-5 pt-5">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-xl-8 col-lg-8 col-md-10">
                <div className="hero-banner-content text-center">
                  <h2>My Reservation</h2>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="event-dt-block p-80">
          <div className="container">
            <div className="row">
              {/* Profile Sidebar (Desktop only) */}
              <div className="col-lg-3 d-none d-lg-block">
                <div className="user-profile-sidebar">
                  <div className="user-profile-sidebar-top">
                    <div
                      className="user-profile-img"
                      style={{
                        width: "90px",
                        height: "90px",
                        borderRadius: "50%",
                        overflow: "hidden",
                        margin: "0 auto 12px",
                        border: "3px solid #3e56f0",
                        boxShadow: "0 4px 12px rgba(62, 86, 240, 0.15)"
                      }}
                    >
                      <SafeImage
                        alt="Profile avatar"
                        src={profile?.profilePic || "images/05.jpg"}
                        variant="profile"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                    <h5 className="fw-bold mb-1">{profile?.fullName || "User Profile"}</h5>
                  </div>
                  <ul className="user-profile-sidebar-list">
                    <li>
                      <Link href="/user-profile">
                        <i className="fa fa-user"></i> My Profile
                      </Link>
                    </li>
                    <li>
                      <Link href="/my-events">
                        <i className="fa fa-layer-group"></i> My Events
                      </Link>
                    </li>
                    <li>
                      <Link className="active" href="/my-reservations" style={{ color: "#fff" }}>
                        <i className="fa fa-calendar" style={{ color: "#fff" }}></i> My Reservations
                      </Link>
                    </li>
                    <li>
                      <Link href="/notifications">
                        <i className="fa fa-bell"></i> Notifications
                      </Link>
                    </li>
                    <li>
                      <Link href="#">
                        <i className="fa fa-gear"></i> Settings
                      </Link>
                    </li>
                    <li>
                      <Link href="/login">
                        <i className="fa fa-sign-out"></i> Logout
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Main Content Dashboard */}
              <div className="col-lg-9">
                <div className="user-profile-wrapper">

                  {/* Success Alert Banner */}
                  {successMessage && (
                    <div className="alert alert-success border-0 shadow-sm rounded-3 p-3 mb-4 d-flex align-items-center justify-content-between" role="alert">
                      <div className="d-flex align-items-center gap-2">
                        <i className="bi bi-check-circle-fill text-success fs-5"></i>
                        <span className="small text-dark fw-medium">{successMessage}</span>
                      </div>
                      <button type="button" className="btn-close" onClick={() => setSuccessMessage("")} style={{ position: "relative", top: 0, right: 0 }}></button>
                    </div>
                  )}

                  {/* Dashboard Welcome Header */}
                  <div className="res-dashboard-header">
                    <div>
                      <h2 className="res-dashboard-title">My Reservations</h2>
                      <p className="res-dashboard-sub">View and manage all your event reservations, guests, and passes in one place.</p>
                    </div>
                  </div>

                  {/* Counters Section */}
                  <div className="row g-2 g-md-3 mb-3 mb-md-4">
                    {/* Counter 1: Upcoming */}
                    <div className="col-4 col-md-4">
                      <div className="res-stat-card stat-upcoming">
                        <div className="res-stat-icon-wrap">
                          <i className="bi bi-calendar2-check"></i>
                        </div>
                        <div>
                          <div className="res-stat-number">{String(upcomingCount).padStart(2, "0")}</div>
                          <div className="res-stat-label">Upcoming Reservations</div>
                        </div>
                      </div>
                    </div>

                    {/* Counter 2: Completed */}
                    <div className="col-4 col-md-4">
                      <div className="res-stat-card stat-completed">
                        <div className="res-stat-icon-wrap">
                          <i className="bi bi-check-circle"></i>
                        </div>
                        <div>
                          <div className="res-stat-number">{String(completedCount).padStart(2, "0")}</div>
                          <div className="res-stat-label">Completed Reservations</div>
                        </div>
                      </div>
                    </div>

                    {/* Counter 3: Cancelled */}
                    <div className="col-4 col-md-4">
                      <div className="res-stat-card stat-cancelled">
                        <div className="res-stat-icon-wrap">
                          <i className="bi bi-x-circle"></i>
                        </div>
                        <div>
                          <div className="res-stat-number">{String(cancelledCount).padStart(2, "0")}</div>
                          <div className="res-stat-label">Cancelled Reservations</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Search Section */}
                  <div className="mb-4">
                    <div className="res-search-input-wrap">
                      <span className="res-search-icon">
                        <i className="bi bi-search"></i>
                      </span>
                      <input
                        type="text"
                        className="res-search-input"
                        placeholder="Search reservations by event title, ID, or location..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Reservations Cards Feed */}
                  <div className="reservation-tab-content">
                    {filteredReservations.length > 0 ? (
                      filteredReservations.map((res) => (
                        <div key={res.id} className="modern-reservation-card" data-search={`${res.eventTitle.toLowerCase()} ${res.id.toLowerCase()}`}>
                          <div className="modern-reservation-body">
                            <div className="row align-items-center g-3">
                              {/* Event Image */}
                              <div className="col-lg-auto">
                                <div className="modern-event-thumb">
                                  <SafeImage
                                    src={res.img}
                                    alt={res.eventTitle}
                                    variant="reservation"
                                    fallbackLabel={res.eventTitle}
                                    fallbackSubLabel="Reservation"
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                  />
                                </div>
                              </div>

                              {/* Event Details */}
                              <div className="col-lg">
                                <div className="event-info">
                                  <div className="mb-2">
                                    <span className={`res-status-pill ${res.hasReservation && res.status !== "Cancelled" && res.status !== "Rejected" ? "pill-confirmed" : "pill-cancelled"}`}>
                                      <span className="res-status-dot"></span>
                                      {res.status === "Reservation Confirmed" ? "Confirmed" : res.status}
                                    </span>
                                  </div>
                                  <h5 className="modern-event-title">{res.eventTitle}</h5>
                                  <div className="modern-event-meta-line">
                                    <i className="bi bi-calendar3 text-primary"></i>
                                    <span>{res.eventDate}</span>
                                  </div>
                                  <div className="modern-event-meta-line">
                                    <i className="bi bi-clock text-secondary"></i>
                                    <span>{res.eventStartTime} - {res.eventEndTime}</span>
                                  </div>
                                  <div className="modern-event-meta-line">
                                    <i className="bi bi-geo-alt text-danger"></i>
                                    <span>{res.venue}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Action buttons */}
                              <div className="col-12 col-lg-auto">
                                <div className="res-actions-grid d-flex flex-wrap gap-2">
                                  <button
                                    className="res-btn-view"
                                    onClick={() => handleViewDetails(res)}
                                  >
                                    <i className="bi bi-eye"></i> View
                                  </button>
                                  <button
                                    className="res-btn-secondary"
                                    onClick={() => {
                                      const rawRes = res.rawItem || {};
                                      const mObj = rawRes.merchantId || rawRes.makeReservation?.merchantId;
                                      const mId = (typeof mObj === "object" ? mObj?._id : mObj) || "68c286d5a6251e9e18485481";
                                      const mName = encodeURIComponent(res.eventTitle || "Restaurant");
                                      router.push(`/merchant-chat?eventId=${res.eventId || res.id}&merchantId=${mId}&merchantName=${mName}`);
                                    }}
                                  >
                                    <i className="bi bi-chat-dots"></i> Chat
                                  </button>
                                  {res.hasReservation && (
                                    <>
                                      <button
                                        className="res-btn-secondary"
                                        onClick={() => handleModifyClick(res)}
                                      >
                                        <i className="bi bi-pencil-square"></i> Modify
                                      </button>
                                      <button
                                        className="res-btn-secondary"
                                        onClick={() => handleResend(res)}
                                      >
                                        <i className="bi bi-send"></i> Resend
                                      </button>
                                      <button
                                        className="res-btn-cancel"
                                        onClick={() => handleCancelClick(res)}
                                        disabled={res.status === "Cancelled" || res.status === "Rejected"}
                                      >
                                        <i className="bi bi-x-circle"></i> Cancel
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Reservation Meta & Bottom Strip */}
                          <div className="modern-card-footer">
                            <div className="modern-footer-item">
                              <span className="modern-footer-label">Reservation ID:</span>
                              <span className="res-id-chip">{res.id}</span>
                            </div>
                            <div className="modern-footer-item">
                              <i className="bi bi-people text-muted"></i>
                              <span className="modern-footer-label">Guests:</span>
                              <span className="modern-footer-val">{res.guestsCount}</span>
                            </div>
                            <div className="modern-footer-item">
                              <i className="bi bi-clock-history text-muted"></i>
                              <span className="modern-footer-label">Reserved On:</span>
                              <span className="modern-footer-val">{res.reservedOn}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="empty-state d-block text-center py-5 bg-white rounded-4 border">
                        <i className="bi bi-calendar-x fs-1 text-muted mb-3 d-block"></i>
                        <h5 className="fw-bold text-dark">No reservations found</h5>
                        <p className="text-muted small mb-0">Try adjusting your search criteria.</p>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cancel Reservation Modal */}
      {cancelModal.show && (
        <div className="modal fade show d-block modal-custom-backdrop" style={{ zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered px-3" style={{ maxWidth: "440px" }}>
            <div className="modal-content modern-modal-card overflow-hidden">
              <div className="modal-header border-0 pb-0 pt-4 px-4 d-flex align-items-start justify-content-between">
                <div className="d-flex align-items-center gap-3">
                  <div
                    className="rounded-3 d-flex align-items-center justify-content-center text-white"
                    style={{
                      width: "42px",
                      height: "42px",
                      background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                      boxShadow: "0 4px 10px rgba(239, 68, 68, 0.3)",
                      fontSize: "18px",
                      flexShrink: 0
                    }}
                  >
                    <i className="bi bi-x-circle"></i>
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold text-dark mb-0" style={{ fontSize: "18px", letterSpacing: "-0.2px" }}>
                      Cancel Reservation
                    </h5>
                    <p className="text-muted mb-0" style={{ fontSize: "13px" }}>
                      Please select reason for cancellation
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close shadow-none"
                  style={{ fontSize: "13px", marginTop: "2px" }}
                  onClick={() => setCancelModal({ show: false, id: null, reservationId: null, comment: "", reason: "" })}
                  aria-label="Close"
                ></button>
              </div>

              <div className="modal-body px-4 pt-3 pb-4">
                <form onSubmit={(e) => { e.preventDefault(); confirmCancel(); }}>
                  <div className="mb-3">
                    <label className="form-label text-dark fw-semibold mb-1 ps-1" style={{ fontSize: "13px" }}>
                      Reason for Cancellation <span className="text-danger">*</span>
                    </label>
                    <select
                      className="form-select modern-form-input"
                      value={cancelModal.reason}
                      onChange={(e) => setCancelModal({ ...cancelModal, reason: e.target.value })}
                      required
                    >
                      {cancelReasonsList.length > 0 ? (
                        cancelReasonsList.map((r) => (
                          <option key={r._id} value={r._id}>{r.reason}</option>
                        ))
                      ) : (
                        <option value="">Change of plans</option>
                      )}
                    </select>
                  </div>

                  <div className="mb-4">
                    <label className="form-label text-dark fw-semibold mb-1 ps-1" style={{ fontSize: "13px" }}>
                      Feedback or Comments <span className="text-muted fw-normal">(Optional)</span>
                    </label>
                    <textarea
                      className="form-control modern-form-input"
                      rows="3"
                      value={cancelModal.comment}
                      onChange={(e) => setCancelModal({ ...cancelModal, comment: e.target.value })}
                      placeholder="Let us know how we can improve..."
                      style={{ resize: "none" }}
                    />
                  </div>

                  <div className="d-flex align-items-center gap-2 pt-2">
                    <button
                      type="button"
                      className="modern-secondary-btn flex-fill"
                      onClick={() => setCancelModal({ show: false, id: null, reservationId: null, comment: "", reason: "" })}
                      disabled={resSubmitting}
                    >
                      Keep Reservation
                    </button>
                    <button
                      type="submit"
                      className="btn flex-fill d-flex align-items-center justify-content-center gap-2 text-white fw-bold py-2.5 rounded-3"
                      style={{
                        background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                        boxShadow: "0 4px 12px rgba(239, 68, 68, 0.3)",
                        border: "none",
                        fontSize: "14px"
                      }}
                      disabled={resSubmitting}
                    >
                      {resSubmitting ? (
                        <>
                          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                          <span>Cancelling...</span>
                        </>
                      ) : (
                        <>
                          <i className="bi bi-x-octagon fs-6"></i>
                          <span>Confirm Cancel</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Success Dialog Popup */}
      {cancelSuccessPopup.show && (
        <div className="modal fade show d-block" style={{ background: "rgba(0, 0, 0, 0.45)", zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered px-3" style={{ maxWidth: "340px" }}>
            <div className="modal-content border-0 rounded-4 overflow-hidden shadow-lg p-4 position-relative" style={{ background: "#fff" }}>
              <button
                type="button"
                className="btn p-0 border-0 position-absolute"
                style={{ top: "14px", left: "16px", background: "none", fontSize: "16px", color: "#333" }}
                onClick={() => setCancelSuccessPopup({ show: false, message: "" })}
              >
                <i className="bi bi-x-lg"></i>
              </button>
              <div className="text-center pt-3 pb-2">
                <h5 className="fw-bold text-dark mb-3" style={{ fontSize: "18px" }}>Reservation</h5>
                <p className="text-muted mb-0" style={{ fontSize: "14px", lineHeight: "1.4" }}>
                  {cancelSuccessPopup.message || "Reservation Canceled successfully"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modify Reservation Modal */}
      {modifyModal.show && (
        <div className="modal fade show d-block modal-custom-backdrop" style={{ zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered px-3" style={{ maxWidth: "460px" }}>
            <div className="modal-content modern-modal-card overflow-hidden">
              {/* Header */}
              <div className="modal-header border-0 pb-0 pt-4 px-4 d-flex align-items-start justify-content-between">
                <div className="d-flex align-items-center gap-3">
                  <div
                    className="rounded-3 d-flex align-items-center justify-content-center text-white"
                    style={{
                      width: "42px",
                      height: "42px",
                      background: "linear-gradient(135deg, #3e56f0 0%, #2b3fc2 100%)",
                      boxShadow: "0 4px 10px rgba(62, 86, 240, 0.3)",
                      fontSize: "18px",
                      flexShrink: 0
                    }}
                  >
                    <i className="bi bi-pencil-square"></i>
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold text-dark mb-0" style={{ fontSize: "18px", letterSpacing: "-0.2px" }}>
                      Modify Reservation
                    </h5>
                    <p className="text-muted mb-0" style={{ fontSize: "13px" }}>
                      Update guests and reservation requests
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close shadow-none"
                  style={{ fontSize: "13px", marginTop: "2px" }}
                  onClick={() => setModifyModal({ show: false, id: null, eventId: null, reservationId: null, adultCount: "", childCount: "", instruction: "", couponId: "", guestType: "All" })}
                  aria-label="Close"
                ></button>
              </div>

              {/* Body */}
              <div className="modal-body px-4 pt-3 pb-4">
                {resError && (
                  <div className="alert alert-danger py-2 px-3 rounded-3 mb-3 d-flex align-items-center gap-2" style={{ fontSize: "13px" }}>
                    <i className="bi bi-exclamation-circle-fill"></i>
                    <div>{resError}</div>
                  </div>
                )}

                <form onSubmit={handleModifyReservation}>
                  {/* Guest counters heading */}
                  <div className="text-uppercase fw-bold text-muted mb-2 ps-1" style={{ fontSize: "11px", letterSpacing: "0.6px" }}>
                    Guests Count
                  </div>

                  {/* Adult Guests Stepper */}
                  <div className="guest-counter-box mb-3 d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center gap-3">
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center"
                        style={{ width: "38px", height: "38px", background: "#eef2ff", color: "#3e56f0" }}
                      >
                        <i className="bi bi-person-fill fs-5"></i>
                      </div>
                      <div>
                        <div className="fw-bold text-dark" style={{ fontSize: "14px", lineHeight: "1.2" }}>Adult Guests</div>
                        <div className="text-muted" style={{ fontSize: "12px" }}>Ages 13 and above</div>
                      </div>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <button
                        type="button"
                        className="stepper-btn"
                        onClick={() => handleAdultCountChange(-1)}
                        disabled={parseInt(modifyModal.adultCount || 0, 10) <= 1}
                        aria-label="Decrease adult count"
                      >
                        <i className="bi bi-dash"></i>
                      </button>
                      <input
                        type="number"
                        min="1"
                        className="stepper-input"
                        value={modifyModal.adultCount}
                        onChange={(e) => setModifyModal({ ...modifyModal, adultCount: e.target.value.replace(/\D/g, '') })}
                        required
                      />
                      <button
                        type="button"
                        className="stepper-btn"
                        onClick={() => handleAdultCountChange(1)}
                        aria-label="Increase adult count"
                      >
                        <i className="bi bi-plus"></i>
                      </button>
                    </div>
                  </div>

                  {/* Child Guests Stepper */}
                  <div className="guest-counter-box mb-3 d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center gap-3">
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center"
                        style={{ width: "38px", height: "38px", background: "#fef3c7", color: "#d97706" }}
                      >
                        <i className="bi bi-emoji-smile-fill fs-5"></i>
                      </div>
                      <div>
                        <div className="fw-bold text-dark" style={{ fontSize: "14px", lineHeight: "1.2" }}>Child Guests</div>
                        <div className="text-muted" style={{ fontSize: "12px" }}>Ages 2 to 12</div>
                      </div>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <button
                        type="button"
                        className="stepper-btn"
                        onClick={() => handleChildCountChange(-1)}
                        disabled={parseInt(modifyModal.childCount || 0, 10) <= 0}
                        aria-label="Decrease child count"
                      >
                        <i className="bi bi-dash"></i>
                      </button>
                      <input
                        type="number"
                        min="0"
                        className="stepper-input"
                        value={modifyModal.childCount}
                        onChange={(e) => setModifyModal({ ...modifyModal, childCount: e.target.value.replace(/\D/g, '') })}
                      />
                      <button
                        type="button"
                        className="stepper-btn"
                        onClick={() => handleChildCountChange(1)}
                        aria-label="Increase child count"
                      >
                        <i className="bi bi-plus"></i>
                      </button>
                    </div>
                  </div>

                  {/* Coupon Code Input */}
                  <div className="mb-3">
                    <label className="form-label text-dark fw-semibold mb-1 ps-1" style={{ fontSize: "13px" }}>
                      Coupon Code <span className="text-muted fw-normal">(Optional)</span>
                    </label>
                    <div className="position-relative">
                      <span className="position-absolute top-50 start-0 translate-middle-y ps-3 text-muted" style={{ fontSize: "15px" }}>
                        <i className="bi bi-ticket-perforated"></i>
                      </span>
                      <input
                        type="text"
                        className="form-control modern-form-input ps-5"
                        value={modifyModal.couponId}
                        onChange={(e) => setModifyModal({ ...modifyModal, couponId: e.target.value.toUpperCase() })}
                        placeholder="e.g. EVENTUNA50"
                      />
                    </div>
                  </div>

                  {/* Special Instruction */}
                  <div className="mb-4">
                    <label className="form-label text-dark fw-semibold mb-1 ps-1" style={{ fontSize: "13px" }}>
                      Special Instruction or Request <span className="text-muted fw-normal">(Optional)</span>
                    </label>
                    <textarea
                      className="form-control modern-form-input"
                      rows="3"
                      value={modifyModal.instruction}
                      onChange={(e) => setModifyModal({ ...modifyModal, instruction: e.target.value })}
                      placeholder="e.g. Corner table preferred, anniversary celebration, high chair needed..."
                      style={{ resize: "none" }}
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="d-flex align-items-center gap-2 pt-2">
                    <button
                      type="button"
                      className="modern-secondary-btn flex-fill"
                      onClick={() => setModifyModal({ show: false, id: null, eventId: null, reservationId: null, adultCount: "", childCount: "", instruction: "", couponId: "", guestType: "All" })}
                      disabled={resSubmitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="modern-primary-btn flex-fill d-flex align-items-center justify-content-center gap-2"
                      disabled={resSubmitting}
                    >
                      {resSubmitting ? (
                        <>
                          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                          <span>Updating...</span>
                        </>
                      ) : (
                        <>
                          <i className="bi bi-check2-circle fs-6"></i>
                          <span>Save Changes</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modify Success Dialog Popup */}
      {modifySuccessPopup.show && (
        <div className="modal fade show d-block" style={{ background: "rgba(0, 0, 0, 0.45)", zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered px-3" style={{ maxWidth: "340px" }}>
            <div className="modal-content border-0 rounded-4 overflow-hidden shadow-lg p-4 position-relative" style={{ background: "#fff" }}>
              <button
                type="button"
                className="btn p-0 border-0 position-absolute"
                style={{ top: "14px", left: "16px", background: "none", fontSize: "16px", color: "#333" }}
                onClick={() => setModifySuccessPopup({ show: false, message: "" })}
              >
                <i className="bi bi-x-lg"></i>
              </button>
              <div className="text-center pt-3 pb-2">
                <h5 className="fw-bold text-dark mb-3" style={{ fontSize: "18px" }}>Update</h5>
                <p className="text-muted mb-0" style={{ fontSize: "14px", lineHeight: "1.4" }}>
                  {modifySuccessPopup.message || "Reservation update successfully"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}
