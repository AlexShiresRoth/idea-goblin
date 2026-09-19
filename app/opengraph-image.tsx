import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site";

export const alt = siteConfig.name;
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "#0a0a0a",
          color: "#ededed",
        }}
      >
        <div style={{ fontSize: 72, fontWeight: 700 }}>{siteConfig.name}</div>
        <div style={{ fontSize: 32, marginTop: 24, color: "#a1a1aa" }}>
          {siteConfig.tagline}
        </div>
      </div>
    ),
    { ...size },
  );
}
