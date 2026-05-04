import { useState } from "react";
import { T } from "../theme.js";

// Header avatar. Starts grayscale, transitions to full color on hover.
// Sized to match the icon-button cluster next to it (padding 6 around a
// 16px-square avatar circle ⇒ 28×28 hit area, matching the theme/logout
// buttons exactly).
export default function UserAvatarMenu({ session, onClick }) {
  const [hover, setHover] = useState(false);
  const [pictureFailed, setPictureFailed] = useState(false);

  if (!session?.user) return null;
  const meta = session.user.user_metadata ?? {};
  const displayName = meta.full_name || meta.name || session.user.email;
  const picture = !pictureFailed ? (meta.avatar_url || meta.picture) : null;
  const initial = (displayName?.[0] ?? "?").toUpperCase();

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={`${displayName} — settings`}
      aria-label={`Open settings (${displayName})`}
      style={{
        background: "transparent",
        border: "none",
        padding: 6,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          filter: hover ? "grayscale(0)" : "grayscale(1)",
          transition: "filter 220ms ease"
        }}
      >
        {picture ? (
          <img
            src={picture}
            alt=""
            width={16}
            height={16}
            referrerPolicy="no-referrer"
            onError={() => setPictureFailed(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span style={{
            width: "100%", height: "100%",
            background: T.accent, color: T.onAccent,
            fontSize: 9, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            {initial}
          </span>
        )}
      </span>
    </button>
  );
}
