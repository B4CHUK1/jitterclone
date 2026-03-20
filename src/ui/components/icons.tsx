import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function BaseIcon({ size = 16, children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export const MousePointer2 = ({ size }: IconProps) => <BaseIcon size={size}><path d="m4 4 7 16 2-7 7-2z" /></BaseIcon>;
export const Square = ({ size }: IconProps) => <BaseIcon size={size}><rect x="4" y="4" width="16" height="16" /></BaseIcon>;
export const Circle = ({ size }: IconProps) => <BaseIcon size={size}><circle cx="12" cy="12" r="8" /></BaseIcon>;
export const Pentagon = ({ size }: IconProps) => <BaseIcon size={size}><path d="m12 3 8 6-3 10H7L4 9z" /></BaseIcon>;
export const Star = ({ size }: IconProps) => <BaseIcon size={size}><path d="m12 3 2.9 5.9 6.5 1-4.7 4.6 1.1 6.6L12 18l-5.8 3.1 1.1-6.6L2.6 10l6.5-1z" /></BaseIcon>;
export const Minus = ({ size }: IconProps) => <BaseIcon size={size}><path d="M5 12h14" /></BaseIcon>;
export const Hand = ({ size }: IconProps) => <BaseIcon size={size}><path d="M8 12V5a1 1 0 0 1 2 0v5" /><path d="M12 12V4a1 1 0 0 1 2 0v8" /><path d="M16 12V6a1 1 0 0 1 2 0v7c0 4-2 7-6 7s-7-3-7-7v-1a1 1 0 1 1 2 0v1" /></BaseIcon>;
export const PenTool = ({ size }: IconProps) => <BaseIcon size={size}><path d="m12 19 7-7-7-7-7 7z" /><path d="M12 19v3" /></BaseIcon>;
export const Undo2 = ({ size }: IconProps) => <BaseIcon size={size}><path d="M9 14 4 9l5-5" /><path d="M20 20a8 8 0 0 0-8-8H4" /></BaseIcon>;
export const Redo2 = ({ size }: IconProps) => <BaseIcon size={size}><path d="m15 14 5-5-5-5" /><path d="M4 20a8 8 0 0 1 8-8h8" /></BaseIcon>;
export const SkipBack = ({ size }: IconProps) => <BaseIcon size={size}><path d="M19 20 9 12l10-8z" /><path d="M5 19V5" /></BaseIcon>;
export const ChevronLeft = ({ size }: IconProps) => <BaseIcon size={size}><path d="m15 18-6-6 6-6" /></BaseIcon>;
export const Play = ({ size }: IconProps) => <BaseIcon size={size}><path d="m8 5 11 7-11 7z" /></BaseIcon>;
export const Pause = ({ size }: IconProps) => <BaseIcon size={size}><path d="M10 5v14M14 5v14" /></BaseIcon>;
export const ChevronRight = ({ size }: IconProps) => <BaseIcon size={size}><path d="m9 18 6-6-6-6" /></BaseIcon>;
export const SkipForward = ({ size }: IconProps) => <BaseIcon size={size}><path d="m5 4 10 8-10 8z" /><path d="M19 5v14" /></BaseIcon>;
export const KeyRound = ({ size }: IconProps) => <BaseIcon size={size}><circle cx="8" cy="12" r="3" /><path d="M11 12h9" /><path d="M17 12v3M20 12v2" /></BaseIcon>;
export const ChevronDown = ({ size }: IconProps) => <BaseIcon size={size}><path d="m6 9 6 6 6-6" /></BaseIcon>;
export const Diamond = ({ size }: IconProps) => <BaseIcon size={size}><path d="m12 4 7 8-7 8-7-8z" /></BaseIcon>;
