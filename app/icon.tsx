import { ImageResponse } from "next/og";

// Image metadata
export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

// Icon generation
export default function Icon() {
  return new ImageResponse(
    // ImageResponse render element
    <div
      style={{
        fontSize: 24,
        background: "black",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "20%",
        border: "1px solid rgba(255,255,255,0.1)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Left side - Human (Green) */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "50%",
          height: "100%",
          backgroundColor: "#4ade80",
        }}
      />
      {/* Right side - AI (Purple) */}
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          width: "50%",
          height: "100%",
          backgroundColor: "#a78bfa",
        }}
      />
      {/* Minimalist divider */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "15%",
          width: "1px",
          height: "70%",
          backgroundColor: "black",
          opacity: 0.2,
          transform: "translateX(-0.5px)",
        }}
      />
    </div>,
    // ImageResponse options
    {
      ...size,
    }
  );
}
