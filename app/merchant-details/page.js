"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { apiRequest } from "../services/apiClient";
import Swal from "sweetalert2";

import { getMerchantsByServiceApi, rateMerchantApi } from "../services/eventApi";

const cleanText = (text, fallback = "") => {
  if (!text || typeof text !== "string") return fallback;
  if (text.includes("APP_DELEGATE") || text.includes("strCatType")) return fallback;
  return text.trim() || fallback;
};

function MerchantDetailsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams.get("eventId") || "";
  const additionalServiceId = searchParams.get("additionalServiceId") || "";
  const merchantId = searchParams.get("id") || searchParams.get("merchantId") || "";

  const [merchant, setMerchant] = useState(null);
  const [copiedCoupon, setCopiedCoupon] = useState(null);

  // ── Booking flow state ──
  const [bookingStep, setBookingStep] = useState(0); // 0=off, 1=select items, 2=cart review, 3=payment
  const [quantities, setQuantities] = useState({});   // { productId: qty }
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingResult, setBookingResult] = useState(null); // API response.booking on success
  const [pageLoading, setPageLoading] = useState(true);

  // ── Merchant Rating state ──
  const [showMerchantRatingModal, setShowMerchantRatingModal] = useState(false);
  const [merchantRatingScore, setMerchantRatingScore] = useState(5);
  const [merchantRatingComment, setMerchantRatingComment] = useState("");
  const [merchantRatingSubmitting, setMerchantRatingSubmitting] = useState(false);

  const handleSubmitMerchantRating = async (e) => {
    if (e) e.preventDefault();
    const mId = merchant?._id || merchant?.id;
    if (!mId) return;
    try {
      setMerchantRatingSubmitting(true);
      const res = await rateMerchantApi({
        merchantId: mId,
        rating: merchantRatingScore,
        comment: merchantRatingComment.trim() || undefined,
      });
      if (res && res.status) {
        setShowMerchantRatingModal(false);
        setMerchantRatingComment("");
        Swal.fire({
          icon: "success",
          title: "Review Submitted!",
          text: "Thank you for rating this merchant partner.",
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
      setMerchantRatingSubmitting(false);
    }
  };

  const handleBack = () => {
    if (bookingStep > 0) { setBookingStep(bookingStep - 1); return; }
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  useEffect(() => {
    const fetchMerchantData = async () => {
      try {
        let foundMerchant = null;

        // 1. Try reading from localStorage first
        const stored = localStorage.getItem("eventuna-latest-merchant");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (!merchantId || parsed._id === merchantId || parsed.id === merchantId) {
            foundMerchant = parsed;
          }
        }

        // 2. If not found in localStorage or if URL parameters exist, fetch real data from API
        if (!foundMerchant && (merchantId || additionalServiceId)) {
          // If merchantId is provided, fetch using merchantId directly to load the exact merchant
          if (merchantId) {
            try {
              const res = await getMerchantsByServiceApi(merchantId);
              if (res && res.status && Array.isArray(res.data)) {
                foundMerchant = res.data.find(m => m._id === merchantId || m.id === merchantId);
              }
            } catch (e) {}
          }
          // If still not found, try with additionalServiceId
          if (!foundMerchant && additionalServiceId) {
            try {
              const res = await getMerchantsByServiceApi(additionalServiceId);
              if (res && res.status && Array.isArray(res.data)) {
                if (merchantId) {
                  foundMerchant = res.data.find(m => m._id === merchantId || m.id === merchantId);
                }
                if (!foundMerchant) {
                  foundMerchant = res.data.find(m => !m.isDeleted) || res.data[0];
                }
              }
            } catch (e) {}
          }
        }

        // 3. Fallback: if still no merchant found (e.g. direct link visited without query params), fetch default restaurant merchant
        if (!foundMerchant) {
          try {
            const res = await getMerchantsByServiceApi("686fb6ced46e9740ee8277ec");
            if (res && res.status && Array.isArray(res.data) && res.data.length > 0) {
              foundMerchant = res.data.find(m => !m.isDeleted) || res.data[0];
            }
          } catch (e) {}
        }

        setMerchant(foundMerchant || null);
      } catch (e) {
        console.error("Failed to parse merchant details:", e);
        setMerchant(null);
      } finally {
        setPageLoading(false);
      }
    };

    fetchMerchantData();
  }, [merchantId, additionalServiceId]);

  // ── Helpers ──
  const handleCopyCoupon = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCoupon(code);
    setTimeout(() => setCopiedCoupon(null), 2000);
  };

  const getProductImage = (photoObj) => {
    if (!photoObj) return "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80";
    if (typeof photoObj === "string") {
      if (photoObj.startsWith("http")) return photoObj;
      return `https://event-una-image-bucket.s3.ap-south-1.amazonaws.com/${photoObj.replace(/^\/+/, "")}`;
    }
    const item = Array.isArray(photoObj) ? photoObj[0] : photoObj;
    if (!item) return "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80";
    if (typeof item === "string") {
      if (item.startsWith("http")) return item;
      return `https://event-una-image-bucket.s3.ap-south-1.amazonaws.com/${item.replace(/^\/+/, "")}`;
    }
    const candidate = item.url || item.fileUrl || item.imageUrl || item.file || item.fileName || item.name;
    if (!candidate) return "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80";
    if (candidate.startsWith("http")) return candidate;
    const clean = candidate.replace(/^\/+/, "");
    const finalPath = clean.startsWith("merchant/") ? clean : `merchant/products/${clean}`;
    return `https://event-una-image-bucket.s3.ap-south-1.amazonaws.com/${finalPath}`;
  };

  // ── Multi-Banner extraction & carousel ──
  const allBanners = useMemo(() => {
    const list = [];
    if (Array.isArray(merchant?.bannerImages) && merchant.bannerImages.length > 0) {
      merchant.bannerImages.forEach(img => {
        if (typeof img === "string" && img.trim()) list.push(img.trim());
        else if (img && typeof img === "object") {
          const u = img.url || img.fileUrl || img.imageUrl || img.file || img.locationPhoto;
          if (u) list.push(u);
        }
      });
    }
    if (merchant?.bannerImage && !list.includes(merchant.bannerImage)) {
      list.push(merchant.bannerImage);
    }
    if (list.length === 0) {
      list.push("https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80");
    }
    return list;
  }, [merchant]);

  const [activeBannerIndex, setActiveBannerIndex] = useState(0);

  // Auto-slide banner carousel every 6 seconds if multiple banners exist
  useEffect(() => {
    if (allBanners.length <= 1) return;
    const interval = setInterval(() => {
      setActiveBannerIndex((prev) => (prev + 1) % allBanners.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [allBanners.length]);

  // ── Quantity helpers ──
  const handleIncrease = (id) => setQuantities(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  const handleDecrease = (id) => setQuantities(prev => ({ ...prev, [id]: Math.max(0, (prev[id] || 0) - 1) }));
  const handleRemove = (id) => setQuantities(prev => { const n = { ...prev }; delete n[id]; return n; });

  const selectedProducts = (merchant?.products || []).filter(p => (quantities[p._id] || 0) > 0);

  // ── Price computation ──
  const subtotal = selectedProducts.reduce((s, p) => s + (p.price * (quantities[p._id] || 0)), 0);
  const discountAmount = appliedCoupon ? (subtotal * parseFloat(appliedCoupon.discount) / 100) : 0;
  const finalAmount = Math.max(0, subtotal - discountAmount);

  // ── Apply coupon ──
  const handleApplyCoupon = () => {
    if (!couponCode.trim()) return;
    const match = (merchant?.couponIds || []).find(c => c.couponName.toLowerCase() === couponCode.trim().toLowerCase());
    if (match) {
      setAppliedCoupon(match);
      Swal.fire({ icon: "success", title: "Coupon Applied!", text: `${match.discount}% discount applied.`, confirmButtonColor: "#3e56f0", timer: 2000, timerProgressBar: true });
    } else {
      Swal.fire({ icon: "error", title: "Invalid Coupon", text: "This coupon code is not valid.", confirmButtonColor: "#3e56f0" });
    }
  };

  // ── Step 1 → Step 2 ──
  const handleAddToOrder = () => {
    if (selectedProducts.length === 0) {
      Swal.fire({ icon: "warning", title: "No Items Selected", text: "Please add at least one item to your order.", confirmButtonColor: "#3e56f0" });
      return;
    }
    setBookingStep(2);
  };

  // ── Step 3: Submit booking ──
  const handleSubmitBooking = async () => {
    setBookingLoading(true);
    try {
      const payload = {
        products: selectedProducts.map(p => ({ productId: p._id, quantity: quantities[p._id] })),
        additionalServiceId,
        finalAmount: Number(finalAmount.toFixed(2)),
        merchantId: merchant._id || merchant.id,
        discountAmount: Number(discountAmount.toFixed(2)),
        eventId,
      };

      if (appliedCoupon?._id) {
        payload.couponId = appliedCoupon._id;
      }

      const defaultLocId = Array.isArray(merchant.serviceLocationIds) && merchant.serviceLocationIds.length > 0
        ? (merchant.serviceLocationIds[0]._id || merchant.serviceLocationIds[0])
        : (merchant.serviceLocationId?._id || merchant.serviceLocationId || null);

      if (defaultLocId) {
        payload.serviceLocationId = defaultLocId;
      }
      const res = await apiRequest("/event/service-booking-request", { method: "POST", body: payload });
      if (res && res.status) {
        setBookingResult(res.booking || null);
        setBookingStep(4);
      } else {
        Swal.fire({ icon: "error", title: "Booking Failed", text: res?.message || "Could not create booking. Please try again.", confirmButtonColor: "#3e56f0" });
      }
    } catch (err) {
      Swal.fire({ icon: "error", title: "Error", text: err.message || "Network error.", confirmButtonColor: "#3e56f0" });
    } finally {
      setBookingLoading(false);
    }
  };

  // ── Finish / close the booking flow ──
  const handleFinishBooking = () => {
    setBookingStep(0);
    setQuantities({});
    setAppliedCoupon(null);
    setCouponCode("");
    setBookingResult(null);
    router.back();
  };

  if (pageLoading) {
    return (
      <>
        <Header />
        <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light">
          <div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div>
        </div>
        <Footer />
      </>
    );
  }

  if (!merchant) {
    return (
      <>
        <Header />
        <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light p-4">
          <div className="text-center p-5 bg-white rounded-4 border shadow-sm" style={{ maxWidth: "460px" }}>
            <div className="rounded-circle bg-light d-inline-flex align-items-center justify-content-center text-muted mb-3" style={{ width: "64px", height: "64px", fontSize: "28px" }}>
              <i className="fa-solid fa-shop-slash"></i>
            </div>
            <h4 className="fw-bold text-dark mb-2">Merchant Not Found</h4>
            <p className="text-muted small mb-4">
              We couldn&apos;t find the requested merchant or venue. It may have been deactivated or removed.
            </p>
            <button
              onClick={() => router.back()}
              className="btn btn-primary rounded-pill px-4 fw-semibold"
              style={{ background: "#3e56f0", border: "none" }}
            >
              <i className="fa-solid fa-arrow-left me-2"></i> Go Back
            </button>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  const primaryLocation = merchant.serviceLocationIds?.[0] || null;
  const serviceLabel = merchant.serviceId?.servicesName || merchant.cuisineName || "Service";

  // Step label helper
  const stepLabels = ["Select Items", "Review Order", "Payment"];

  // Shared stepper component render
  const StepBar = () => (
    <div className="d-flex align-items-center justify-content-center gap-0 mb-5">
      {[1, 2, 3].map((s) => (
        <div key={s} className="d-flex align-items-center">
          <div className="d-flex flex-column align-items-center">
            <div
              style={{
                width: "42px", height: "42px", borderRadius: "50%",
                background: bookingStep >= s ? "linear-gradient(135deg,#3e56f0,#2563eb)" : "#f1f5f9",
                border: bookingStep >= s ? "2.5px solid #3e56f0" : "2px solid #e2e8f0",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: bookingStep >= s ? "#fff" : "#94a3b8",
                fontWeight: 700, fontSize: "15px",
                boxShadow: bookingStep >= s ? "0 4px 14px rgba(62,86,240,0.35)" : "none",
                transition: "all 0.3s ease",
              }}
            >
              {bookingStep > s ? <i className="fa-solid fa-check" style={{ fontSize: "13px" }}></i> : s}
            </div>
            <span style={{ fontSize: "10px", fontWeight: 600, color: bookingStep >= s ? "#3e56f0" : "#94a3b8", marginTop: "5px", whiteSpace: "nowrap" }}>
              {stepLabels[s - 1]}
            </span>
          </div>
          {s < 3 && (
            <div style={{ width: "60px", height: "3px", margin: "0 4px", marginBottom: "16px", background: bookingStep > s ? "linear-gradient(90deg,#3e56f0,#2563eb)" : "#e2e8f0", borderRadius: "2px", transition: "background 0.3s" }}></div>
          )}
        </div>
      ))}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────
  //  BOOKING OVERLAY – Step 1: Select Items
  // ─────────────────────────────────────────────────────────────────
  if (bookingStep === 1) {
    return (
      <>
        <Header />
        <div style={{ background: "#f0f4ff", flexGrow: 1, paddingBottom: "60px" }}>
          {/* Gradient hero top */}
          <div style={{ background: "linear-gradient(135deg,#3e56f0 0%,#2563eb 100%)", padding: "96px 0 64px", marginBottom: "-40px" }}>
            <div className="container" style={{ maxWidth: "680px" }}>
              <div className="d-flex align-items-center gap-3 mb-2">
                <button
                  onClick={() => setBookingStep(0)}
                  style={{ width: "40px", height: "40px", borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.18)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                >
                  <i className="fa-solid fa-arrow-left"></i>
                </button>
                <div>
                  <h4 className="fw-bold text-white m-0" style={{ letterSpacing: "-0.3px" }}>Select Items</h4>
                  <span style={{ color: "rgba(255,255,255,0.72)", fontSize: "13px" }}>Add products to your order</span>
                </div>
              </div>
            </div>
          </div>

          <div className="container" style={{ maxWidth: "680px" }}>
            {/* Step bar on white card */}
            <div style={{ background: "#fff", borderRadius: "20px", padding: "24px", marginBottom: "20px", boxShadow: "0 8px 32px rgba(62,86,240,0.10)" }}>
              <StepBar />
              {/* Merchant info strip */}
              <div className="d-flex align-items-center gap-3 p-3 rounded-3" style={{ background: "#eff6ff", border: "1.5px solid #dbeafe" }}>
                <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "linear-gradient(135deg,#3e56f0,#2563eb)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <i className="fa-solid fa-store text-white" style={{ fontSize: "16px" }}></i>
                </div>
                <div>
                  <div className="fw-bold text-dark" style={{ fontSize: "14px" }}>{merchant.serviceName}</div>
                  <div className="text-muted" style={{ fontSize: "12px" }}>{merchant.cuisineName || "Service Provider"}</div>
                </div>
                <span className="ms-auto badge rounded-pill px-3 py-2" style={{ background: "#e0e7ff", color: "#3e56f0", fontWeight: 700, fontSize: "11px" }}>
                  {(merchant.products || []).length} Products
                </span>
              </div>
            </div>

            {/* Products list */}
            <div className="d-flex flex-column gap-3 mb-4">
              {(!merchant.products || merchant.products.length === 0) && (
                <div className="p-4 text-center bg-white rounded-4 border shadow-sm my-3">
                  <div className="rounded-circle bg-light d-inline-flex align-items-center justify-content-center text-primary mb-3" style={{ width: "64px", height: "64px", fontSize: "28px" }}>
                    <i className="fa-solid fa-utensils"></i>
                  </div>
                  <h5 className="fw-bold text-dark mb-2">No Service Packages Listed</h5>
                  <p className="text-muted small mb-4" style={{ maxWidth: "420px", margin: "0 auto" }}>
                    This merchant does not offer individual catering or decor products for online ordering. For table reservations, please use the Table Reservation flow.
                  </p>
                  {eventId && (
                    <button
                      type="button"
                      onClick={() => router.push('/event-details?id=' + eventId)}
                      className="btn btn-primary rounded-pill px-4 fw-semibold shadow-sm"
                      style={{ background: "linear-gradient(135deg,#3e56f0,#2563eb)", border: "none" }}
                    >
                      <i className="fa-regular fa-calendar-check me-2"></i> Go to Table Reservation
                    </button>
                  )}
                </div>
              )}
              {(merchant.products || []).map(prod => {
                const qty = quantities[prod._id] || 0;
                const isSelected = qty > 0;
                return (
                  <div
                    key={prod._id}
                    style={{
                      background: "#fff", borderRadius: "16px",
                      border: isSelected ? "2px solid #3e56f0" : "1.5px solid #e8eaf0",
                      boxShadow: isSelected ? "0 4px 20px rgba(62,86,240,0.15)" : "0 2px 8px rgba(0,0,0,0.05)",
                      overflow: "hidden", transition: "all 0.2s ease",
                    }}
                  >
                    <div className="d-flex align-items-center gap-0">
                      {/* Product image */}
                      <div style={{ width: "110px", height: "110px", flexShrink: 0, position: "relative" }}>
                        <img
                          src={getProductImage(prod.photo)}
                          alt={prod.name}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          onError={e => { e.target.onerror = null; e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=300&q=80"; }}
                        />
                        {isSelected && (
                          <div style={{ position: "absolute", top: "6px", left: "6px", width: "22px", height: "22px", borderRadius: "50%", background: "#3e56f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <i className="fa-solid fa-check text-white" style={{ fontSize: "10px" }}></i>
                          </div>
                        )}
                      </div>
                      {/* Info */}
                      <div className="flex-grow-1 px-3 py-2" style={{ overflow: "hidden" }}>
                        <h6 className="fw-bold text-dark mb-1" style={{ fontSize: "15px" }}>{prod.name}</h6>
                        <p className="text-muted mb-2" style={{ fontSize: "12px", lineHeight: "1.4", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {prod.description || "Premium quality product."}
                        </p>
                        <span className="fw-bold" style={{ color: "#3e56f0", fontSize: "16px" }}>${prod.price}</span>
                      </div>
                      {/* Stepper */}
                      <div className="d-flex flex-column align-items-center justify-content-center gap-2 pe-3" style={{ flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => handleIncrease(prod._id)}
                          style={{ width: "34px", height: "34px", borderRadius: "50%", border: "none", background: "linear-gradient(135deg,#3e56f0,#2563eb)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 3px 10px rgba(62,86,240,0.35)", transition: "transform 0.1s" }}
                        >
                          <i className="fa-solid fa-plus" style={{ fontSize: "12px" }}></i>
                        </button>
                        <span style={{ fontWeight: 800, fontSize: "18px", color: isSelected ? "#3e56f0" : "#334155", minWidth: "24px", textAlign: "center" }}>{qty}</span>
                        <button
                          type="button"
                          onClick={() => handleDecrease(prod._id)}
                          style={{ width: "34px", height: "34px", borderRadius: "50%", border: "2px solid #e2e8f0", background: "#fff", color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.1s" }}
                        >
                          <i className="fa-solid fa-minus" style={{ fontSize: "12px" }}></i>
                        </button>
                      </div>
                    </div>
                    {isSelected && (
                      <div style={{ background: "linear-gradient(90deg,#3e56f0,#2563eb)", height: "3px" }}></div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Sticky footer */}
            <div style={{ background: "#fff", borderRadius: "20px", padding: "18px 24px", boxShadow: "0 -4px 30px rgba(62,86,240,0.12)", display: "flex", alignItems: "center", justifyContent: "space-between", border: "1.5px solid #dbeafe" }}>
              <div>
                <div className="text-muted" style={{ fontSize: "12px", fontWeight: 600 }}>ORDER TOTAL</div>
                <div style={{ fontWeight: 800, fontSize: "22px", color: selectedProducts.length > 0 ? "#3e56f0" : "#94a3b8" }}>
                  {selectedProducts.length > 0 ? `$${subtotal.toFixed(2)}` : "$0.00"}
                </div>
                <div className="text-muted" style={{ fontSize: "11px" }}>{selectedProducts.length} item{selectedProducts.length !== 1 ? "s" : ""} selected</div>
              </div>
              <button
                type="button"
                onClick={handleAddToOrder}
                style={{ background: selectedProducts.length > 0 ? "linear-gradient(135deg,#3e56f0,#2563eb)" : "#e2e8f0", color: selectedProducts.length > 0 ? "#fff" : "#94a3b8", border: "none", borderRadius: "50px", padding: "14px 28px", fontWeight: 700, fontSize: "14px", cursor: selectedProducts.length > 0 ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: "8px", boxShadow: selectedProducts.length > 0 ? "0 6px 20px rgba(62,86,240,0.35)" : "none", transition: "all 0.2s" }}
              >
                ADD TO ORDER <i className="fa-solid fa-arrow-right"></i>
              </button>
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  //  BOOKING OVERLAY – Step 2: Cart Review
  // ─────────────────────────────────────────────────────────────────
  if (bookingStep === 2) {
    return (
      <>
        <Header />
        <div style={{ background: "#f0f4ff", flexGrow: 1, paddingBottom: "60px" }}>
          {/* Gradient hero top */}
          <div style={{ background: "linear-gradient(135deg,#3e56f0 0%,#2563eb 100%)", padding: "96px 0 64px", marginBottom: "-40px" }}>
            <div className="container" style={{ maxWidth: "680px" }}>
              <div className="d-flex align-items-center gap-3">
                <button
                  onClick={() => setBookingStep(1)}
                  style={{ width: "40px", height: "40px", borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.18)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                >
                  <i className="fa-solid fa-arrow-left"></i>
                </button>
                <div>
                  <h4 className="fw-bold text-white m-0">Review Order</h4>
                  <span style={{ color: "rgba(255,255,255,0.72)", fontSize: "13px" }}>Confirm your selected items</span>
                </div>
              </div>
            </div>
          </div>

          <div className="container" style={{ maxWidth: "680px" }}>
            {/* Step bar */}
            <div style={{ background: "#fff", borderRadius: "20px", padding: "24px", marginBottom: "20px", boxShadow: "0 8px 32px rgba(62,86,240,0.10)" }}>
              <StepBar />
            </div>

            {/* Cart Items */}
            <div style={{ background: "#fff", borderRadius: "20px", padding: "24px", marginBottom: "16px", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
              <div className="d-flex align-items-center justify-content-between mb-4">
                <h5 className="fw-bold text-dark m-0">Your Cart</h5>
                <span className="badge rounded-pill px-3 py-2" style={{ background: "#e0e7ff", color: "#3e56f0", fontWeight: 700 }}>{selectedProducts.length} item{selectedProducts.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="d-flex flex-column gap-3">
                {selectedProducts.map((prod, idx) => (
                  <div key={prod._id}>
                    <div className="d-flex align-items-center gap-3">
                      <div style={{ width: "68px", height: "68px", borderRadius: "14px", overflow: "hidden", flexShrink: 0, boxShadow: "0 3px 10px rgba(0,0,0,0.12)" }}>
                        <img src={getProductImage(prod.photo)} alt={prod.name} style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          onError={e => { e.target.onerror = null; e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=300&q=80"; }}
                        />
                      </div>
                      <div className="flex-grow-1" style={{ overflow: "hidden" }}>
                        <h6 className="fw-bold text-dark mb-1 text-truncate" style={{ fontSize: "15px" }}>{prod.name}</h6>
                        <div className="d-flex align-items-center gap-2">
                          <span style={{ background: "#e0e7ff", color: "#3e56f0", borderRadius: "20px", padding: "2px 10px", fontSize: "12px", fontWeight: 700 }}>x{quantities[prod._id]}</span>
                          <span className="text-muted" style={{ fontSize: "12px" }}>${prod.price} each</span>
                        </div>
                      </div>
                      <div className="text-end" style={{ flexShrink: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: "17px", color: "#3e56f0" }}>${(prod.price * quantities[prod._id]).toFixed(2)}</div>
                        <button
                          type="button"
                          onClick={() => handleRemove(prod._id)}
                          style={{ background: "none", border: "none", color: "#ef4444", fontSize: "12px", fontWeight: 600, cursor: "pointer", padding: "2px 0", display: "flex", alignItems: "center", gap: "4px" }}
                        >
                          <i className="fa-solid fa-trash-can" style={{ fontSize: "11px" }}></i> Remove
                        </button>
                      </div>
                    </div>
                    {idx < selectedProducts.length - 1 && <div style={{ height: "1px", background: "#f1f5f9", margin: "12px 0" }}></div>}
                  </div>
                ))}
              </div>
            </div>

            {/* Subtotal card */}
            <div style={{ background: "#fff", borderRadius: "20px", padding: "20px 24px", marginBottom: "20px", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
              <div className="d-flex justify-content-between align-items-center">
                <span style={{ fontWeight: 600, color: "#64748b", fontSize: "14px" }}>Items Subtotal</span>
                <span style={{ fontWeight: 800, fontSize: "20px", color: "#1e293b" }}>${subtotal.toFixed(2)}</span>
              </div>
              <div className="d-flex justify-content-between align-items-center mt-2">
                <span style={{ fontWeight: 600, color: "#64748b", fontSize: "14px" }}>Delivery Fee</span>
                <span style={{ fontWeight: 700, color: "#22c55e", fontSize: "14px" }}>FREE</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setBookingStep(3)}
              style={{ width: "100%", background: "linear-gradient(135deg,#3e56f0,#2563eb)", color: "#fff", border: "none", borderRadius: "50px", padding: "16px", fontWeight: 700, fontSize: "16px", cursor: "pointer", boxShadow: "0 8px 24px rgba(62,86,240,0.35)", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", letterSpacing: "0.3px" }}
            >
              PROCEED TO PAYMENT <i className="fa-solid fa-arrow-right"></i>
            </button>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  //  BOOKING OVERLAY – Step 3: Payment Summary
  // ─────────────────────────────────────────────────────────────────
  if (bookingStep === 3) {
    return (
      <>
        <Header />
        <div style={{ background: "#f0f4ff", flexGrow: 1, paddingBottom: "60px" }}>
          {/* Gradient hero top */}
          <div style={{ background: "linear-gradient(135deg,#3e56f0 0%,#2563eb 100%)", padding: "96px 0 64px", marginBottom: "-40px" }}>
            <div className="container" style={{ maxWidth: "680px" }}>
              <div className="d-flex align-items-center gap-3">
                <button
                  onClick={() => setBookingStep(2)}
                  style={{ width: "40px", height: "40px", borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.18)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                >
                  <i className="fa-solid fa-arrow-left"></i>
                </button>
                <div>
                  <h4 className="fw-bold text-white m-0">Payment Summary</h4>
                  <span style={{ color: "rgba(255,255,255,0.72)", fontSize: "13px" }}>Review and confirm your booking</span>
                </div>
              </div>
            </div>
          </div>

          <div className="container" style={{ maxWidth: "680px" }}>
            {/* Step bar */}
            <div style={{ background: "#fff", borderRadius: "20px", padding: "24px", marginBottom: "20px", boxShadow: "0 8px 32px rgba(62,86,240,0.10)" }}>
              <StepBar />
              {/* Booking info strip */}
              <div className="d-flex align-items-center justify-content-between p-3 rounded-3" style={{ background: "#eff6ff", border: "1.5px solid #dbeafe" }}>
                <div className="d-flex align-items-center gap-3">
                  <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "linear-gradient(135deg,#3e56f0,#2563eb)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <i className="fa-solid fa-store text-white" style={{ fontSize: "14px" }}></i>
                  </div>
                  <div>
                    <div className="fw-bold text-dark" style={{ fontSize: "14px" }}>{merchant.serviceName}</div>
                    <div className="text-muted" style={{ fontSize: "11px" }}>Service Booking Request</div>
                  </div>
                </div>
                <span style={{ background: "#fef3c7", color: "#d97706", borderRadius: "20px", padding: "5px 14px", fontSize: "12px", fontWeight: 700 }}>⏳ Pending</span>
              </div>
            </div>

            {/* Coupon section */}
            <div style={{ background: "#fff", borderRadius: "20px", padding: "24px", marginBottom: "16px", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
              <div className="d-flex align-items-center gap-2 mb-3">
                <div style={{ width: "34px", height: "34px", borderRadius: "10px", background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <i className="fa-solid fa-tag" style={{ color: "#d97706", fontSize: "14px" }}></i>
                </div>
                <h6 className="fw-bold text-dark m-0">Apply Coupon Code</h6>
              </div>
              {appliedCoupon ? (
                <div className="d-flex align-items-center justify-content-between p-3 rounded-3" style={{ background: "#f0fdf4", border: "2px solid #22c55e" }}>
                  <div className="d-flex align-items-center gap-2">
                    <i className="fa-solid fa-circle-check text-success" style={{ fontSize: "18px" }}></i>
                    <div>
                      <div className="fw-bold text-success" style={{ fontSize: "14px" }}>{appliedCoupon.couponName}</div>
                      <div style={{ fontSize: "12px", color: "#16a34a" }}>{appliedCoupon.discount}% discount applied successfully</div>
                    </div>
                  </div>
                  <button type="button" onClick={() => { setAppliedCoupon(null); setCouponCode(""); }} style={{ background: "none", border: "none", color: "#ef4444", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>Remove</button>
                </div>
              ) : (
                <div className="d-flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={e => setCouponCode(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleApplyCoupon()}
                    placeholder="Enter coupon code (e.g. 50%OFF)"
                    style={{ flex: 1, border: "2px solid #e2e8f0", borderRadius: "50px", padding: "10px 18px", fontSize: "14px", outline: "none", fontWeight: 500 }}
                  />
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    style={{ background: "linear-gradient(135deg,#3e56f0,#2563eb)", color: "#fff", border: "none", borderRadius: "50px", padding: "10px 22px", fontWeight: 700, fontSize: "14px", cursor: "pointer", flexShrink: 0, boxShadow: "0 4px 12px rgba(62,86,240,0.3)" }}
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>

            {/* Order summary */}
            <div style={{ background: "#fff", borderRadius: "20px", padding: "24px", marginBottom: "20px", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
              <h6 className="fw-bold text-dark mb-4" style={{ fontSize: "16px" }}>Order Summary</h6>
              {selectedProducts.map((p, idx) => (
                <div key={p._id}>
                  <div className="d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center gap-2">
                      <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#3e56f0", flexShrink: 0 }}></div>
                      <span style={{ fontSize: "14px", color: "#475569" }}>{p.name}</span>
                      <span style={{ background: "#f1f5f9", color: "#64748b", borderRadius: "20px", padding: "1px 8px", fontSize: "11px", fontWeight: 700 }}>×{quantities[p._id]}</span>
                    </div>
                    <span style={{ fontWeight: 700, color: "#1e293b", fontSize: "14px" }}>${(p.price * quantities[p._id]).toFixed(2)}</span>
                  </div>
                  {idx < selectedProducts.length - 1 && <div style={{ height: "1px", background: "#f1f5f9", margin: "10px 0" }}></div>}
                </div>
              ))}
              <div style={{ height: "1px", background: "#e2e8f0", margin: "16px 0" }}></div>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span style={{ color: "#64748b", fontSize: "14px" }}>Items Total</span>
                <span style={{ fontWeight: 600, color: "#1e293b", fontSize: "14px" }}>${subtotal.toFixed(2)}</span>
              </div>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span style={{ color: "#64748b", fontSize: "14px" }}>Delivery Fee</span>
                <span style={{ fontWeight: 700, color: "#22c55e", fontSize: "14px" }}>FREE</span>
              </div>
              {appliedCoupon && (
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span style={{ color: "#16a34a", fontSize: "14px" }}>Coupon ({appliedCoupon.couponName})</span>
                  <span style={{ fontWeight: 700, color: "#16a34a", fontSize: "14px" }}>-${discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div style={{ height: "2px", background: "linear-gradient(90deg,#3e56f0,#2563eb)", margin: "16px 0", borderRadius: "2px" }}></div>
              <div className="d-flex justify-content-between align-items-center">
                <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "16px" }}>Total Payable</span>
                <span style={{ fontWeight: 800, color: "#3e56f0", fontSize: "24px" }}>${finalAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* Confirm button */}
            <button
              type="button"
              onClick={handleSubmitBooking}
              disabled={bookingLoading}
              style={{ width: "100%", background: bookingLoading ? "#e2e8f0" : "linear-gradient(135deg,#3e56f0,#2563eb)", color: bookingLoading ? "#94a3b8" : "#fff", border: "none", borderRadius: "50px", padding: "18px", fontWeight: 700, fontSize: "16px", cursor: bookingLoading ? "not-allowed" : "pointer", boxShadow: bookingLoading ? "none" : "0 8px 24px rgba(62,86,240,0.35)", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", letterSpacing: "0.5px", transition: "all 0.2s" }}
            >
              {bookingLoading ? (
                <><span className="spinner-border spinner-border-sm" role="status"></span> Processing Booking...</>
              ) : (
                <><i className="fa-solid fa-circle-check"></i> PROCEED</>
              )}
            </button>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  //  BOOKING OVERLAY – Step 4: Booking Confirmation (Payment Summary)
  // ─────────────────────────────────────────────────────────────────
  if (bookingStep === 4) {
    const orderNo = bookingResult?._id ? bookingResult._id.slice(-6).toUpperCase() : "—";
    const bookingStatus = bookingResult?.status || "requested";
    return (
      <>
        <Header />
        <div style={{ background: "#f0f4ff", flexGrow: 1, paddingBottom: "60px" }}>
          {/* Gradient hero top */}
          <div style={{ background: "linear-gradient(135deg,#3e56f0 0%,#2563eb 100%)", padding: "96px 0 64px", marginBottom: "-40px" }}>
            <div className="container" style={{ maxWidth: "680px" }}>
              <div className="d-flex align-items-center gap-3">
                <button
                  onClick={handleFinishBooking}
                  style={{ width: "40px", height: "40px", borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.18)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                >
                  <i className="fa-solid fa-arrow-left"></i>
                </button>
                <div>
                  <h4 className="fw-bold text-white m-0">Payment Summary</h4>
                  <span style={{ color: "rgba(255,255,255,0.72)", fontSize: "13px" }}>Your booking request is confirmed</span>
                </div>
              </div>
            </div>
          </div>

          <div className="container" style={{ maxWidth: "680px" }}>
            {/* Success banner */}
            <div style={{ background: "#fff", borderRadius: "20px", padding: "28px 24px", marginBottom: "16px", boxShadow: "0 8px 32px rgba(62,86,240,0.10)", textAlign: "center" }}>
              <div style={{ width: "72px", height: "72px", borderRadius: "50%", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <i className="fa-solid fa-circle-check" style={{ color: "#22c55e", fontSize: "36px" }}></i>
              </div>
              <h5 className="fw-bold text-dark mb-1">Booking Request Created!</h5>
              <p className="text-muted m-0" style={{ fontSize: "13px" }}>The merchant will review and confirm your request shortly.</p>
            </div>

            {/* Order info card */}
            <div style={{ background: "#fff", borderRadius: "20px", padding: "24px", marginBottom: "16px", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <div className="d-flex align-items-center gap-2">
                  <div style={{ width: "4px", height: "22px", borderRadius: "4px", background: "linear-gradient(180deg,#3e56f0,#2563eb)" }}></div>
                  <span className="fw-bold text-dark" style={{ fontSize: "15px" }}>Order No : {orderNo}</span>
                </div>
                <span style={{ background: "#fee2e2", color: "#dc2626", borderRadius: "8px", padding: "5px 14px", fontSize: "12px", fontWeight: 700, textTransform: "capitalize" }}>
                  {bookingStatus === "requested" ? "Pending" : bookingStatus}
                </span>
              </div>
              <div className="d-flex align-items-center gap-2">
                <div style={{ width: "4px", height: "22px", borderRadius: "4px", background: "linear-gradient(180deg,#3e56f0,#2563eb)" }}></div>
                <span className="fw-bold text-dark" style={{ fontSize: "15px" }}>Order For : {serviceLabel}</span>
              </div>
            </div>

            {/* Order summary table */}
            <div style={{ background: "#fff", borderRadius: "20px", padding: "24px", marginBottom: "20px", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
              <div className="d-flex align-items-center gap-2 mb-3">
                <div style={{ width: "4px", height: "22px", borderRadius: "4px", background: "linear-gradient(180deg,#3e56f0,#2563eb)" }}></div>
                <h6 className="fw-bold text-dark m-0">Order Summary</h6>
              </div>
              <div className="border rounded-3 overflow-hidden">
                <div className="d-flex justify-content-between align-items-center px-3 py-2 border-bottom" style={{ fontSize: "14px" }}>
                  <span className="text-muted">Items Total</span>
                  <span className="fw-semibold text-dark">${subtotal.toFixed(2)}</span>
                </div>
                <div className="d-flex justify-content-between align-items-center px-3 py-2 border-bottom" style={{ fontSize: "14px" }}>
                  <span className="text-muted">Delivery Fee</span>
                  <span className="fw-semibold text-dark">$0.0</span>
                </div>
                <div className="d-flex justify-content-between align-items-center px-3 py-2 border-bottom" style={{ fontSize: "14px" }}>
                  <span className="text-muted">Coupon discount</span>
                  <span className="fw-semibold text-dark">${discountAmount.toFixed(2)}</span>
                </div>
                <div className="d-flex justify-content-between align-items-center px-3 py-2" style={{ fontSize: "14px", background: "#eff6ff" }}>
                  <span className="fw-bold text-dark">Paid Amount</span>
                  <span className="fw-bold" style={{ color: "#3e56f0" }}>${Number(bookingResult && bookingResult.finalAmount !== undefined ? bookingResult.finalAmount : finalAmount).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Done button */}
            <button
              type="button"
              onClick={handleFinishBooking}
              style={{ width: "100%", background: "linear-gradient(135deg,#3e56f0,#2563eb)", color: "#fff", border: "none", borderRadius: "50px", padding: "16px", fontWeight: 700, fontSize: "16px", cursor: "pointer", boxShadow: "0 8px 24px rgba(62,86,240,0.35)", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", letterSpacing: "0.3px" }}
            >
              <i className="fa-solid fa-check"></i> DONE
            </button>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  //  DEFAULT VIEW – Merchant Details Page
  // ─────────────────────────────────────────────────────────────────
  return (
    <>
      <Header />
      <div className="wrapper">
        {/* Hero Banner with Multi-Image Carousel */}
        <div
          className="merchant-hero-banner"
          style={{
            position: "relative",
            minHeight: "360px",
            color: "#fff",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "24px 0 36px",
            borderRadius: 0,
            marginBottom: 0,
            overflow: "hidden"
          }}
        >
          {/* Background slides */}
          {allBanners.map((imgUrl, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.72) 100%), url('${imgUrl}')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                opacity: i === activeBannerIndex ? 1 : 0,
                transition: "opacity 0.8s ease-in-out",
                zIndex: 0
              }}
            />
          ))}

          {/* Top navigation inside banner */}
          <div className="container" style={{ position: "relative", zIndex: 1 }}>
            <div className="d-flex justify-content-between align-items-center">
              <button
                onClick={() => router.back()}
                className="btn rounded-pill px-3 py-1.5 fw-semibold d-inline-flex align-items-center gap-2 shadow-sm text-white"
                style={{
                  background: "rgba(0, 0, 0, 0.45)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid rgba(255, 255, 255, 0.3)",
                  fontSize: "13px",
                  transition: "all 0.2s"
                }}
              >
                <i className="fa-solid fa-arrow-left"></i> Back
              </button>

              {allBanners.length > 1 && (
                <div
                  className="d-flex align-items-center gap-2 px-3 py-1.5 rounded-pill shadow-sm"
                  style={{
                    background: "rgba(0, 0, 0, 0.55)",
                    backdropFilter: "blur(8px)",
                    border: "1px solid rgba(255, 255, 255, 0.25)",
                    fontSize: "12px",
                    fontWeight: "600",
                    letterSpacing: "0.5px"
                  }}
                >
                  <i className="fa-solid fa-camera"></i>
                  <span>{activeBannerIndex + 1} / {allBanners.length}</span>
                </div>
              )}
            </div>
          </div>

          {/* Carousel Prev / Next Controls */}
          {allBanners.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveBannerIndex((prev) => (prev - 1 + allBanners.length) % allBanners.length);
                }}
                className="btn text-white position-absolute d-flex align-items-center justify-content-center"
                style={{
                  top: "50%",
                  left: "20px",
                  transform: "translateY(-50%)",
                  width: "42px",
                  height: "42px",
                  borderRadius: "50%",
                  background: "rgba(0, 0, 0, 0.45)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid rgba(255, 255, 255, 0.3)",
                  zIndex: 2,
                  transition: "all 0.2s"
                }}
                aria-label="Previous banner"
              >
                <i className="fa-solid fa-chevron-left"></i>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveBannerIndex((prev) => (prev + 1) % allBanners.length);
                }}
                className="btn text-white position-absolute d-flex align-items-center justify-content-center"
                style={{
                  top: "50%",
                  right: "20px",
                  transform: "translateY(-50%)",
                  width: "42px",
                  height: "42px",
                  borderRadius: "50%",
                  background: "rgba(0, 0, 0, 0.45)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid rgba(255, 255, 255, 0.3)",
                  zIndex: 2,
                  transition: "all 0.2s"
                }}
                aria-label="Next banner"
              >
                <i className="fa-solid fa-chevron-right"></i>
              </button>
            </>
          )}

          {/* Banner Details at bottom */}
          <div className="container" style={{ position: "relative", zIndex: 1 }}>
            <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
              <span className="badge bg-primary px-3 py-2 rounded-pill fw-bold" style={{ fontSize: "12px" }}>
                {merchant.serviceId?.servicesName || "Merchant Partner"}
              </span>
              {merchant.isVerified && (
                <span className="badge bg-success px-3 py-2 rounded-pill fw-bold d-flex align-items-center gap-1" style={{ fontSize: "12px" }}>
                  <i className="fa-solid fa-circle-check"></i> Verified
                </span>
              )}
            </div>
            <h1 className="fw-bold m-0" style={{ fontSize: "clamp(22px, 5vw, 36px)", textShadow: "0 2px 8px rgba(0,0,0,0.5)", letterSpacing: "-0.4px" }}>
              {cleanText(merchant.serviceName, "Merchant Partner")}
            </h1>
            {merchant.serviceSlogan && cleanText(merchant.serviceSlogan) && (
              <p className="lead m-0 mt-1 opacity-90 fw-medium" style={{ fontSize: "16px", textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>
                {cleanText(merchant.serviceSlogan)}
              </p>
            )}

            {/* Dots navigation if multiple banners */}
            {allBanners.length > 1 && (
              <div className="d-flex gap-2 mt-3 align-items-center">
                {allBanners.map((_, dotIdx) => (
                  <button
                    key={dotIdx}
                    type="button"
                    onClick={() => setActiveBannerIndex(dotIdx)}
                    style={{
                      width: dotIdx === activeBannerIndex ? "24px" : "8px",
                      height: "8px",
                      borderRadius: "4px",
                      background: dotIdx === activeBannerIndex ? "#ffffff" : "rgba(255, 255, 255, 0.45)",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      transition: "all 0.3s ease"
                    }}
                    aria-label={`Go to banner ${dotIdx + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Details body */}
        <div className="event-dt-block p-80 bg-light" style={{ paddingTop: "36px" }}>
          <div className="container">
            <div className="row g-4">
              {/* Left column */}
              <div className="col-lg-8">
                {/* About */}
                <div className="cardx p-4 mb-4">
                  <h4 className="fw-bold text-dark mb-3">About</h4>
                  <p className="text-muted mb-0" style={{ fontSize: "15px", lineHeight: "1.7", whiteSpace: "pre-line" }}>
                    {cleanText(
                      merchant.serviceDescription,
                      "Welcome to our premier event venue & catering experience. We offer exquisite dining, curated ambiances, and exceptional service tailored for your celebrations."
                    )}
                  </p>
                </div>

                {/* Location & Schedule */}
                {primaryLocation && (
                  <div className="cardx p-4 mb-4">
                    <h4 className="fw-bold text-dark mb-3">Location & Operating Schedule</h4>
                    <div className="d-flex align-items-start gap-2 mb-3 text-muted">
                      <i className="fa-solid fa-location-dot text-primary fs-5"></i>
                      <div>
                        <h6 className="fw-bold text-dark m-0">{primaryLocation.addressName || "Main Office"}</h6>
                        <span className="small">{primaryLocation.address}</span>
                      </div>
                    </div>
                    {primaryLocation.weeklySchedule?.length > 0 && (
                      <div className="border rounded-3 overflow-hidden mt-3">
                        <table className="table table-borderless m-0 text-center" style={{ fontSize: "14px" }}>
                          <thead className="bg-light">
                            <tr className="border-bottom">
                              <th className="text-start ps-4 py-2">Day</th>
                              <th className="py-2">Morning</th>
                              <th className="py-2">Evening</th>
                            </tr>
                          </thead>
                          <tbody>
                            {primaryLocation.weeklySchedule.map((s, i) => {
                              const mc = s.morning?.from === "00:00" && s.morning?.to === "00:00";
                              const ec = s.evening?.from === "00:00" && s.evening?.to === "00:00";
                              return (
                                <tr key={i} className="border-bottom align-middle">
                                  <td className="text-start ps-4 py-2 fw-medium text-dark">{s.day}</td>
                                  <td className="py-2">{mc ? <span className="badge bg-danger bg-opacity-10 text-danger rounded-pill px-2">Closed</span> : <strong className="text-dark small">{s.morning.from} - {s.morning.to}</strong>}</td>
                                  <td className="py-2">{ec ? <span className="badge bg-danger bg-opacity-10 text-danger rounded-pill px-2">Closed</span> : <strong className="text-dark small">{s.evening.from} - {s.evening.to}</strong>}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Menu / Products */}
                {merchant.products?.length > 0 && (
                  <div className="cardx p-4 mb-4">
                    <h4 className="fw-bold text-dark mb-4">Menu</h4>
                    <div className="row g-3">
                      {merchant.products.map(prod => (
                        <div key={prod._id} className="col-12 col-sm-6">
                          <div className="border rounded-3 p-3 h-100 bg-white shadow-sm d-flex flex-column justify-content-between">
                            <div>
                              <div className="rounded-2 overflow-hidden mb-3" style={{ height: "160px" }}>
                                <img src={getProductImage(prod.photo)} alt={prod.name} className="w-100 h-100" style={{ objectFit: "cover" }} />
                              </div>
                              <h5 className="fw-bold text-dark mb-1">{prod.name}</h5>
                              <p className="text-muted small mb-3" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                                {prod.description}
                              </p>
                            </div>
                            <div className="border-top pt-2 d-flex justify-content-between align-items-center">
                              <span className="small text-muted">Price</span>
                              <span className="fw-bold text-primary fs-5">${prod.price}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right column – Sidebar */}
              <div className="col-lg-4">
                <div className="cardx p-4 mb-4">
                  <h5 className="fw-bold text-dark mb-3">Merchant details</h5>
                  <ul className="list-unstyled m-0 d-flex flex-column gap-3" style={{ fontSize: "14px" }}>
                    <li className="d-flex justify-content-between align-items-center pb-2 border-bottom">
                      <span className="text-muted">Cuisine / Category</span>
                      <strong className="text-dark text-truncate" style={{ maxWidth: "160px" }}>{cleanText(merchant.cuisineName, "Multi-Cuisine")}</strong>
                    </li>
                    <li className="d-flex justify-content-between align-items-center pb-2 border-bottom">
                      <span className="text-muted">Max Capacity</span>
                      <strong className="text-dark">{primaryLocation?.capacity ? `${primaryLocation.capacity} guests` : "N/A"}</strong>
                    </li>
                    <li className="d-flex justify-content-between align-items-center pb-2 border-bottom">
                      <span className="text-muted">Online Booking</span>
                      <strong className="text-dark">
                        {merchant.onlineReservation ? <span className="text-success"><i className="fa-solid fa-circle-check me-1"></i>Available</span> : <span className="text-muted">Not Supported</span>}
                      </strong>
                    </li>
                    <li className="d-flex justify-content-between align-items-center pb-2 border-bottom">
                      <span className="text-muted">Phone</span>
                      <a href={`tel:${merchant.phone || merchant.mobile}`} className="text-primary text-decoration-none fw-medium">{merchant.phone || merchant.mobile || "N/A"}</a>
                    </li>
                    <li className="d-flex justify-content-between align-items-center pb-2 border-bottom">
                      <span className="text-muted">Email</span>
                      <a href={`mailto:${merchant.email}`} className="text-primary text-decoration-none fw-medium text-truncate" style={{ maxWidth: "180px" }}>{merchant.email}</a>
                    </li>
                    {merchant.webUrl && (
                      <li className="d-flex justify-content-between align-items-center">
                        <span className="text-muted">Website</span>
                        <a href={merchant.webUrl} target="_blank" rel="noopener noreferrer" className="text-primary text-decoration-none fw-medium text-truncate" style={{ maxWidth: "180px" }}>
                          Visit site <i className="fa-solid fa-arrow-up-right-from-square small ms-1"></i>
                        </a>
                      </li>
                    )}
                  </ul>

                  {/* Merchant Rating & Review Trigger */}
                  <div className="mt-4 pt-3 border-top">
                    <button
                      type="button"
                      onClick={() => setShowMerchantRatingModal(true)}
                      className="btn btn-outline-warning w-100 rounded-pill py-2.5 fw-bold text-dark d-flex align-items-center justify-content-center gap-2 shadow-xs"
                    >
                      <i className="fa-solid fa-star text-warning"></i> Write a Review
                    </button>
                  </div>

                  {/* BOOK SERVICE – launches 3-step flow */}
                  {eventId && additionalServiceId && (
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => { setQuantities({}); setBookingStep(1); }}
                        className="btn w-100 rounded-pill py-3 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2"
                        style={{ background: "linear-gradient(135deg,#3e56f0,#2563eb)", border: "none", color: "#fff", fontSize: "15px" }}
                      >
                        <i className="fa-regular fa-calendar-check"></i> BOOK SERVICE
                      </button>
                    </div>
                  )}

                  {/* Contact Merchant Button (Matching screenshot design) */}
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => {
                        const mId = merchant.merchant?._id || merchant.merchant?.id || merchant.merchantId?._id || merchant.merchantId || merchant._id || merchant.id || "";
                        const mName = encodeURIComponent(merchant.serviceName || merchant.fullName || "Merchant");
                        const targetUrl = `/merchant-chat?${eventId ? `eventId=${eventId}&` : ""}merchantId=${mId}&merchantName=${mName}`;
                        router.push(targetUrl);
                      }}
                      className="btn w-100 rounded-pill py-2.5 fw-semibold d-flex align-items-center justify-content-center gap-2"
                      style={{ border: "1.5px solid #475569", color: "#334155", background: "#ffffff", fontSize: "15px" }}
                    >
                      <i className="fa-regular fa-comment-dots text-primary"></i> Contact Merchant
                    </button>
                  </div>
                </div>

                {/* Coupons */}
                {merchant.couponIds?.length > 0 && (
                  <div className="cardx p-4 mb-4">
                    <h5 className="fw-bold text-dark mb-3">Available Coupon Code</h5>
                    <div className="d-flex flex-column gap-3">
                      {merchant.couponIds.map(coupon => (
                        <div key={coupon._id} className="border border-danger border-dashed rounded-3 p-3 bg-danger-subtle text-danger">
                          <div className="d-flex justify-content-between align-items-start mb-1">
                            <span className="fw-bold fs-5">{coupon.couponName}</span>
                            <span className="badge bg-danger text-white">{coupon.discount}% OFF</span>
                          </div>
                          <p className="small mb-3 text-muted" style={{ lineHeight: "1.4" }}>{coupon.description}</p>
                          <div className="d-flex justify-content-between align-items-center border-top border-danger pt-2 mt-1">
                            <span className="small text-muted" style={{ fontSize: "11px" }}>Expires: {coupon.validTo}</span>
                            <button className="btn btn-danger btn-sm px-3 rounded-pill fw-bold" style={{ fontSize: "11px" }} onClick={() => handleCopyCoupon(coupon.couponName)}>
                              {copiedCoupon === coupon.couponName ? "Copied!" : "Copy"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Merchant Rating Modal */}
      {showMerchantRatingModal && (
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
                  <h5 className="modal-title fw-bold mb-1">Rate Merchant Partner</h5>
                  <p className="small mb-0 text-white-50">
                    Share your experience with {merchant?.serviceName || "this merchant"}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowMerchantRatingModal(false)}
                  disabled={merchantRatingSubmitting}
                ></button>
              </div>

              <form onSubmit={handleSubmitMerchantRating}>
                <div className="modal-body p-4 bg-light">
                  {/* Star Rating Selector */}
                  <div className="text-center mb-4 bg-white p-3 rounded-3 border">
                    <label className="form-label fw-bold text-dark d-block mb-2">
                      Star Rating
                    </label>
                    <div className="d-flex justify-content-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          className="btn btn-link p-1 text-decoration-none border-0"
                          onClick={() => setMerchantRatingScore(star)}
                          style={{ fontSize: "28px", color: star <= merchantRatingScore ? "#f59e0b" : "#cbd5e1" }}
                        >
                          <i className="fa-solid fa-star"></i>
                        </button>
                      ))}
                    </div>
                    <span className="small text-muted fw-semibold">
                      {merchantRatingScore === 5 ? "⭐⭐⭐⭐⭐ Outstanding" :
                       merchantRatingScore === 4 ? "⭐⭐⭐⭐ Very Good" :
                       merchantRatingScore === 3 ? "⭐⭐⭐ Good" :
                       merchantRatingScore === 2 ? "⭐⭐ Needs Improvement" : "⭐ Poor"}
                    </span>
                  </div>

                  {/* Comment Textarea */}
                  <div className="mb-2">
                    <label className="form-label fw-semibold text-dark small mb-1">
                      Your Review / Experience (Optional)
                    </label>
                    <textarea
                      className="form-control rounded-3 py-2 px-3 border shadow-none"
                      rows="3"
                      placeholder="Write your review about food quality, ambiance, or service..."
                      value={merchantRatingComment}
                      onChange={(e) => setMerchantRatingComment(e.target.value)}
                    ></textarea>
                  </div>
                </div>

                <div className="modal-footer border-top py-3 px-4 bg-white d-flex justify-content-end gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary rounded-pill px-4 fw-semibold"
                    onClick={() => setShowMerchantRatingModal(false)}
                    disabled={merchantRatingSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-warning rounded-pill px-4 fw-bold text-dark shadow-sm"
                    disabled={merchantRatingSubmitting}
                  >
                    {merchantRatingSubmitting ? (
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

      <Footer />
    </>
  );
}

export default function MerchantDetailsPage() {
  return (
    <Suspense fallback={
      <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light">
        <div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div>
      </div>
    }>
      <MerchantDetailsContent />
    </Suspense>
  );
}
