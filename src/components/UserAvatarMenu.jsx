import { useState } from "react";

// Header avatar. Starts grayscale, transitions to full color on hover.
// Sized to match the icon-button cluster next to it (padding 6 around a
// 16px-square avatar circle ⇒ 28×28 hit area, matching the theme/logout
// buttons exactly).
export default function UserAvatarMenu({ session, onClick }) {
  const [pictureFailed, setPictureFailed] = useState(false);

  if (!session?.user) return null;
  const meta = session.user.user_metadata ?? {};
  const displayName = meta.full_name || meta.name || session.user.email;
  const picture = !pictureFailed ? (meta.avatar_url || meta.picture) : null;
  const initial = (displayName?.[0] ?? "?").toUpperCase();

  return (
    <button
      onClick={onClick}
      title={`${displayName} — settings`}
      aria-label={`Open settings (${displayName})`}
      className="group bg-transparent border-0 p-1.5 cursor-pointer flex items-center justify-center shrink-0"
    >
      <span
        className="block w-4 h-4 rounded-full overflow-hidden grayscale transition-[filter] duration-200 group-hover:grayscale-0"
      >
        {picture ? (
          <img
            src={picture}
            alt=""
            width={16}
            height={16}
            referrerPolicy="no-referrer"
            onError={() => setPictureFailed(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="flex items-center justify-center w-full h-full bg-accent text-on-accent text-[9px] font-bold">
            {initial}
          </span>
        )}
      </span>
    </button>
  );
}
