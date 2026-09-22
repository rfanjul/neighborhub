import React from 'react';
import Svg, { Path, Circle, Ellipse, Rect, Line } from 'react-native-svg';

type IconProps = { size?: number; color?: string; strokeWidth?: number };

export function HeartHandsIcon({ size = 24, color = '#DD6B3E', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21s-7-4.35-9.5-8.5C.5 8.5 2.5 5 6 5c2 0 3.5 1.2 4.5 2.6C11.5 6.2 13 5 15 5c3.5 0 5.5 3.5 3.5 7.5C19.5 16.65 12 21 12 21z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CoinIcon({ size = 24, color = '#DD6B3E', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={8} stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M9.5 12.5c.3.9 1.2 1.4 2.5 1.4s2-.6 2-1.4c0-2-4.5-1.3-4.5-3.4 0-.8.7-1.4 2-1.4s2.2.5 2.5 1.4"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line x1={12} y1={7.2} x2={12} y2={8.2} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1={12} y1={15.8} x2={12} y2={16.8} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function NeighborsIcon({ size = 24, color = '#3E6BDD', strokeWidth = 1.6 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={8.5} cy={9} r={3} stroke={color} strokeWidth={strokeWidth} />
      <Circle cx={16} cy={9} r={3} stroke={color} strokeWidth={strokeWidth} />
      <Path d="M2.5 19c.6-3.2 3-5 6-5s5.4 1.8 6 5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12.5 14.3c.7-.2 1.5-.3 2.5-.3 3 0 5.4 1.8 6 5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function PaintIcon({ size = 24, color = '#B4472A', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={4} width={12} height={6} rx={1.5} stroke={color} strokeWidth={strokeWidth} />
      <Path d="M10 10v4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M10 14h6a2 2 0 0 1 2 2v3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function PawIcon({ size = 24, color = '#4C8C6B', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Ellipse cx={8} cy={8} rx={1.6} ry={2} stroke={color} strokeWidth={strokeWidth} />
      <Ellipse cx={12.5} cy={6.3} rx={1.6} ry={2} stroke={color} strokeWidth={strokeWidth} />
      <Ellipse cx={16.5} cy={8} rx={1.6} ry={2} stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M8 14.5c0-2.5 2-4 4.2-4s4.2 1.5 4.2 4c0 2-1.8 3.5-4.2 3.5S8 16.5 8 14.5z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function BagIcon({ size = 24, color = '#8A6A2E', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 8h12l-1 12H7L6 8z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9 8V6a3 3 0 0 1 6 0v2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function HomeIcon({ size = 22, color = '#8C7C72', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 11.5 12 4l8 7.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M6 10v9h12v-9" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function MapIcon({ size = 22, color = '#8C7C72', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9 4v13M15 6.5v13" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function ChatIcon({ size = 22, color = '#8C7C72', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 5h16v11H8l-4 4V5z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ProfileIcon({ size = 22, color = '#8C7C72', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={3.2} stroke={color} strokeWidth={strokeWidth} />
      <Path d="M5 20c1.2-4 4-6 7-6s5.8 2 7 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function PlusIcon({ size = 22, color = '#FFFFFF', strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function BackIcon({ size = 18, color = '#33261F', strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="m15 18-6-6 6-6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CloseIcon({ size = 14, color = '#33261F', strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 6l12 12M18 6 6 18" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function SearchIcon({ size = 16, color = '#8C7C72', strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={strokeWidth} />
      <Path d="m21 21-4.3-4.3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function FilterIcon({ size = 18, color = '#33261F', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 6h16M7 12h10M10 18h4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function SendIcon({ size = 18, color = '#FFFFFF', strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="m5 12 14-7-7 14-2-5-5-2z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function SettingsIcon({ size = 15, color = '#33261F', strokeWidth = 1.6 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function GoogleIcon({ size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M22.5 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.9a5.05 5.05 0 0 1-2.19 3.32v2.75h3.55c2.08-1.92 3.24-4.74 3.24-8.08z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.67l-3.55-2.75c-.98.66-2.24 1.05-3.73 1.05-2.87 0-5.3-1.94-6.17-4.53H2.16v2.84A11 11 0 0 0 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.83 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.16a11 11 0 0 0 0 9.88l3.67-2.84z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.84 6.06l3.67 2.84C6.7 7.32 9.13 5.38 12 5.38z"
        fill="#EA4335"
      />
    </Svg>
  );
}

export function AppleIcon({ size = 18, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M16.5 8.1c-1.1 0-2.1.6-2.7.6-.6 0-1.6-.6-2.6-.6-1.3 0-2.6.8-3.3 2-1.4 2.5-.4 6.2 1 8.2.7 1 1.5 2.1 2.6 2 1-.1 1.4-.6 2.6-.6s1.6.6 2.6.6c1.1 0 1.8-1 2.5-2 .8-1.1 1.1-2.2 1.1-2.3-2.4-1-2.8-4.3-.4-5.6-1-1.3-2.4-1.9-3.4-2.3z" />
      <Path d="M13.8 6.8c.5-.6.9-1.5.8-2.4-.8.1-1.7.6-2.3 1.2-.5.5-.9 1.4-.8 2.3.9.1 1.8-.5 2.3-1.1z" />
    </Svg>
  );
}

export function BadgeStarIcon({ size = 22, color = '#D9A441', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2 9.5 8.5 2.5 9l5.5 4.5L6.5 21 12 17l5.5 4-1.5-7.5L21 9l-7-.5z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function BadgeVeteranIcon({ size = 22, color = '#3E6BDD', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2v20M4 7h16" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M6 7l-2 6a5 5 0 0 0 10 0L12 7M18 7l-2 6a5 5 0 0 0 10 0L24 7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function BadgeExemplaryIcon({ size = 22, color = '#4C8C6B', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21C7 17 3 13.5 3 9.5 3 6.5 5.5 4 8.5 4c1.7 0 3 .8 3.5 2 .5-1.2 1.8-2 3.5-2C18.5 4 21 6.5 21 9.5 21 13.5 17 17 12 21z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
