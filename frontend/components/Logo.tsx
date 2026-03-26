interface LogoProps {
  size?: number;
  showText?: boolean;
}

export function Logo({ size = 32, showText = true }: LogoProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" rx="8" fill="var(--text)" />
        {/* Shield shape */}
        <path
          d="M16 5L7 9v7c0 5 3.9 9.7 9 11 5.1-1.3 9-6 9-11V9L16 5z"
          fill="none"
          stroke="var(--bg)"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        {/* Checkmark */}
        <path
          d="M12 16l2.5 2.5L20 13"
          stroke="var(--bg)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {showText && (
        <span style={{
          color: "var(--text)",
          fontWeight: 700,
          fontSize: size * 0.44,
          letterSpacing: "-0.4px",
          fontFamily: "inherit",
        }}>
          ThinkTrace
        </span>
      )}
    </div>
  );
}
