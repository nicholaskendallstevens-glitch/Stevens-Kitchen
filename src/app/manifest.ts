import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME.split(" ").slice(-1)[0] === "Kitchen" ? "Kitchen" : APP_NAME,
    description: "Our recipes, week plan and shopping list",
    start_url: "/plan",
    display: "standalone",
    background_color: "#f7f3ec",
    theme_color: "#f7f3ec",
    orientation: "portrait",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
