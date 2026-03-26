import React from "react";

interface IconProps {
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}

const base = (size: number, color: string, children: React.ReactNode) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
       xmlns="http://www.w3.org/2000/svg">
    {children}
  </svg>
);

export const IconSearch = ({ size = 20, color = "currentColor", style }: IconProps) => (
  <span style={style}>{base(size, color, <>
    <circle cx="11" cy="11" r="7" />
    <line x1="16.5" y1="16.5" x2="22" y2="22" />
  </>)}</span>
);

export const IconFileText = ({ size = 20, color = "currentColor", style }: IconProps) => (
  <span style={style}>{base(size, color, <>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14,2 14,8 20,8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10,9 9,9 8,9" />
  </>)}</span>
);

export const IconGlobe = ({ size = 20, color = "currentColor", style }: IconProps) => (
  <span style={style}>{base(size, color, <>
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </>)}</span>
);

export const IconEye = ({ size = 20, color = "currentColor", style }: IconProps) => (
  <span style={style}>{base(size, color, <>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </>)}</span>
);

export const IconFlask = ({ size = 20, color = "currentColor", style }: IconProps) => (
  <span style={style}>{base(size, color, <>
    <path d="M9 3h6M9 3v6l-4 8a1 1 0 0 0 .9 1.5h12.2A1 1 0 0 0 19 17l-4-8V3" />
    <path d="M7.5 15h9" />
  </>)}</span>
);

export const IconUsers = ({ size = 20, color = "currentColor", style }: IconProps) => (
  <span style={style}>{base(size, color, <>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </>)}</span>
);

export const IconNewspaper = ({ size = 20, color = "currentColor", style }: IconProps) => (
  <span style={style}>{base(size, color, <>
    <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
    <path d="M18 14h-8" />
    <path d="M15 18h-5" />
    <path d="M10 6h8v4h-8V6z" />
  </>)}</span>
);

export const IconGraduationCap = ({ size = 20, color = "currentColor", style }: IconProps) => (
  <span style={style}>{base(size, color, <>
    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
    <path d="M6 12v5c3 3 9 3 12 0v-5" />
  </>)}</span>
);

export const IconScale = ({ size = 20, color = "currentColor", style }: IconProps) => (
  <span style={style}>{base(size, color, <>
    <line x1="12" y1="3" x2="12" y2="21" />
    <path d="M3 6l9-3 9 3" />
    <path d="M3 6l4.5 9a4.5 4.5 0 0 1-9 0L3 6z" />
    <path d="M21 6l-4.5 9a4.5 4.5 0 0 1-9 0L21 6z" />
  </>)}</span>
);

export const IconBriefcase = ({ size = 20, color = "currentColor", style }: IconProps) => (
  <span style={style}>{base(size, color, <>
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </>)}</span>
);

export const IconBarChart = ({ size = 20, color = "currentColor", style }: IconProps) => (
  <span style={style}>{base(size, color, <>
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
    <line x1="2" y1="20" x2="22" y2="20" />
  </>)}</span>
);

export const IconGitBranch = ({ size = 20, color = "currentColor", style }: IconProps) => (
  <span style={style}>{base(size, color, <>
    <line x1="6" y1="3" x2="6" y2="15" />
    <circle cx="18" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M18 9a9 9 0 0 1-9 9" />
  </>)}</span>
);

export const IconShield = ({ size = 20, color = "currentColor", style }: IconProps) => (
  <span style={style}>{base(size, color, <>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </>)}</span>
);

export const IconZap = ({ size = 20, color = "currentColor", style }: IconProps) => (
  <span style={style}>{base(size, color, <>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </>)}</span>
);

export const IconMap = ({ size = 20, color = "currentColor", style }: IconProps) => (
  <span style={style}>{base(size, color, <>
    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
    <line x1="8" y1="2" x2="8" y2="18" />
    <line x1="16" y1="6" x2="16" y2="22" />
  </>)}</span>
);

export const IconAlertTriangle = ({ size = 20, color = "currentColor", style }: IconProps) => (
  <span style={style}>{base(size, color, <>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </>)}</span>
);

export const IconCheckCircle = ({ size = 20, color = "currentColor", style }: IconProps) => (
  <span style={style}>{base(size, color, <>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </>)}</span>
);
