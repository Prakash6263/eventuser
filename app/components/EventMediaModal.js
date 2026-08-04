"use client";

import React, { useState, useEffect, useRef } from "react";
import Swal from "sweetalert2";
import {
  getEventMediaApi,
  likeMediaApi,
  commentMediaApi,
  deleteMediaApi,
  deleteCommentApi,
  likeCommentApi,
  getMediaCommentsApi,
  uploadMediaApi,
} from "../services/eventMediaApi";
import { getUser } from "../services/apiClient";

export default function EventMediaModal({ activeGalleryEvent, onClose }) {
  const [mediaList, setMediaList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  // Upload modal/form states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadMode, setUploadMode] = useState("file"); // 'file' or 'camera'
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadCaption, setUploadCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef(null);

  // Camera & Video Recorder States
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraType, setCameraType] = useState("photo"); // 'photo' or 'video'
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState(null);

  const cameraVideoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);

  // Comments states (for detail view)
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  // General action message / toast
  const [toastMessage, setToastMessage] = useState(null);

  const currentUser = getUser();
  const eventId = activeGalleryEvent?.id || activeGalleryEvent?._id;

  const showToast = (msg, type = "success") => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Fetch Event Media
  const fetchMedia = async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const res = await getEventMediaApi(eventId);
      if (res && res.status && res.data && Array.isArray(res.data.media)) {
        const photos = res.data.media.map(normalizeMediaItem);
        setMediaList(photos);
      } else if (res && res.status && Array.isArray(res.data)) {
        const photos = res.data.map(normalizeMediaItem);
        setMediaList(photos);
      } else {
        setMediaList([]);
      }
    } catch (err) {
      console.error("Error fetching event media:", err);
      setMediaList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedia();
  }, [eventId]);

  const normalizeMediaItem = (m) => {
    const rawId = m._id || m.id;
    const isVideo =
      m.mediaType === "video" ||
      (typeof m.mediaUrl === "string" && m.mediaUrl.match(/\.(mp4|mov|webm|avi|mkv)$/i));

    const likesCount =
      typeof m.likesCount === "number"
        ? m.likesCount
        : Array.isArray(m.likes)
        ? m.likes.length
        : 0;

    const commentsCount =
      typeof m.commentsCount === "number"
        ? m.commentsCount
        : Array.isArray(m.comments)
        ? m.comments.length
        : 0;

    const isLiked =
      !!m.isLiked ||
      !!m.isLikedByUser ||
      (Array.isArray(m.likes) && currentUser && m.likes.includes(currentUser.userId));

    return {
      id: rawId,
      url:
        m.mediaUrl ||
        m.thumbnailUrl ||
        "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=600&q=80",
      thumbnailUrl: m.thumbnailUrl || m.mediaUrl || "",
      caption: m.caption || m.description || "",
      mediaType: isVideo ? "video" : "image",
      likesCount,
      isLiked,
      commentsCount,
      raw: m,
    };
  };

  // Start Camera Stream
  const startCamera = async (type = "photo") => {
    setCameraType(type);
    setUploadFile(null);
    setCapturedPreviewUrl(null);
    setUploadError("");

    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
      }
      const constraints = {
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: type === "video",
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraStream(stream);
      setCameraActive(true);

      setTimeout(() => {
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      console.error("Camera access error:", err);
      setUploadError("Could not access camera/microphone. Please check browser permissions.");
    }
  };

  // Stop Camera Stream
  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setCameraActive(false);
    if (isRecording) {
      stopRecording();
    }
  };

  // Snap Photo from Camera
  const snapPhoto = () => {
    if (!cameraVideoRef.current) return;
    const video = cameraVideoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `photo_${Date.now()}.jpg`, { type: "image/jpeg" });
          setUploadFile(file);
          setCapturedPreviewUrl(URL.createObjectURL(blob));
          stopCamera();
        }
      },
      "image/jpeg",
      0.92
    );
  };

  // Start Recording Video
  const startRecording = () => {
    if (!cameraStream) return;
    recordedChunksRef.current = [];
    try {
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : MediaRecorder.isTypeSupported("video/mp4")
        ? "video/mp4"
        : "video/webm";

      const recorder = new MediaRecorder(cameraStream, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const ext = mimeType.includes("mp4") ? "mp4" : "webm";
        const file = new File([blob], `video_${Date.now()}.${ext}`, { type: mimeType });
        setUploadFile(file);
        setCapturedPreviewUrl(URL.createObjectURL(blob));
      };

      recorder.start(200);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Recording error:", err);
      setUploadError("Could not start video recording.");
    }
  };

  // Stop Recording Video
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      stopCamera();
    }
  };

  // Cleanup on unmount or tab switch
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, [cameraStream]);

  // Fetch Comments for Selected Photo
  const fetchComments = async (mediaId) => {
    if (!mediaId) return;
    setLoadingComments(true);
    try {
      const res = await getMediaCommentsApi({ mediaId, page: 1, limit: 50 });
      if (res && res.status) {
        const rawComments = res.data?.comments || res.data || res.comments || [];
        setComments(Array.isArray(rawComments) ? rawComments : []);
      } else {
        setComments([]);
      }
    } catch (err) {
      console.error("Error fetching comments:", err);
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  };

  useEffect(() => {
    if (selectedPhoto) {
      fetchComments(selectedPhoto.id);
    } else {
      setComments([]);
    }
  }, [selectedPhoto]);

  // Like Media Handler
  const handleLikeMedia = async (media, e) => {
    if (e) e.stopPropagation();
    const mediaId = media.id;

    // Optimistic UI update
    setMediaList((prev) =>
      prev.map((item) => {
        if (item.id === mediaId) {
          const nextIsLiked = !item.isLiked;
          const nextCount = nextIsLiked
            ? item.likesCount + 1
            : Math.max(0, item.likesCount - 1);
          return { ...item, isLiked: nextIsLiked, likesCount: nextCount };
        }
        return item;
      })
    );

    if (selectedPhoto && selectedPhoto.id === mediaId) {
      setSelectedPhoto((prev) => {
        if (!prev) return null;
        const nextIsLiked = !prev.isLiked;
        const nextCount = nextIsLiked
          ? prev.likesCount + 1
          : Math.max(0, prev.likesCount - 1);
        return { ...prev, isLiked: nextIsLiked, likesCount: nextCount };
      });
    }

    try {
      const res = await likeMediaApi(mediaId);
      if (res && res.status) {
        showToast(res.message || "Updated like status");
      } else {
        fetchMedia();
      }
    } catch (err) {
      console.error("Like media failed:", err);
      fetchMedia();
    }
  };

  // Comment on Media Handler
  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!selectedPhoto || !newCommentText.trim()) return;

    const mediaId = selectedPhoto.id;
    const commentContent = newCommentText.trim();
    setPostingComment(true);

    try {
      const res = await commentMediaApi({ mediaId, comment: commentContent });
      if (res && res.status) {
        setNewCommentText("");
        showToast("Comment posted!");
        fetchComments(mediaId);
        setMediaList((prev) =>
          prev.map((item) =>
            item.id === mediaId
              ? { ...item, commentsCount: item.commentsCount + 1 }
              : item
          )
        );
        setSelectedPhoto((prev) =>
          prev ? { ...prev, commentsCount: prev.commentsCount + 1 } : null
        );
      } else {
        showToast(res.message || "Failed to post comment", "danger");
      }
    } catch (err) {
      console.error("Comment failed:", err);
      showToast("Error posting comment", "danger");
    } finally {
      setPostingComment(false);
    }
  };

  // Delete Media Handler
  const handleDeleteMedia = async (mediaId, e) => {
    if (e) e.stopPropagation();
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "You want to delete this media item?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Yes, delete it!"
    });
    if (!result.isConfirmed) return;

    try {
      const res = await deleteMediaApi(mediaId);
      if (res && res.status) {
        showToast("Media deleted successfully");
        setMediaList((prev) => prev.filter((m) => m.id !== mediaId));
        if (selectedPhoto && selectedPhoto.id === mediaId) {
          setSelectedPhoto(null);
        }
      } else {
        showToast(res.message || "Failed to delete media", "danger");
      }
    } catch (err) {
      console.error("Delete media error:", err);
      showToast("Error deleting media", "danger");
    }
  };

  // Delete Comment Handler
  const handleDeleteComment = async (commentId) => {
    const result = await Swal.fire({
      title: "Delete Comment?",
      text: "Are you sure you want to delete this comment?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Yes, delete it!"
    });
    if (!result.isConfirmed) return;

    try {
      const res = await deleteCommentApi(commentId);
      if (res && res.status) {
        showToast("Comment deleted");
        setComments((prev) => prev.filter((c) => (c._id || c.id) !== commentId));
        if (selectedPhoto) {
          setMediaList((prev) =>
            prev.map((item) =>
              item.id === selectedPhoto.id
                ? { ...item, commentsCount: Math.max(0, item.commentsCount - 1) }
                : item
            )
          );
          setSelectedPhoto((prev) =>
            prev ? { ...prev, commentsCount: Math.max(0, prev.commentsCount - 1) } : null
          );
        }
      } else {
        showToast(res.message || "Failed to delete comment", "danger");
      }
    } catch (err) {
      console.error("Delete comment error:", err);
      showToast("Error deleting comment", "danger");
    }
  };

  // Like Comment Handler
  const handleLikeComment = async (commentId) => {
    setComments((prev) =>
      prev.map((c) => {
        const id = c._id || c.id;
        if (id === commentId) {
          const isLiked = !c.isLiked;
          const likesCount = (c.likesCount || 0) + (isLiked ? 1 : -1);
          return { ...c, isLiked, likesCount: Math.max(0, likesCount) };
        }
        return c;
      })
    );

    try {
      await likeCommentApi(commentId);
    } catch (err) {
      console.error("Like comment error:", err);
    }
  };

  // Upload Media Handler
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError("Please select or capture a photo or video to upload.");
      return;
    }

    setUploading(true);
    setUploadError("");

    try {
      const res = await uploadMediaApi({
        eventId,
        caption: uploadCaption,
        mediaFile: uploadFile,
      });

      if (res && res.status) {
        showToast("Media uploaded successfully!");
        setUploadFile(null);
        setCapturedPreviewUrl(null);
        setUploadCaption("");
        setShowUploadModal(false);
        stopCamera();
        if (fileInputRef.current) fileInputRef.current.value = "";
        fetchMedia();
      } else {
        setUploadError(res?.message || "Failed to upload media. Please try again.");
      }
    } catch (err) {
      console.error("Upload media error:", err);
      setUploadError(err.message || "Network error uploading file.");
    } finally {
      setUploading(false);
    }
  };

  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  if (!activeGalleryEvent) return null;

  return (
    <div
      className="modal show d-block"
      tabIndex="-1"
      style={{ backgroundColor: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(6px)", zIndex: 1060 }}
    >
      <div className="modal-dialog modal-dialog-centered modal-xl">
        <div
          className="modal-content border-0 shadow-lg overflow-hidden"
          style={{ borderRadius: "20px", backgroundColor: "#ffffff" }}
        >
          {/* Toast Notification */}
          {toastMessage && (
            <div
              className={`position-absolute top-0 start-50 translate-middle-x mt-3 alert alert-${toastMessage.type} shadow-lg rounded-pill py-2 px-4 border-0 fw-semibold d-flex align-items-center gap-2`}
              style={{ zIndex: 2000, fontSize: "13px" }}
            >
              <i
                className={`bi bi-${
                  toastMessage.type === "danger" ? "exclamation-triangle-fill" : "check-circle-fill"
                }`}
              ></i>
              <span>{toastMessage.msg}</span>
            </div>
          )}

          {/* Modal Header */}
          <div
            className="modal-header border-bottom border-light px-4 py-3 align-items-center"
            style={{ backgroundColor: "#1e293b", color: "#ffffff" }}
          >
            <div className="d-flex align-items-center gap-3">
              <div
                className="rounded-circle bg-primary bg-opacity-25 d-flex align-items-center justify-content-center text-primary"
                style={{ width: "42px", height: "42px", minWidth: "42px" }}
              >
                <i className="bi bi-images fs-5 text-white"></i>
              </div>
              <div>
                <h5 className="modal-title mb-0 fw-bold text-white fs-6">
                  {activeGalleryEvent.title || "Event"} Media Gallery
                </h5>
                <small className="text-white-50" style={{ fontSize: "12px" }}>
                  Browse photos, videos, record live & upload
                </small>
              </div>
            </div>

            <div className="d-flex align-items-center gap-2 ms-auto">
              {!activeGalleryEvent.notAcceptedMessage && (
                <button
                  type="button"
                  onClick={() => {
                    if (showUploadModal) {
                      setShowUploadModal(false);
                      stopCamera();
                    } else {
                      setShowUploadModal(true);
                    }
                    setUploadError("");
                  }}
                  className="btn btn-primary rounded-pill px-3 py-1.5 fw-semibold d-flex align-items-center gap-2 shadow-sm"
                  style={{ fontSize: "13px" }}
                >
                  <i className="bi bi-camera-video-fill fs-6"></i>
                  <span>{showUploadModal ? "Cancel Upload" : "+ Add Photo/Video"}</span>
                </button>
              )}
              <button
                type="button"
                className="btn-close btn-close-white ms-2"
                onClick={() => {
                  stopCamera();
                  onClose();
                }}
                aria-label="Close"
              ></button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="modal-body p-4" style={{ backgroundColor: "#f8fafc", minHeight: "450px" }}>
            {/* Upload & Camera Section */}
            {showUploadModal && (
              <div
                className="card border-0 shadow-sm rounded-4 p-4 mb-4"
                style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0" }}
              >
                <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                  <div className="d-flex align-items-center gap-2">
                    <button
                      type="button"
                      className={`btn btn-sm rounded-pill px-3 fw-semibold ${
                        uploadMode === "file" ? "btn-primary text-white" : "btn-outline-secondary"
                      }`}
                      style={{ fontSize: "12.5px" }}
                      onClick={() => {
                        stopCamera();
                        setUploadMode("file");
                      }}
                    >
                      <i className="bi bi-folder2-open me-1.5"></i> Choose File
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm rounded-pill px-3 fw-semibold ${
                        uploadMode === "camera" ? "btn-primary text-white" : "btn-outline-secondary"
                      }`}
                      style={{ fontSize: "12.5px" }}
                      onClick={() => {
                        setUploadMode("camera");
                        startCamera("photo");
                      }}
                    >
                      <i className="bi bi-camera-fill me-1.5"></i> Open Live Camera
                    </button>
                  </div>
                  <small className="text-muted">Supported: JPG, PNG, MP4, WEBM</small>
                </div>

                <form onSubmit={handleUploadSubmit}>
                  {uploadError && (
                    <div className="alert alert-danger py-2 px-3 small border-0 rounded-3 mb-3">
                      <i className="bi bi-exclamation-circle me-1"></i>
                      {uploadError}
                    </div>
                  )}

                  {/* Mode 1: Standard File Picker */}
                  {uploadMode === "file" && (
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label fw-semibold text-secondary small">Select File / Camera</label>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*,video/*"
                          capture="environment"
                          onChange={(e) => {
                            const file = e.target.files[0] || null;
                            setUploadFile(file);
                            if (file) {
                              setCapturedPreviewUrl(URL.createObjectURL(file));
                            } else {
                              setCapturedPreviewUrl(null);
                            }
                          }}
                          className="form-control rounded-3 border-light-subtle"
                          style={{ fontSize: "14px" }}
                        />
                        <small className="text-muted d-block mt-1" style={{ fontSize: "11px" }}>
                          <i className="bi bi-phone me-1"></i> On mobile, this opens your camera or gallery automatically.
                        </small>
                      </div>

                      <div className="col-md-6">
                        <label className="form-label fw-semibold text-secondary small">Caption / Description</label>
                        <input
                          type="text"
                          value={uploadCaption}
                          onChange={(e) => setUploadCaption(e.target.value)}
                          placeholder="Say something about this photo or video..."
                          className="form-control rounded-3 border-light-subtle"
                          style={{ fontSize: "14px" }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Mode 2: Live In-App Camera View */}
                  {uploadMode === "camera" && (
                    <div className="mb-3">
                      {/* Camera Controls Bar */}
                      <div className="d-flex align-items-center justify-content-between mb-3 bg-light p-2.5 rounded-3 border">
                        <div className="d-flex align-items-center gap-2">
                          <span className="fw-semibold text-dark small me-2">Capture Mode:</span>
                          <button
                            type="button"
                            className={`btn btn-sm rounded-pill px-3 ${
                              cameraType === "photo" ? "btn-dark text-white" : "btn-light"
                            }`}
                            style={{ fontSize: "12px" }}
                            onClick={() => startCamera("photo")}
                          >
                            <i className="bi bi-camera me-1"></i> Take Photo
                          </button>
                          <button
                            type="button"
                            className={`btn btn-sm rounded-pill px-3 ${
                              cameraType === "video" ? "btn-dark text-white" : "btn-light"
                            }`}
                            style={{ fontSize: "12px" }}
                            onClick={() => startCamera("video")}
                          >
                            <i className="bi bi-record-btn me-1"></i> Record Video
                          </button>
                        </div>

                        {cameraActive && (
                          <button
                            type="button"
                            onClick={stopCamera}
                            className="btn btn-sm btn-outline-danger rounded-pill px-3"
                            style={{ fontSize: "12px" }}
                          >
                            Stop Camera
                          </button>
                        )}
                      </div>

                      {/* Live Camera View Box */}
                      {cameraActive ? (
                        <div className="position-relative bg-dark rounded-4 overflow-hidden d-flex align-items-center justify-content-center shadow-inner mb-3" style={{ minHeight: "320px", maxHeight: "420px" }}>
                          <video
                            ref={cameraVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-100 h-100 rounded-4"
                            style={{ objectFit: "cover", maxHeight: "420px" }}
                          />

                          {/* Recording Overlay Timer */}
                          {isRecording && (
                            <div className="position-absolute top-0 start-0 m-3 bg-danger text-white rounded-pill px-3 py-1 fw-bold small d-flex align-items-center gap-2 shadow">
                              <span className="spinner-grow spinner-grow-sm text-white" role="status"></span>
                              <span>REC {formatTimer(recordingSeconds)}</span>
                            </div>
                          )}

                          {/* Live Action Trigger Buttons */}
                          <div className="position-absolute bottom-0 start-50 translate-middle-x mb-4 d-flex align-items-center gap-3">
                            {cameraType === "photo" ? (
                              <button
                                type="button"
                                onClick={snapPhoto}
                                className="btn btn-light rounded-circle shadow-lg d-flex align-items-center justify-content-center border-3 border-primary"
                                style={{ width: "64px", height: "64px" }}
                                title="Take Snap Photo"
                              >
                                <i className="bi bi-camera-fill fs-3 text-primary"></i>
                              </button>
                            ) : !isRecording ? (
                              <button
                                type="button"
                                onClick={startRecording}
                                className="btn btn-danger rounded-circle shadow-lg d-flex align-items-center justify-content-center border-3 border-white"
                                style={{ width: "64px", height: "64px" }}
                                title="Start Video Recording"
                              >
                                <i className="bi bi-record-circle-fill fs-2 text-white"></i>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={stopRecording}
                                className="btn btn-light rounded-circle shadow-lg d-flex align-items-center justify-content-center border-3 border-danger"
                                style={{ width: "64px", height: "64px" }}
                                title="Stop Recording & Save"
                              >
                                <i className="bi bi-stop-fill fs-2 text-danger"></i>
                              </button>
                            )}
                          </div>
                        </div>
                      ) : !capturedPreviewUrl ? (
                        <div className="text-center py-5 bg-light rounded-4 border border-dashed">
                          <i className="bi bi-camera-fill fs-1 text-secondary opacity-50 mb-2 d-block"></i>
                          <p className="text-muted small mb-2">Click below to enable your camera / webcam</p>
                          <button
                            type="button"
                            onClick={() => startCamera("photo")}
                            className="btn btn-primary rounded-pill px-4 fw-semibold"
                            style={{ fontSize: "13px" }}
                          >
                            <i className="bi bi-power me-1"></i> Start Camera Stream
                          </button>
                        </div>
                      ) : null}

                      {/* Caption input for camera mode */}
                      <div className="mt-3">
                        <label className="form-label fw-semibold text-secondary small">Caption / Description</label>
                        <input
                          type="text"
                          value={uploadCaption}
                          onChange={(e) => setUploadCaption(e.target.value)}
                          placeholder="Say something about this photo or video..."
                          className="form-control rounded-3 border-light-subtle"
                          style={{ fontSize: "14px" }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Captured / Selected File Preview */}
                  {capturedPreviewUrl && (
                    <div className="bg-light p-3 rounded-4 border mb-3 d-flex align-items-center justify-content-between gap-3">
                      <div className="d-flex align-items-center gap-3">
                        <div className="bg-dark rounded-3 overflow-hidden" style={{ width: "60px", height: "60px" }}>
                          {uploadFile?.type?.includes("video") ? (
                            <video src={capturedPreviewUrl} className="w-100 h-100" style={{ objectFit: "cover" }} />
                          ) : (
                            <img src={capturedPreviewUrl} alt="Preview" className="w-100 h-100" style={{ objectFit: "cover" }} />
                          )}
                        </div>
                        <div>
                          <span className="badge bg-success-subtle text-success fw-semibold mb-1" style={{ fontSize: "11px" }}>Ready to Upload</span>
                          <p className="text-dark fw-bold mb-0 small text-truncate" style={{ maxWidth: "250px" }}>
                            {uploadFile?.name || "Captured Media"}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setUploadFile(null);
                          setCapturedPreviewUrl(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        className="btn btn-sm btn-outline-danger rounded-pill px-3"
                        style={{ fontSize: "12px" }}
                      >
                        Retake / Remove
                      </button>
                    </div>
                  )}

                  {/* Form Submit Footer */}
                  <div className="d-flex justify-content-end gap-2 mt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowUploadModal(false);
                        stopCamera();
                      }}
                      className="btn btn-light rounded-pill px-4 fw-semibold text-secondary"
                      style={{ fontSize: "13px" }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={uploading || !uploadFile}
                      className="btn btn-primary rounded-pill px-4 fw-semibold text-white d-flex align-items-center gap-2"
                      style={{ fontSize: "13px" }}
                    >
                      {uploading ? (
                        <>
                          <span className="spinner-border spinner-border-sm" role="status"></span>
                          Uploading...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-cloud-arrow-up-fill"></i>
                          Upload Now
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Main Content Area */}
            {activeGalleryEvent.notAcceptedMessage ? (
              <div className="text-center py-5">
                <div
                  className="rounded-circle bg-warning bg-opacity-10 text-warning mx-auto d-flex align-items-center justify-content-center mb-3"
                  style={{ width: "64px", height: "64px" }}
                >
                  <i className="bi bi-lock-fill fs-2"></i>
                </div>
                <h6 className="fw-bold text-dark mb-1">Access Restricted</h6>
                <p className="text-muted small mb-0 max-w-md mx-auto">
                  {activeGalleryEvent.notAcceptedMessage}
                </p>
              </div>
            ) : selectedPhoto ? (
              /* Single Media Detail View (Photo/Video + Comments Panel) */
              <div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary rounded-pill mb-3 fw-semibold px-3 d-inline-flex align-items-center gap-1.5"
                  onClick={() => setSelectedPhoto(null)}
                  style={{ fontSize: "12.5px" }}
                >
                  <i className="bi bi-arrow-left"></i> Back to Gallery Grid
                </button>

                <div className="row g-4">
                  {/* Left Column: Media Display */}
                  <div className="col-lg-7">
                    <div
                      className="bg-dark rounded-4 p-2 overflow-hidden shadow-sm d-flex align-items-center justify-content-center position-relative"
                      style={{ minHeight: "350px", maxHeight: "480px" }}
                    >
                      {selectedPhoto.mediaType === "video" ? (
                        <video
                          src={selectedPhoto.url}
                          controls
                          autoPlay
                          className="w-100 rounded-3"
                          style={{ objectFit: "contain", maxHeight: "460px" }}
                        />
                      ) : (
                        <img
                          src={selectedPhoto.url}
                          alt={selectedPhoto.caption || "Event Photo"}
                          className="w-100 rounded-3"
                          style={{ objectFit: "contain", maxHeight: "460px" }}
                        />
                      )}
                    </div>

                    {/* Media Actions & Info Bar */}
                    <div className="d-flex align-items-center justify-content-between mt-3 bg-white p-3 rounded-4 shadow-sm border border-light">
                      <div className="d-flex align-items-center gap-3">
                        {/* Like Button */}
                        <button
                          type="button"
                          onClick={(e) => handleLikeMedia(selectedPhoto, e)}
                          className={`btn btn-sm rounded-pill px-3 py-1.5 d-flex align-items-center gap-1.5 fw-semibold transition-all ${
                            selectedPhoto.isLiked
                              ? "btn-danger text-white shadow-sm"
                              : "btn-outline-danger"
                          }`}
                          style={{ fontSize: "13px" }}
                        >
                          <i className={`bi bi-heart${selectedPhoto.isLiked ? "-fill" : ""}`}></i>
                          <span>{selectedPhoto.likesCount} Likes</span>
                        </button>

                        {/* Comments Count Badge */}
                        <span className="text-secondary small fw-medium d-flex align-items-center gap-1">
                          <i className="bi bi-chat-left-text text-primary"></i>
                          {selectedPhoto.commentsCount} Comments
                        </span>
                      </div>

                      {/* Delete Media Button */}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteMedia(selectedPhoto.id, e)}
                        className="btn btn-sm btn-outline-secondary rounded-circle d-flex align-items-center justify-content-center"
                        style={{ width: "36px", height: "36px" }}
                        title="Delete Media"
                      >
                        <i className="bi bi-trash text-danger"></i>
                      </button>
                    </div>

                    {selectedPhoto.caption && (
                      <div className="bg-white p-3 rounded-4 shadow-sm border border-light mt-2">
                        <small className="text-muted fw-semibold uppercase d-block mb-1" style={{ fontSize: "11px" }}>Caption</small>
                        <p className="text-dark fw-medium mb-0 small">{selectedPhoto.caption}</p>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Comments Section */}
                  <div className="col-lg-5">
                    <div
                      className="card border-0 shadow-sm rounded-4 d-flex flex-column h-100 bg-white"
                      style={{ border: "1px solid #e2e8f0", minHeight: "450px", maxHeight: "550px" }}
                    >
                      {/* Comments Header */}
                      <div className="p-3 border-bottom d-flex align-items-center justify-content-between">
                        <h6 className="fw-bold text-dark m-0 d-flex align-items-center gap-2 fs-6">
                          <i className="bi bi-chat-dots-fill text-primary"></i>
                          Comments ({comments.length})
                        </h6>
                        {loadingComments && (
                          <span className="spinner-border spinner-border-sm text-primary" role="status"></span>
                        )}
                      </div>

                      {/* Comments List */}
                      <div
                        className="p-3 flex-grow-1 overflow-y-auto"
                        style={{ maxHeight: "360px", backgroundColor: "#f8fafc" }}
                      >
                        {loadingComments ? (
                          <div className="text-center py-4 text-muted small">
                            <span className="spinner-border spinner-border-sm me-2"></span>
                            Loading comments...
                          </div>
                        ) : comments.length === 0 ? (
                          <div className="text-center py-5 text-muted">
                            <i className="bi bi-chat-square-quote fs-3 text-secondary opacity-50 mb-2 d-block"></i>
                            <p className="small mb-0">No comments yet. Be the first to comment!</p>
                          </div>
                        ) : (
                          <div className="d-flex flex-column gap-2.5">
                            {comments.map((c, i) => {
                              const commentId = c._id || c.id;
                              const authorName =
                                c.userName ||
                                c.user?.fullName ||
                                c.userId?.fullName ||
                                c.fullName ||
                                "User";
                              const text = c.comment || c.text || "";
                              const commentLikes = c.likesCount || 0;
                              const isCommentLiked = !!c.isLiked;

                              return (
                                <div
                                  key={commentId || i}
                                  className="bg-white p-3 rounded-3 shadow-xs border border-light position-relative"
                                >
                                  <div className="d-flex align-items-start justify-content-between gap-2 mb-1">
                                    <span className="fw-bold text-dark small">{authorName}</span>
                                    <div className="d-flex align-items-center gap-2">
                                      {/* Like Comment Button */}
                                      <button
                                        type="button"
                                        onClick={() => handleLikeComment(commentId)}
                                        className={`btn btn-link p-0 text-decoration-none border-0 small ${
                                          isCommentLiked ? "text-danger" : "text-muted"
                                        }`}
                                        style={{ fontSize: "11px" }}
                                        title="Like comment"
                                      >
                                        <i className={`bi bi-heart${isCommentLiked ? "-fill" : ""}`}></i>
                                        {commentLikes > 0 && <span className="ms-1">{commentLikes}</span>}
                                      </button>

                                      {/* Delete Comment Button */}
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteComment(commentId)}
                                        className="btn btn-link p-0 text-muted hover-text-danger border-0"
                                        style={{ fontSize: "11px" }}
                                        title="Delete comment"
                                      >
                                        <i className="bi bi-x-circle text-secondary"></i>
                                      </button>
                                    </div>
                                  </div>
                                  <p className="text-secondary small mb-0 text-break" style={{ fontSize: "13px" }}>
                                    {text}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Comment Input Footer */}
                      <form onSubmit={handlePostComment} className="p-3 border-top bg-white">
                        <div className="input-group">
                          <input
                            type="text"
                            value={newCommentText}
                            onChange={(e) => setNewCommentText(e.target.value)}
                            placeholder="Write a comment..."
                            className="form-control rounded-pill-start border-light-subtle px-3"
                            style={{ fontSize: "13px", height: "42px" }}
                          />
                          <button
                            type="submit"
                            disabled={postingComment || !newCommentText.trim()}
                            className="btn btn-primary rounded-pill-end px-3 d-flex align-items-center justify-content-center"
                            style={{ height: "42px" }}
                          >
                            {postingComment ? (
                              <span className="spinner-border spinner-border-sm" role="status"></span>
                            ) : (
                              <i className="bi bi-send-fill text-white"></i>
                            )}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            ) : loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary mb-2" role="status"></div>
                <p className="text-muted small mb-0">Loading event photos and videos...</p>
              </div>
            ) : mediaList.length === 0 ? (
              <div className="text-center py-5">
                <div
                  className="rounded-circle bg-light text-secondary mx-auto d-flex align-items-center justify-content-center mb-3"
                  style={{ width: "64px", height: "64px" }}
                >
                  <i className="bi bi-images fs-2"></i>
                </div>
                <h6 className="fw-bold text-dark mb-1">No media found</h6>
                <p className="text-muted small mb-3">No photos or videos uploaded yet for this event.</p>
                <button
                  type="button"
                  onClick={() => setShowUploadModal(true)}
                  className="btn btn-sm btn-primary rounded-pill px-4 fw-semibold"
                >
                  <i className="bi bi-camera-video-fill me-1.5"></i> Be the first to add media
                </button>
              </div>
            ) : (
              /* Media Grid View */
              <div className="row g-3">
                {mediaList.map((photo) => (
                  <div key={photo.id} className="col-lg-4 col-md-6 col-12">
                    <div
                      className="card border-0 shadow-sm rounded-4 overflow-hidden position-relative bg-white h-100 transition-all hover-shadow"
                      style={{ cursor: "pointer", border: "1px solid #f1f5f9" }}
                      onClick={() => setSelectedPhoto(photo)}
                    >
                      {/* Media Thumbnail Container */}
                      <div className="position-relative w-100 overflow-hidden bg-dark" style={{ height: "180px" }}>
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
                            alt={photo.caption || "Event Preview"}
                            className="w-100 h-100"
                            style={{ objectFit: "cover" }}
                            onError={(e) => {
                              e.target.src =
                                "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=600&q=80";
                            }}
                          />
                        )}

                        {/* Video Badge */}
                        {photo.mediaType === "video" && (
                          <div
                            className="position-absolute top-50 start-50 translate-middle text-white bg-dark bg-opacity-60 rounded-circle d-flex align-items-center justify-content-center shadow"
                            style={{ width: "44px", height: "44px", backdropFilter: "blur(4px)" }}
                          >
                            <i className="bi bi-play-fill fs-3 text-white ms-0.5"></i>
                          </div>
                        )}

                        {/* Caption Overlay */}
                        {photo.caption && (
                          <div
                            className="position-absolute bottom-0 start-0 end-0 bg-dark bg-opacity-60 p-2 text-white text-truncate small"
                            style={{ fontSize: "11.5px", backdropFilter: "blur(2px)" }}
                          >
                            {photo.caption}
                          </div>
                        )}
                      </div>

                      {/* Card Footer Actions (Like, Comment, Delete) */}
                      <div className="p-3 d-flex align-items-center justify-content-between bg-white border-top border-light">
                        <div className="d-flex align-items-center gap-3">
                          {/* Like Button */}
                          <button
                            type="button"
                            onClick={(e) => handleLikeMedia(photo, e)}
                            className={`btn btn-link p-0 text-decoration-none border-0 small d-flex align-items-center gap-1 ${
                              photo.isLiked ? "text-danger fw-bold" : "text-muted"
                            }`}
                            style={{ fontSize: "13px" }}
                            title="Like photo"
                          >
                            <i className={`bi bi-heart${photo.isLiked ? "-fill text-danger" : ""}`}></i>
                            <span>{photo.likesCount}</span>
                          </button>

                          {/* Comments Count */}
                          <span className="text-muted small d-flex align-items-center gap-1" style={{ fontSize: "13px" }}>
                            <i className="bi bi-chat-left-text text-primary"></i>
                            <span>{photo.commentsCount}</span>
                          </span>
                        </div>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={(e) => handleDeleteMedia(photo.id, e)}
                          className="btn btn-link p-0 text-muted hover-text-danger border-0"
                          title="Delete Media"
                          style={{ fontSize: "13px" }}
                        >
                          <i className="bi bi-trash"></i>
                        </button>
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
  );
}
