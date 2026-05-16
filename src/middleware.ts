export { auth as default } from "@/lib/auth";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/calendar/:path*",
    "/analytics/:path*",
    "/profile/:path*",
    "/workout/:path*",
  ],
};
