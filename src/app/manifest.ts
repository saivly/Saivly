import type { MetadataRoute } from "next";

/** Home-screen / install icon. Square tiles: the OS applies its own mask. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Saivly",
    short_name: "Saivly",
    start_url: "/",
    display: "standalone",
    background_color: "#0f1b2d",
    theme_color: "#0f1b2d",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
