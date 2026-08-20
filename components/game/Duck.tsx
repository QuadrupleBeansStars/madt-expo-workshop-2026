/**
 * `size` is any CSS length, not a pixel count — `/tv` sizes the duck in `vh` so it scales with the
 * projector like everything else on that screen (spec §1). A bare number still works and is still
 * read as pixels, which is what the phone wants.
 */
export function Duck({ bubble, size = 64 }: { bubble?: string; size?: number | string }) {
  return (
    <div className="flex items-start gap-3">
      {/* Sized through `style`, not the width/height ATTRIBUTES: an SVG presentation attribute
          takes a plain number of user units, so a `vh` string there is ignored outright. */}
      <svg viewBox="0 0 64 64" style={{ width: size, height: size }} className="flex-shrink-0" aria-label="เป็ดนักสืบ">
        {/* A DEERSTALKER, not a flat cap: the brim wider than the head with a flap either side is
            what makes the silhouette read as "detective" at projector distance, where the hat is
            about twelve pixels tall and nothing inside it is legible. */}
        <rect x="24" y="5" width="16" height="7" fill="#6b5443" />
        <rect x="24" y="5" width="16" height="2" fill="#7d6450" />
        <rect x="22" y="11" width="20" height="2" fill="#3a2e26" />
        <rect x="16" y="13" width="32" height="3" fill="#5c4a3c" />
        <rect x="18" y="16" width="4" height="5" fill="#5c4a3c" />
        <rect x="42" y="16" width="4" height="5" fill="#5c4a3c" />

        <rect x="22" y="16" width="20" height="18" fill="#ffd23f" />
        <rect x="26" y="21" width="4" height="4" fill="#111" />
        <rect x="27" y="22" width="2" height="2" fill="#fff" />
        <rect x="12" y="24" width="10" height="5" fill="#ff9f43" />
        <rect x="12" y="27" width="10" height="2" fill="#e8822b" />

        <rect x="18" y="34" width="26" height="20" fill="#ffd23f" />
        <rect x="22" y="39" width="13" height="10" fill="#e8b830" />
        <rect x="18" y="34" width="26" height="3" fill="#e8b830" />

        {/* The magnifying glass, held up rather than resting: raised to eye height is the pose that
            says "looking into this", which is the duck's whole job on the reveal. */}
        <rect x="41" y="40" width="7" height="4" fill="#e8b830" />
        <rect x="49" y="41" width="4" height="10" fill="#8a5a2b" />
        <rect x="49" y="41" width="2" height="10" fill="#a06d36" />
        <rect x="45" y="26" width="14" height="3" fill="#cbd5e1" />
        <rect x="45" y="37" width="14" height="3" fill="#cbd5e1" />
        <rect x="45" y="29" width="3" height="8" fill="#cbd5e1" />
        <rect x="56" y="29" width="3" height="8" fill="#cbd5e1" />
        <rect x="48" y="29" width="8" height="8" fill="#bfe6ff" opacity="0.55" />
        <rect x="49" y="30" width="3" height="3" fill="#ffffff" opacity="0.8" />
      </svg>
      {bubble ? <div className="duck-bubble" style={{ fontFamily: 'var(--font-thai), sans-serif' }}>{bubble}</div> : null}
    </div>
  )
}
