import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Commit del deploy, per accorgersi lato client che ne è uscito uno nuovo
  env: { NEXT_PUBLIC_APP_VERSION: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev" },
  // Font letti da disco per l'immagine di condivisione: vanno nel bundle della funzione
  outputFileTracingIncludes: {
    "/api/sessions/[sessionId]/share-image": ["./src/assets/fonts/*.woff"],
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
