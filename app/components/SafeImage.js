"use client";

import { useMemo, useState } from "react";

const variantIcons = {
  event: "fa-regular fa-calendar",
  reservation: "fa-solid fa-ticket",
  merchant: "fa-solid fa-store",
  profile: "fa-regular fa-user",
  default: "fa-regular fa-image",
};

const isUsableImageSrc = (src) => {
  if (typeof src !== "string") return false;
  const value = src.trim();
  if (!value || value === "null" || value === "undefined") return false;
  return /^(https?:\/\/|data:image\/|blob:|\/|images\/|\.\/|\.\.\/)/i.test(value);
};

export default function SafeImage({
  src,
  alt = "",
  className = "",
  style,
  width,
  height,
  fallbackLabel,
  fallbackSubLabel,
  variant = "default",
}) {
  const [failed, setFailed] = useState(false);
  const imageSrc = useMemo(() => (typeof src === "string" ? src.trim() : ""), [src]);
  const canRenderImage = isUsableImageSrc(imageSrc) && !failed;
  const iconClass = variantIcons[variant] || variantIcons.default;

  if (canRenderImage) {
    return (
      <img
        src={imageSrc}
        alt={alt}
        className={className}
        style={style}
        width={width}
        height={height}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className={`image-fallback image-fallback-${variant} ${className}`}
      style={style}
      role="img"
      aria-label={alt || fallbackLabel || "Image unavailable"}
    >
      <span className="image-fallback-icon">
        <i className={iconClass}></i>
      </span>
      {fallbackLabel && <strong>{fallbackLabel}</strong>}
      {fallbackSubLabel && <small>{fallbackSubLabel}</small>}
    </div>
  );
}
