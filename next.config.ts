import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Phones join over the LAN by IP, not localhost. Next blocks cross-origin requests
  // to dev resources (/_next/webpack-hmr) by default, which silently breaks hydration:
  // the pages still render, but nothing is clickable and the TV's QR code never appears.
  // Wildcards match per dot-segment, so these cover any private-range IPv4 the venue
  // hands us without hardcoding today's address. Dev-only; ignored by `next start`.
  allowedDevOrigins: ['10.*.*.*', '192.168.*.*', '172.*.*.*'],
};

export default nextConfig;
