import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Phones join over the LAN by IP, not localhost. Next blocks cross-origin requests
  // to dev resources (/_next/webpack-hmr) by default, which silently breaks hydration:
  // the pages still render, but nothing is clickable and the TV's QR code never appears.
  // Wildcards match per dot-segment, so these cover any private-range IPv4 the venue
  // hands us without hardcoding today's address. Dev-only; ignored by `next start`.
  allowedDevOrigins: ['10.*.*.*', '192.168.*.*', '172.*.*.*'],

  experimental: {
    // `stages.css` is imported by both Stages.tsx and Leaderboard.tsx, and `room.css` by Bars.tsx
    // and DataPanel.tsx — the same sheets reached through different import orders. The default
    // chunker (`cssChunking: true`) is allowed to merge and re-order sheets on the assumption
    // that files imported in inconsistent orders have no dependencies between them. Here it
    // emitted a <link> to a chunk it never wrote: /biz requested 3n45fc8is_965.css, got a 404,
    // and rendered the entire projector deck unstyled — 16px black-on-white text on the screen
    // the room is looking at. `next build` reported success.
    //
    // 'strict' keeps sheets in their import order, at the cost of a few more requests. On a LAN
    // with one projector and 200 phones that cost is irrelevant, and the failure it prevents is
    // total. See node_modules/next/dist/docs/.../cssChunking.md.
    cssChunking: 'strict',
  },
};

export default nextConfig;
