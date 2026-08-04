"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { getMerchantsByServiceApi } from "../services/eventApi";

function MerchantsByServiceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const serviceId = searchParams.get("serviceId");
  const serviceName = searchParams.get("serviceName") || "Service Providers";
  const eventId = searchParams.get("eventId") || "";

  const [merchants, setMerchants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!serviceId) {
      setErrorMsg("No Service ID provided.");
      setLoading(false);
      return;
    }

    const fetchMerchants = async () => {
      try {
        setLoading(true);
        setErrorMsg("");
        const res = await getMerchantsByServiceApi(serviceId);
        if (res && res.status && Array.isArray(res.data)) {
          // Filter out deleted merchants or those with incomplete applications if needed
          const activeMerchants = res.data.filter(m => !m.isDeleted);
          setMerchants(activeMerchants);
        } else {
          setErrorMsg(res?.message || "Failed to load merchants.");
        }
      } catch (err) {
        console.error("Error fetching merchants:", err);
        setErrorMsg("Failed to load merchants due to network error.");
      } finally {
        setLoading(false);
      }
    };

    fetchMerchants();
  }, [serviceId]);

  const handleSelectMerchant = (merchant) => {
    try {
      localStorage.setItem("eventuna-latest-merchant", JSON.stringify(merchant));
      const url = eventId 
        ? `/merchant-details?eventId=${eventId}&additionalServiceId=${serviceId}`
        : "/merchant-details";
      router.push(url);
    } catch (e) {
      console.error("Error storing merchant details:", e);
    }
  };

  // Filter merchants based on search query
  const filteredMerchants = merchants.filter((m) => {
    const term = searchQuery.toLowerCase();
    const name = (m.serviceName || m.fullName || "").toLowerCase();
    const cuisine = (m.cuisineName || "").toLowerCase();
    const desc = (m.serviceDescription || "").toLowerCase();
    const address = (m.serviceLocationIds || []).map(loc => loc.address || "").join(" ").toLowerCase();
    return name.includes(term) || cuisine.includes(term) || desc.includes(term) || address.includes(term);
  });

  return (
    <>
      <Header />
      <div className="wrapper">
        <div className="bg-light py-5" style={{ minHeight: "80vh" }}>
          <div className="container">
          
          {/* Header Action Bar */}
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-5">
            <div>
              <button 
                onClick={() => router.back()} 
                className="btn btn-outline-secondary rounded-pill px-4 py-2 fw-semibold d-inline-flex align-items-center gap-2 border-0 bg-white shadow-sm mb-2"
              >
                <i className="fa-solid fa-arrow-left"></i> Back to Event Details
              </button>
              <h1 className="fw-extrabold text-dark m-0" style={{ fontSize: "32px", letterSpacing: "-0.5px" }}>
                Browse {serviceName}
              </h1>
              <p className="text-muted m-0 small">Find the perfect partner for your upcoming event requirements</p>
            </div>

            {/* Live Search Input */}
            <div className="position-relative" style={{ maxWidth: "360px", width: "100%" }}>
              <span className="position-absolute top-50 start-0 translate-middle-y ps-3 text-muted">
                <i className="fa-solid fa-magnifying-glass"></i>
              </span>
              <input
                type="text"
                className="form-control rounded-pill ps-5 py-2.5 shadow-sm border-0"
                placeholder={`Search ${serviceName}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ fontSize: "14px" }}
              />
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="d-flex flex-column align-items-center justify-content-center py-5">
              <div className="spinner-border text-primary mb-3" role="status" style={{ width: "3rem", height: "3rem" }}>
                <span className="visually-hidden">Loading...</span>
              </div>
              <span className="text-muted fw-semibold">Loading available service providers...</span>
            </div>
          )}

          {/* Error State */}
          {!loading && errorMsg && (
            <div className="alert alert-danger text-center py-4 rounded-4 shadow-sm border-0 mb-4" role="alert">
              <i className="fa-solid fa-circle-exclamation fs-3 mb-2 text-danger"></i>
              <h5 className="fw-bold">Failed to load service providers</h5>
              <p className="text-muted mb-0 small">{errorMsg}</p>
            </div>
          )}

          {/* Empty State */}
          {!loading && !errorMsg && filteredMerchants.length === 0 && (
            <div className="card border-0 rounded-4 text-center py-5 shadow-sm bg-white">
              <div className="card-body py-5">
                <div className="d-inline-flex align-items-center justify-content-center bg-primary bg-opacity-10 text-primary rounded-circle mb-3" style={{ width: "80px", height: "80px" }}>
                  <i className="fa-solid fa-store-slash fs-2"></i>
                </div>
                <h4 className="fw-bold text-dark">No Providers Found</h4>
                <p className="text-muted small mb-0 px-3 mx-auto" style={{ maxWidth: "480px" }}>
                  We couldn&apos;t find any merchants matching &quot;{searchQuery || serviceName}&quot; right now. Try searching another keyword or check back later!
                </p>
              </div>
            </div>
          )}

          {/* Service Providers Grid */}
          {!loading && !errorMsg && filteredMerchants.length > 0 && (
            <div className="row g-4">
              {filteredMerchants.map((m) => {
                const totalRating = m.ratingSummary?.averageRating || 0;
                const totalReviews = m.ratingSummary?.totalReviews || 0;
                
                // Get primary address/location details
                const mainLoc = m.serviceLocationIds?.[0];
                
                return (
                  <div key={m._id} className="col-12 col-md-6 col-lg-4 animate__animated animate__fadeIn">
                    <div className="card h-100 border-0 rounded-4 shadow-sm overflow-hidden bg-white hover-shadow transition">
                      
                      {/* Banner Image */}
                      <div className="position-relative" style={{ height: "180px" }}>
                        <img
                          src={m.bannerImage || m.profileImage || "https://images.pexels.com/photos/2774556/pexels-photo-2774556.jpeg?auto=compress&cs=tinysrgb&w=600"}
                          alt={m.serviceName || m.fullName}
                          className="w-100 h-100 object-fit-cover"
                          onError={(e) => {
                            e.target.src = "https://images.pexels.com/photos/2774556/pexels-photo-2774556.jpeg?auto=compress&cs=tinysrgb&w=600";
                          }}
                        />
                        
                        {/* Rating Badge Overlay */}
                        {totalReviews > 0 && (
                          <span className="position-absolute top-0 end-0 bg-white text-dark fw-bold rounded-pill px-2.5 py-1 m-3 shadow-sm d-flex align-items-center gap-1.5" style={{ fontSize: "12px" }}>
                            <i className="fa-solid fa-star text-warning"></i>
                            {totalRating.toFixed(1)} <span className="text-muted fw-normal" style={{ fontSize: "10px" }}>({totalReviews})</span>
                          </span>
                        )}
                      </div>

                      {/* Profile Card Body */}
                      <div className="card-body p-4 d-flex flex-column">
                        <div className="d-flex align-items-start justify-content-between mb-2">
                          <h5 className="fw-bold text-dark mb-0 text-truncate" style={{ maxWidth: "75%" }}>
                            {m.serviceName || m.fullName}
                          </h5>
                          {m.cuisineName && (
                            <span className="badge bg-light text-secondary rounded-pill py-1 px-2.5 small fw-semibold text-truncate" style={{ fontSize: "10px", maxWidth: "25%" }}>
                              {m.cuisineName}
                            </span>
                          )}
                        </div>

                        {m.serviceSlogan && (
                          <p className="text-primary small fw-semibold mb-2 text-truncate" style={{ fontSize: "12px" }}>
                            {m.serviceSlogan}
                          </p>
                        )}

                        <p className="text-muted small mb-4 flex-grow-1 text-clamp-2" style={{ lineHeight: "1.5" }}>
                          {m.serviceDescription || "Experienced provider offering custom services tailored for your celebration."}
                        </p>

                        {/* Location and Capacity Indicators */}
                        {mainLoc && (
                          <div className="bg-light p-3 rounded-3 mb-4 border border-light-subtle">
                            <div className="d-flex align-items-center gap-2 mb-1.5 text-muted" style={{ fontSize: "12px" }}>
                              <i className="fa-solid fa-location-dot text-danger flex-shrink-0"></i>
                              <span className="text-dark fw-semibold text-truncate">{mainLoc.addressName || "Main Branch"}</span>
                            </div>
                            <p className="text-muted small text-truncate mb-0 ps-4">
                              {mainLoc.address}
                            </p>
                            
                            {mainLoc.capacity && (
                              <div className="d-flex align-items-center gap-2 mt-2 pt-2 border-top border-light-subtle text-muted" style={{ fontSize: "12px" }}>
                                <i className="fa-solid fa-users text-primary flex-shrink-0"></i>
                                <span>Capacity: <strong className="text-dark">{mainLoc.capacity} Guests</strong></span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Action CTA */}
                        <button
                          type="button"
                          onClick={() => handleSelectMerchant(m)}
                          className="btn btn-primary w-100 rounded-pill py-2.5 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2 mt-auto"
                          style={{ background: "#4f46e5", border: "none" }}
                        >
                          <i className="fa-solid fa-arrow-right-to-bracket"></i>
                          View Profile & Products
                        </button>

                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>
      </div>
      <Footer />
    </>
  );
}

export default function MerchantsByServicePage() {
  return (
    <Suspense fallback={
      <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    }>
      <MerchantsByServiceContent />
    </Suspense>
  );
}
