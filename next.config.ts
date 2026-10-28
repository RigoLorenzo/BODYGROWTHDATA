import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Font letti da disco per l'immagine di condivisione: vanno nel bundle della funzione
  outputFileTracingIncludes: {
    "/api/sessions/[sessionId]/share-image": ["./src/assets/fonts/*.woff", "./public/icon-192.png"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "*.vercel-storage.com" },
    ],
  },
};

export default nextConfig;
