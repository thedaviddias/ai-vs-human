import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  try {
    return new ImageResponse(
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#050505",
          color: "#fff",
          padding: "80px",
          position: "relative",
        }}
      >
        {/* Background decoration */}
        <div
          style={{
            position: "absolute",
            top: "-20%",
            left: "-10%",
            width: "140%",
            height: "140%",
            backgroundImage:
              "radial-gradient(circle at center, rgba(74, 222, 128, 0.05) 0%, rgba(167, 139, 250, 0.05) 50%, transparent 100%)",
          }}
        />

        {/* Central Logo/Graphic */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            marginBottom: "40px",
          }}
        >
          <div
            style={{
              display: "flex",
              width: "120px",
              height: "120px",
              borderRadius: "30px",
              border: "2px solid rgba(255,255,255,0.1)",
              position: "relative",
              overflow: "hidden",
              marginRight: "32px",
            }}
          >
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
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "15%",
                width: "2px",
                height: "70%",
                backgroundColor: "#050505",
                opacity: 0.2,
                transform: "translateX(-1px)",
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                fontSize: "80px",
                fontWeight: "bold",
                letterSpacing: "-0.04em",
                lineHeight: 1,
              }}
            >
              AI vs Human
            </div>
            <div
              style={{
                display: "flex",
                fontSize: "28px",
                color: "#737373",
                fontWeight: 500,
                marginTop: "12px",
              }}
            >
              Who's writing open source?
            </div>
          </div>
        </div>

        {/* Feature Pills */}
        <div style={{ display: "flex", flexDirection: "row", gap: "24px", marginTop: "40px" }}>
          <div
            style={{
              display: "flex",
              padding: "12px 24px",
              backgroundColor: "rgba(255,255,255,0.05)",
              borderRadius: "100px",
              border: "1px solid rgba(255,255,255,0.1)",
              fontSize: "20px",
              fontWeight: 600,
              color: "#d4d4d4",
            }}
          >
            Granular AI Detection
          </div>
          <div
            style={{
              display: "flex",
              padding: "12px 24px",
              backgroundColor: "rgba(255,255,255,0.05)",
              borderRadius: "100px",
              border: "1px solid rgba(255,255,255,0.1)",
              fontSize: "20px",
              fontWeight: 600,
              color: "#d4d4d4",
            }}
          >
            Developer Ranks
          </div>
          <div
            style={{
              display: "flex",
              padding: "12px 24px",
              backgroundColor: "rgba(255,255,255,0.05)",
              borderRadius: "100px",
              border: "1px solid rgba(255,255,255,0.1)",
              fontSize: "20px",
              fontWeight: 600,
              color: "#d4d4d4",
            }}
          >
            Activity Timelines
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            bottom: "60px",
            color: "#404040",
            fontSize: "20px",
            fontWeight: "bold",
          }}
        >
          aivshuman.thedaviddias.com
        </div>
      </div>,
      {
        width: 1200,
        height: 630,
        headers: {
          "cache-control": "public, max-age=31536000, s-maxage=31536000",
        },
      }
    );
  } catch (e) {
    console.error(e);
    return new Response("Failed to generate image", { status: 500 });
  }
}
