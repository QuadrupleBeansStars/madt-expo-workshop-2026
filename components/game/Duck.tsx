export function Duck({ bubble, size = 64 }: { bubble?: string; size?: number }) {
  return (
    <div className="flex items-start gap-3">
      <svg viewBox="0 0 64 64" width={size} height={size} className="flex-shrink-0" aria-label="AI duck">
        <rect x="24" y="6" width="16" height="8" fill="#5c4a3c" />
        <rect x="20" y="14" width="24" height="3" fill="#5c4a3c" />
        <rect x="22" y="17" width="20" height="18" fill="#ffd23f" />
        <rect x="26" y="22" width="4" height="4" fill="#111" />
        <rect x="12" y="24" width="10" height="6" fill="#ff7f50" />
        <rect x="18" y="35" width="28" height="20" fill="#ffd23f" />
        <rect x="24" y="37" width="18" height="14" fill="#4a3b32" />
        <rect x="20" y="35" width="24" height="4" fill="#322721" />
      </svg>
      {bubble ? <div className="duck-bubble" style={{ fontFamily: 'var(--font-thai), sans-serif' }}>{bubble}</div> : null}
    </div>
  )
}
