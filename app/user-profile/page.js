"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { authService } from "../services/authService";
import Swal from "sweetalert2";

export default function UserProfilePage() {
  const router = useRouter();

  // Active tab state: "profile" | "password"
  const [activeTab, setActiveTab] = useState("profile");

  // User auth state
  const [userInfo, setUserInfo] = useState(null);

  // Profile form states matching GET /user-profile and PUT /update-profile
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("MALE");
  const [profilePic, setProfilePic] = useState("https://st2.depositphotos.com/1006318/5909/v/450/depositphotos_59094701-stock-illustration-businessman-profile-icon.jpg");
  const [profilePicFile, setProfilePicFile] = useState(null);

  // Change Password state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Status & modal states
  const [fetching, setFetching] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [actionMsg, setActionMsg] = useState({ type: "", text: "" });

  // 1. Fetch profile on mount
  useEffect(() => {
    async function loadProfile() {
      setFetching(true);
      try {
        const res = await authService.getUserProfile();
        if (res && res.status && res.user) {
          const u = res.user;
          setUserInfo(u);
          if (u.fullName) setFullName(u.fullName);
          if (u.email) setEmail(u.email);
          if (u.mobile) setMobile(u.mobile);
          if (u.countryCode) setCountryCode(u.countryCode);
          if (u.dob) setDob(u.dob);
          if (u.gender) setGender(u.gender);
          if (u.profilePic) setProfilePic(u.profilePic);
        } else {
          // Fallback to local storage
          const localUser = authService.getUser();
          if (localUser) {
            setUserInfo(localUser);
            if (localUser.email) setEmail(localUser.email);
          }
        }
      } catch (err) {
        console.error("Error fetching user profile:", err);
      } finally {
        setFetching(false);
      }
    }

    loadProfile();
  }, []);

  const handleProfilePicChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfilePicFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePic(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // 2. Submit Update Profile API (PUT /auth/update-profile)
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setActionMsg({ type: "", text: "" });
    setLoading(true);

    try {
      const formData = new FormData();
      if (profilePicFile) {
        formData.append("profilePic", profilePicFile);
      }
      if (dob) formData.append("dob", dob);
      if (gender) formData.append("gender", gender);

      const res = await authService.updateProfile(formData);

      if (res && res.status) {
        setActionMsg({ type: "success", text: res.message || "Profile updated successfully!" });
        // Refresh profile info
        authService.getUserProfile();
      } else {
        setActionMsg({ type: "danger", text: res?.message || "Failed to update profile. Please try again." });
      }
    } catch (err) {
      setActionMsg({ type: "danger", text: "An error occurred while updating profile." });
    } finally {
      setLoading(false);
    }
  };

  // 3. Submit Change Password API (POST /auth/change-password)
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setActionMsg({ type: "", text: "" });

    if (newPassword !== confirmPassword) {
      setActionMsg({ type: "danger", text: "New password and confirm password do not match!" });
      return;
    }

    setLoading(true);

    try {
      const res = await authService.changePassword({ newPassword });

      if (res && res.status) {
        setActionMsg({ type: "success", text: res.message || "Password changed successfully!" });
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setActionMsg({ type: "danger", text: res?.message || "Failed to change password. Please try again." });
      }
    } catch (err) {
      setActionMsg({ type: "danger", text: "An error occurred while changing password." });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    const user = authService.getUser();
    await authService.logout(user ? { email: user.email } : null);
    router.push("/login");
  };

  const handleDeleteAccount = async () => {
    setLoading(true);
    try {
      const res = await authService.deleteUser();
      if (res && res.status) {
        await Swal.fire({
          title: "Account Deactivated",
          text: res.message || "Account deleted (deactivated) successfully",
          icon: "success",
          confirmButtonColor: "#3e56f0"
        });
        router.push("/login");
      } else {
        setActionMsg({ type: "danger", text: res?.message || "Failed to delete account. Please try again." });
      }
    } catch (err) {
      setActionMsg({ type: "danger", text: "Error deleting account. Please try again." });
    } finally {
      setLoading(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <>
      <Header />
      <div className="wrapper">
        <div className="hero-banner pb-5 pt-5" style={{ background: "#0c1b33", color: "#fff" }}>
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-xl-8 col-lg-8 col-md-10 text-center">
                <div className="hero-banner-content">
                  <h2 className="text-white fw-bold">My Account</h2>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="event-dt-block p-80">
          <div className="container">
            {actionMsg.text && (
              <div className={`alert alert-${actionMsg.type} alert-dismissible fade show mb-4`} role="alert">
                <i className={`fa-solid ${actionMsg.type === "success" ? "fa-circle-check" : "fa-circle-exclamation"} me-2`}></i>
                {actionMsg.text}
                <button type="button" className="btn-close" onClick={() => setActionMsg({ type: "", text: "" })}></button>
              </div>
            )}

            <div className="row">
              {/* Sidebar Navigation */}
              <div className="col-lg-3">
                <div style={{ position: "sticky", top: "24px", zIndex: 10 }}>
                <div className="user-profile-sidebar border p-4 bg-white rounded-3 shadow-sm mb-4">
                  <div className="user-profile-sidebar-top text-center mb-4">
                    <div className="user-profile-img position-relative d-inline-block mb-3">
                      <img
                        alt="Profile"
                        src={profilePic}
                        className="rounded-circle border"
                        width="100"
                        height="100"
                        style={{ objectFit: "cover" }}
                      />
                      <label
                        className="profile-img-btn position-absolute bottom-0 end-0 bg-primary text-white rounded-circle p-2 cursor-pointer border-0 shadow-sm"
                        htmlFor="profile-pic-upload"
                        style={{ width: "35px", height: "35px", display: "flex", alignItems: "center", justifyContent: "center" }}
                        title="Upload Photo"
                      >
                        <i className="fa fa-camera small"></i>
                      </label>
                      <input
                        className="profile-img-file"
                        type="file"
                        id="profile-pic-upload"
                        accept="image/*"
                        onChange={handleProfilePicChange}
                        style={{ display: "none" }}
                      />
                    </div>
                    <h5 className="fw-bold">{fullName || "User Profile"}</h5>
                    <p className="text-muted small mb-0">{email}</p>
                  </div>

                  <ul className="user-profile-sidebar-list list-unstyled m-0">
                    <li className="mb-2">
                      <button
                        onClick={() => setActiveTab("profile")}
                        className={`btn text-start w-100 p-3 rounded-2 text-decoration-none fw-semibold border-0 ${activeTab === "profile" ? "btn-primary text-white" : "btn-light text-muted"}`}
                        style={{ backgroundColor: activeTab === "profile" ? "#5b67f1" : "#f8f9fa" }}
                      >
                        <i className="fa fa-user me-2"></i> My Profile
                      </button>
                    </li>
                    <li className="mb-2">
                      <button
                        onClick={() => setActiveTab("password")}
                        className={`btn text-start w-100 p-3 rounded-2 text-decoration-none fw-semibold border-0 ${activeTab === "password" ? "btn-primary text-white" : "btn-light text-muted"}`}
                        style={{ backgroundColor: activeTab === "password" ? "#5b67f1" : "#f8f9fa" }}
                      >
                        <i className="fa fa-lock me-2"></i> Change Password
                      </button>
                    </li>
                    <li className="mb-2">
                      <Link className="d-block p-3 rounded-2 text-decoration-none fw-semibold text-muted bg-light" href="/my-events">
                        <i className="fa fa-layer-group me-2"></i> My Events
                      </Link>
                    </li>
                    <li className="mb-2">
                      <Link className="d-block p-3 rounded-2 text-decoration-none fw-semibold text-muted bg-light" href="/my-reservations">
                        <i className="fa fa-calendar me-2"></i> My Reservations
                      </Link>
                    </li>
                    <li className="mb-2">
                      <Link className="d-block p-3 rounded-2 text-decoration-none fw-semibold text-muted bg-light" href="/notifications">
                        <i className="fa fa-bell me-2"></i> Notifications
                      </Link>
                    </li>
                    <li className="mb-2">
                      <button
                        onClick={handleLogout}
                        className="btn btn-link text-start w-100 p-3 rounded-2 text-decoration-none fw-semibold text-muted border-0 bg-light"
                      >
                        <i className="fa fa-sign-out me-2"></i> Logout
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => setShowDeleteModal(true)}
                        className="btn btn-link text-start w-100 p-3 rounded-2 text-decoration-none fw-semibold text-danger border-0 bg-light"
                      >
                        <i className="fa fa-trash me-2"></i> Delete Account
                      </button>
                    </li>
                  </ul>
                </div>
                </div>
              </div>

              {/* Profile Details & Change Password Content */}
              <div className="col-lg-9">
                <div className="user-profile-wrapper border p-4 bg-white rounded-3 shadow-sm">
                  {fetching ? (
                    <div className="text-center py-5">
                      <div className="spinner-border text-primary" role="status"></div>
                      <p className="mt-2 text-muted">Loading profile info...</p>
                    </div>
                  ) : activeTab === "profile" ? (
                    /* TAB 1: EDIT PROFILE FORM */
                    <div className="user-profile-card">
                      <h4 className="user-profile-card-title fw-bold mb-4" style={{ color: "#0c1b33" }}>
                        Profile Info
                      </h4>
                      <div className="user-profile-form">
                        <form onSubmit={handleUpdateProfile}>
                          <div className="row">
                            <div className="col-md-6 mb-3">
                              <div className="form-group">
                                <label className="form-label fw-semibold">Full Name</label>
                                <input
                                  className="form-control bg-light"
                                  type="text"
                                  value={fullName}
                                  onChange={(e) => setFullName(e.target.value)}
                                  placeholder="Full name"
                                  readOnly
                                />
                              </div>
                            </div>
                            <div className="col-md-6 mb-3">
                              <div className="form-group">
                                <label className="form-label fw-semibold">Email Address</label>
                                <input
                                  className="form-control bg-light"
                                  type="email"
                                  value={email}
                                  onChange={(e) => setEmail(e.target.value)}
                                  placeholder="Email"
                                  readOnly
                                />
                              </div>
                            </div>
                            <div className="col-md-6 mb-3">
                              <div className="form-group">
                                <label className="form-label fw-semibold">Mobile Number</label>
                                <input
                                  className="form-control bg-light"
                                  type="text"
                                  value={`${countryCode} ${mobile}`}
                                  readOnly
                                />
                              </div>
                            </div>
                            <div className="col-md-6 mb-3">
                              <div className="form-group">
                                <label className="form-label fw-semibold">Date of Birth (DOB)*</label>
                                <input
                                  className="form-control"
                                  type="text"
                                  placeholder="e.g. 14-01-2000"
                                  value={dob}
                                  onChange={(e) => setDob(e.target.value)}
                                  required
                                />
                              </div>
                            </div>
                            <div className="col-md-6 mb-3">
                              <div className="form-group">
                                <label className="form-label fw-semibold">Gender*</label>
                                <select
                                  className="form-select"
                                  value={gender}
                                  onChange={(e) => setGender(e.target.value)}
                                  required
                                >
                                  <option value="MALE">MALE</option>
                                  <option value="FEMALE">FEMALE</option>
                                  <option value="OTHER">OTHER</option>
                                </select>
                              </div>
                            </div>
                            <div className="col-md-6 mb-3">
                              <div className="form-group">
                                <label className="form-label fw-semibold">Profile Picture (Upload Image)</label>
                                <input
                                  type="file"
                                  className="form-control"
                                  accept="image/*"
                                  onChange={handleProfilePicChange}
                                />
                                {profilePicFile && (
                                  <small className="text-success mt-1 d-block fw-semibold" style={{ fontSize: "12px" }}>
                                    <i className="fa-solid fa-circle-check me-1"></i> {profilePicFile.name}
                                  </small>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="d-flex align-items-center gap-3 mt-4">
                            <button
                              className="btn btn-primary border-0 px-4 py-2 rounded-pill fw-semibold"
                              style={{ background: "#5b67f1", height: "45px" }}
                              type="submit"
                              disabled={loading}
                            >
                              {loading ? (
                                <span><i className="fa-solid fa-spinner fa-spin me-2"></i> Saving...</span>
                              ) : (
                                <span><i className="fa fa-user me-2"></i> Save Profile Changes</span>
                              )}
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  ) : (
                    /* TAB 2: CHANGE PASSWORD FORM */
                    <div className="user-profile-card">
                      <h4 className="user-profile-card-title fw-bold mb-4" style={{ color: "#0c1b33" }}>
                        Change Password
                      </h4>
                      <div className="user-profile-form" style={{ maxWidth: "500px" }}>
                        <form onSubmit={handleChangePassword}>
                          <div className="form-group mb-3 position-relative">
                            <label className="form-label fw-semibold">New Password*</label>
                            <div className="position-relative">
                              <input
                                className="form-control h_50 pe-5"
                                type={showNewPassword ? "text" : "password"}
                                placeholder="Enter new password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                              />
                              <span
                                className="position-absolute top-50 end-0 translate-middle-y me-3 text-muted cursor-pointer"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                              >
                                <i className={`fa-solid ${showNewPassword ? "fa-eye" : "fa-eye-slash"}`}></i>
                              </span>
                            </div>
                          </div>

                          <div className="form-group mb-4 position-relative">
                            <label className="form-label fw-semibold">Confirm New Password*</label>
                            <input
                              className="form-control h_50"
                              type="password"
                              placeholder="Confirm new password"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              required
                            />
                          </div>

                          <button
                            className="btn btn-primary border-0 px-4 py-2 rounded-pill fw-semibold"
                            style={{ background: "#5b67f1", height: "45px" }}
                            type="submit"
                            disabled={loading}
                          >
                            {loading ? (
                              <span><i className="fa-solid fa-spinner fa-spin me-2"></i> Updating...</span>
                            ) : (
                              <span><i className="fa fa-lock me-2"></i> Update Password</span>
                            )}
                          </button>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 border-0 p-3">
              <div className="modal-header border-0">
                <h5 className="modal-title text-danger fw-bold">
                  <i className="fa-solid fa-triangle-exclamation me-2"></i> Delete Account
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowDeleteModal(false)}></button>
              </div>
              <div className="modal-body">
                <p className="mb-0 text-secondary">
                  Are you sure you want to delete (deactivate) your account? This action cannot be undone.
                </p>
              </div>
              <div className="modal-footer border-0">
                <button type="button" className="btn btn-light rounded-pill px-4" onClick={() => setShowDeleteModal(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger rounded-pill px-4"
                  disabled={loading}
                  onClick={handleDeleteAccount}
                >
                  {loading ? "Deleting..." : "Confirm Delete"}
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
