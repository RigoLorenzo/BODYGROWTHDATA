export { auth as default } from "@/lib/auth";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/calendar/:path*",
    "/history/:path*",
    "/analytics/:path*",
    "/fitness/:path*",
    "/plan/:path*",
    "/welcome/:path*",
    "/profile/:path*",
    "/workout/:path*",
    "/run/:path*",
    "/wellness/:path*",
    "/coach/:path*",
  ],
};
