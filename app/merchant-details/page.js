"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "../components/Header";
import Footer from "../components/Footer";

export default function MerchantDetailsPage() {
  const router = useRouter();
  const [merchant, setMerchant] = useState(null);
  const [copiedCoupon, setCopiedCoupon] = useState(null);

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem("eventuna-latest-merchant");
      if (stored) {
        setMerchant(JSON.parse(stored));
      } else {
        // Fallback mock if directly navigated
        setMerchant({
          _id: "68c259b5a6251e9e18484fdd",
          serviceName: "MyMarkwt",
          serviceSlogan: "Its@aazaing",
          serviceDescription: "Serving premium experiences and catering setup for all high-end corporate events, weddings, and parties. We offer customized cuisine selections and top-notch floor plans.",
          email: "myrestaurent@gmail.com",
          phone: "4884949493",
          mobile: "810300651",
          isVerified: true,
          countryCode: "+966",
          onlineReservation: true,
          cuisineName: "Chinese, Italian",
          bannerImage: "https://images.pexels.com/photos/2774556/pexels-photo-2774556.jpeg?auto=compress&cs=tinysrgb&w=600",
          serviceLocationIds: [
            {
              _id: "68c25d89a6251e9e18485038",
              addressName: "HomeTown",
              address: "Ghatiya, Ujjain, Madhya Pradesh, India",
              capacity: 300,
              weeklySchedule: [
                { day: "Sunday", morning: { from: "10:57", to: "20:00" }, evening: { from: "20:00", to: "23:30" } },
                { day: "Monday", morning: { from: "09:00", to: "17:00" }, evening: { from: "00:00", to: "00:00" } },
                { day: "Tuesday", morning: { from: "09:00", to: "17:00" }, evening: { from: "00:00", to: "00:00" } }
              ]
            }
          ],
          couponIds: [
            {
              _id: "68c25eb6a6251e9e184850b2",
              couponName: "50%OFF",
              discount: "50",
              validFrom: "11-09-2025",
              validTo: "11-09-2026",
              description: "Applicable on all catering orders above $500."
            }
          ],
          products: [
            {
              _id: "68c25e5ba6251e9e184850a6",
              name: "Gourmet Banquet",
              description: "Complete buffet setup with starters, mains, and desserts.",
              price: 45000,
              photo: [{ fileName: "https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=600&q=80" }]
            }
          ]
        });
      }
    } catch (e) {
      console.error("Failed to parse merchant details:", e);
    }
  }, []);

  const handleCopyCoupon = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCoupon(code);
    setTimeout(() => setCopiedCoupon(null), 2000);
  };

  const getProductImage = (photoObj) => {
    if (!photoObj || !photoObj[0]) return "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80";
    const name = photoObj[0].fileName || photoObj[0].name;
    if (!name) return "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80";
    if (name.startsWith("http")) return name;
    return `https://event-una-image-bucket.s3.amazonaws.com/merchant/products/${name}`;
  };

  if (!merchant) {
    return (
      <>
        <Header />
        <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  const primaryLocation = merchant.serviceLocationIds?.[0] || null;

  return (
    <>
      <Header />
      <div className="wrapper">
        {/* Merchant Hero Topper Banner */}
        <div 
          className="topper d-flex align-items-end mb-0" 
          style={{ 
            backgroundImage: `linear-gradient(rgba(0, 0, 0, .55), rgba(0, 0, 0, .55)), url('${merchant.bannerImage || "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80"}')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            height: "380px",
            color: "#fff",
            paddingBottom: "40px"
          }}
        >
          <div className="container">
            <div className="mb-3">
              <button 
                onClick={handleBack} 
                className="btn btn-light btn-sm rounded-pill px-3.5 py-1.5 fw-bold d-inline-flex align-items-center gap-2 shadow-sm border-0"
                style={{ fontSize: "13px", opacity: 0.9 }}
              >
                <i className="bi bi-arrow-left"></i>
                Back
              </button>
            </div>
            <div className="row align-items-end">
              <div className="col-lg-12">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <span className="badge bg-primary text-white px-3 py-2 rounded-pill fw-bold" style={{ fontSize: "12px" }}>
                    {merchant.serviceId?.servicesName || "Merchant Partner"}
                  </span>
                  {merchant.isVerified && (
                    <span className="badge bg-success text-white px-3 py-2 rounded-pill fw-bold d-flex align-items-center gap-1" style={{ fontSize: "12px" }}>
                      <i className="bi bi-patch-check-fill"></i> Verified
                    </span>
                  )}
                </div>
                <h1 className="fw-bold m-0" style={{ fontSize: "40px", textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
                  {merchant.serviceName}
                </h1>
                {merchant.serviceSlogan && (
                  <p className="lead m-0 mt-1.5 opacity-90 fw-medium" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.4)" }}>
                    {merchant.serviceSlogan}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Details Section */}
        <div className="event-dt-block p-80 bg-light" style={{ paddingTop: "40px" }}>
          <div className="container">
            {/* Header / Back Action Bar */}
            <div className="d-flex justify-content-between align-items-center mb-4">
              <button 
                onClick={handleBack} 
                className="btn btn-outline-secondary rounded-pill px-4 py-2 fw-semibold d-inline-flex align-items-center gap-2 bg-white shadow-sm border-0 text-dark"
              >
                <i className="bi bi-arrow-left"></i>
                Back
              </button>
            </div>

            <div className="row g-4">
              
              {/* Left Column - Core Info & Services */}
              <div className="col-lg-8">
                
                {/* About description card */}
                <div className="cardx p-4 mb-4">
                  <h4 className="fw-bold text-dark mb-3">About</h4>
                  <p className="text-muted mb-0" style={{ fontSize: "15px", lineHeight: "1.7", whiteSpace: "pre-line" }}>
                    {merchant.serviceDescription || "No description provided."}
                  </p>
                </div>

                {/* Location & Weekly Schedule card */}
                {primaryLocation && (
                  <div className="cardx p-4 mb-4">
                    <h4 className="fw-bold text-dark mb-3">Location & Operating Schedule</h4>
                    <div className="d-flex align-items-start gap-2 mb-3 text-muted">
                      <i className="bi bi-geo-alt-fill text-primary fs-5 mt-0.5"></i>
                      <div>
                        <h6 className="fw-bold text-dark m-0">{primaryLocation.addressName || "Main Office"}</h6>
                        <span className="small">{primaryLocation.address}</span>
                      </div>
                    </div>

                    {primaryLocation.weeklySchedule && primaryLocation.weeklySchedule.length > 0 && (
                      <div className="border rounded-3 overflow-hidden mt-3">
                        <table className="table table-borderless m-0 text-center" style={{ fontSize: "14px" }}>
                          <thead className="bg-light">
                            <tr className="border-bottom">
                              <th className="text-start ps-4 py-2.5">Day</th>
                              <th className="py-2.5">Morning Shift</th>
                              <th className="py-2.5">Evening Shift</th>
                            </tr>
                          </thead>
                          <tbody>
                            {primaryLocation.weeklySchedule.map((sched, idx) => {
                              const morningClosed = sched.morning?.from === "00:00" && sched.morning?.to === "00:00";
                              const eveningClosed = sched.evening?.from === "00:00" && sched.evening?.to === "00:00";
                              return (
                                <tr key={sched._id || idx} className="border-bottom align-middle">
                                  <td className="text-start ps-4 py-2.5 fw-medium text-dark">{sched.day}</td>
                                  <td className="py-2.5">
                                    {morningClosed ? (
                                      <span className="text-muted small">Closed</span>
                                    ) : (
                                      <span className="badge bg-primary-subtle text-primary px-2.5 py-1.5">{sched.morning?.from} - {sched.morning?.to}</span>
                                    )}
                                  </td>
                                  <td className="py-2.5">
                                    {eveningClosed ? (
                                      <span className="text-muted small">Closed</span>
                                    ) : (
                                      <span className="badge bg-info-subtle text-info px-2.5 py-1.5">{sched.evening?.from} - {sched.evening?.to}</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Catalog / Products card */}
                {merchant.products && merchant.products.length > 0 && (
                  <div className="cardx p-4 mb-4">
                    <h4 className="fw-bold text-dark mb-4">Products & Menu Offerings</h4>
                    <div className="row g-4">
                      {merchant.products.map((prod) => (
                        <div key={prod._id} className="col-md-6 col-12">
                          <div className="border rounded-3 p-3 h-100 bg-white shadow-sm d-flex flex-column justify-content-between">
                            <div>
                              <div className="position-relative w-100 rounded-2 overflow-hidden mb-3" style={{ height: "160px" }}>
                                <img 
                                  src={getProductImage(prod.photo)} 
                                  alt={prod.name}
                                  className="w-100 h-100"
                                  style={{ objectFit: "cover" }}
                                />
                              </div>
                              <h5 className="fw-bold text-dark mb-1">{prod.name}</h5>
                              <p className="text-muted small mb-3" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                                {prod.description || "Freshly sourced, premium quality preparation."}
                              </p>
                            </div>
                            <div className="border-top pt-2.5 d-flex justify-content-between align-items-center">
                              <span className="small text-muted">Price</span>
                              <span className="fw-bold text-primary fs-5">€{prod.price}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>

              {/* Right Column - Booking & Fast Contacts */}
              <div className="col-lg-4">
                
                {/* Details summary list */}
                <div className="cardx p-4 mb-4">
                  <h5 className="fw-bold text-dark mb-3">Merchant details</h5>
                  <ul className="list-unstyled m-0 d-flex flex-column gap-3" style={{ fontSize: "14px" }}>
                    <li className="d-flex justify-content-between align-items-center pb-2.5 border-bottom">
                      <span className="text-muted">Cuisine / Category</span>
                      <strong className="text-dark text-truncate" style={{ maxWidth: "160px" }}>{merchant.cuisineName || "Standard"}</strong>
                    </li>
                    <li className="d-flex justify-content-between align-items-center pb-2.5 border-bottom">
                      <span className="text-muted">Max Capacity</span>
                      <strong className="text-dark">{primaryLocation?.capacity ? `${primaryLocation.capacity} guests` : "N/A"}</strong>
                    </li>
                    <li className="d-flex justify-content-between align-items-center pb-2.5 border-bottom">
                      <span className="text-muted">Online Booking</span>
                      <strong className="text-dark">
                        {merchant.onlineReservation ? (
                          <span className="text-success"><i className="bi bi-check-circle-fill me-1"></i>Available</span>
                        ) : (
                          <span className="text-muted">Not Supported</span>
                        )}
                      </strong>
                    </li>
                    <li className="d-flex justify-content-between align-items-center pb-2.5 border-bottom">
                      <span className="text-muted">Phone</span>
                      <a href={`tel:${merchant.phone || merchant.mobile}`} className="text-primary text-decoration-none fw-medium">
                        {merchant.phone || merchant.mobile || "N/A"}
                      </a>
                    </li>
                    <li className="d-flex justify-content-between align-items-center pb-2.5 border-bottom">
                      <span className="text-muted">Email</span>
                      <a href={`mailto:${merchant.email}`} className="text-primary text-decoration-none fw-medium text-truncate" style={{ maxWidth: "180px" }}>
                        {merchant.email}
                      </a>
                    </li>
                    {merchant.webUrl && (
                      <li className="d-flex justify-content-between align-items-center">
                        <span className="text-muted">Website</span>
                        <a href={merchant.webUrl} target="_blank" rel="noopener noreferrer" className="text-primary text-decoration-none fw-medium text-truncate" style={{ maxWidth: "180px" }}>
                          Visit site <i className="bi bi-box-arrow-up-right small ms-0.5"></i>
                        </a>
                      </li>
                    )}
                  </ul>
                  
                  <div className="mt-4">
                    <a href={`mailto:${merchant.email}`} className="btn btn-primary w-100 rounded-pill py-2 fw-bold">
                      Contact Merchant
                    </a>
                  </div>
                </div>

                {/* Coupons / Offers card */}
                {merchant.couponIds && merchant.couponIds.length > 0 && (
                  <div className="cardx p-4 mb-4">
                    <h5 className="fw-bold text-dark mb-3">Available Coupon Code</h5>
                    <div className="d-flex flex-column gap-3">
                      {merchant.couponIds.map((coupon) => (
                        <div key={coupon._id} className="border border-danger border-dashed rounded-3 p-3 bg-danger-subtle text-danger position-relative">
                          <div className="d-flex justify-content-between align-items-start mb-1">
                            <span className="fw-bold fs-5">{coupon.couponName}</span>
                            <span className="badge bg-danger text-white">{coupon.discount}% OFF</span>
                          </div>
                          <p className="small mb-3 text-muted" style={{ lineHeight: "1.4" }}>
                            {coupon.description || `Get ${coupon.discount}% discount on services.`}
                          </p>
                          <div className="d-flex justify-content-between align-items-center border-top border-danger pt-2 mt-1">
                            <span className="small text-muted" style={{ fontSize: "11px" }}>Expires: {coupon.validTo}</span>
                            <button 
                              className="btn btn-danger btn-sm px-3 rounded-pill fw-bold" 
                              style={{ fontSize: "11px" }}
                              onClick={() => handleCopyCoupon(coupon.couponName)}
                            >
                              {copiedCoupon === coupon.couponName ? "Copied!" : "Copy"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Additional Media Files */}
                {(merchant.menuUrl || merchant.floorPlan) && (
                  <div className="cardx p-4">
                    <h5 className="fw-bold text-dark mb-3">Media & Catalog Files</h5>
                    <div className="d-flex flex-column gap-2">
                      {merchant.menuUrl && (
                        <a 
                          href={merchant.menuUrl} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="btn btn-outline-secondary w-100 text-start d-flex align-items-center justify-content-between px-3"
                        >
                          <span><i className="bi bi-file-earmark-pdf text-danger me-2"></i>View Service Menu</span>
                          <i className="bi bi-chevron-right text-muted"></i>
                        </a>
                      )}
                      {merchant.floorPlan && (
                        <a 
                          href={merchant.floorPlan} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="btn btn-outline-secondary w-100 text-start d-flex align-items-center justify-content-between px-3"
                        >
                          <span><i className="bi bi-map text-success me-2"></i>View Floor Plan Layout</span>
                          <i className="bi bi-chevron-right text-muted"></i>
                        </a>
                      )}
                    </div>
                  </div>
                )}

              </div>

            </div>
          </div>
        </div>

      </div>
      <Footer />
    </>
  );
}
