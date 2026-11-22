import { React } from "../react";
export function DeviceIcon({
  kind,
  size = 16,
}: {
  kind: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === "chevron" ? (
        <path d="m7 10 5 5 5-5" />
      ) : kind === "charging" ? (
        <path d="m13 3-8 10h6l-1 8 9-11h-6l1-7Z" />
      ) : kind === "eye" || kind === "eyeOff" ? (
        <>
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          {kind === "eyeOff" && <path d="m3 3 18 18" />}
        </>
      ) : kind === "bell" || kind === "bellOff" ? (
        <>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
          {kind === "bellOff" && <path d="m3 3 18 18" />}
        </>
      ) : kind === "headset" ? (
        <>
          <path d="M3 13v-2a9 9 0 0 1 18 0v2" />
          <rect x="3" y="11" width="4" height="9" rx="2" />
          <rect x="17" y="11" width="4" height="9" rx="2" />
        </>
      ) : kind === "mouse" ? (
        <>
          <rect x="6" y="3" width="12" height="18" rx="6" />
          <path d="M12 6v4" />
        </>
      ) : kind === "keyboard" ? (
        <>
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M9 14h6M18 14h.01" />
        </>
      ) : kind === "gamepad" ? (
        <>
          <path d="M6 8h12c3 0 4 5 4 9 0 2-2 3-4 1l-2-2H8l-2 2c-2 2-4 1-4-1 0-4 1-9 4-9ZM7 10v4M5 12h4" />
          <circle cx="16" cy="11" r=".5" />
          <circle cx="18" cy="13" r=".5" />
        </>
      ) : (
        <>
          <rect x="3" y="6" width="17" height="12" rx="2" />
          <path d="M22 10v4M7 10v4M11 10v4M15 10v4" />
        </>
      )}
    </svg>
  );
}
