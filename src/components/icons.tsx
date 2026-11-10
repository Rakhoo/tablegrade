import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

/** Shared frame for the stroke icons below (24 × 24 grid, current text color). */
function Icon({ size = 20, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

export const ChevronLeftIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M15 5l-7 7 7 7" />
  </Icon>
);

export const ChevronRightIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M9 5l7 7-7 7" />
  </Icon>
);

export const PlusIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const PencilIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" />
  </Icon>
);

export const CommentIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 18l-1 3 4-2h9a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v9" />
  </Icon>
);

export const TrashIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
  </Icon>
);

export const MoreIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 12h.01M12 12h.01M19 12h.01" strokeWidth={3} />
  </Icon>
);

export const DownloadIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </Icon>
);

export const UploadIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 20V9M7 14l5-5 5 5M5 4h14" />
  </Icon>
);

export const RefreshIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5" />
  </Icon>
);

/** Safari's share symbol, used in the install instructions. */
export const ShareIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3v12M8 7l4-4 4 4M6 11H5v10h14V11h-1" />
  </Icon>
);

export const InfoIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </Icon>
);

export const CheckIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Icon>
);

export const TableIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <path d="M3 10h18M9 10v10" />
  </Icon>
);

export const CardsIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3" y="7" width="13" height="14" rx="2" />
    <path d="M8 7V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-3" />
  </Icon>
);

/** Path of the fountain pen nib of the app icon, its check mark and slit drawn separately. */
export const NIB_OUTLINE =
  "M8 3.5h8M7.5 6.5h9c0 5.5-1.8 10-4.5 14.5-2.7-4.5-4.5-9-4.5-14.5z";
/** The check mark in the nib, running into its slit. */
export const NIB_CHECK = "M9.6 10.6l2.4 2.4 2.6-3M12 13v4.5";

/** The fountain pen nib of the app icon with the check mark in its slit. */
export const NibIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d={NIB_OUTLINE} />
    <path d={NIB_CHECK} />
  </Icon>
);

export const UndoIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 5 5v1" />
  </Icon>
);

export const RedoIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M15 7l5 5-5 5M20 12H9a5 5 0 0 0-5 5v1" />
  </Icon>
);

export const EyeIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

export const EyeOffIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 4l16 16M9.9 5.2A9.9 9.9 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.3 7.4A16.7 16.7 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 4.5-1.1M10 10a3 3 0 0 0 4 4" />
  </Icon>
);

export const SettingsIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="8" cy="17" r="2" />
  </Icon>
);

export const HelpIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7M12 17h.01" />
  </Icon>
);

/** Rows of desks, for the seating plan. */
export const SeatsIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3" y="4" width="7" height="6" rx="1.5" />
    <rect x="14" y="4" width="7" height="6" rx="1.5" />
    <rect x="3" y="14" width="7" height="6" rx="1.5" />
    <rect x="14" y="14" width="7" height="6" rx="1.5" />
  </Icon>
);

export const ImageIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <circle cx="9" cy="9.5" r="1.5" />
    <path d="M21 16l-5-5-9 9" />
  </Icon>
);

/** A label tag, for the student traits. */
export const TagIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3 12.5V4a1 1 0 0 1 1-1h8.5L21 11.5a1.5 1.5 0 0 1 0 2.1L13.6 21a1.5 1.5 0 0 1-2.1 0z" />
    <circle cx="8" cy="8" r="1.5" />
  </Icon>
);

/** A smiling face, for showing nicknames. */
export const SmileIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path
      d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01"
      strokeWidth={2.2}
    />
  </Icon>
);

export const ZoomInIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-4-4M8 11h6M11 8v6" />
  </Icon>
);

export const ImageOffIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3 3l18 18M8 4h10a3 3 0 0 1 3 3v10M19.5 19.5A3 3 0 0 1 18 20H6a3 3 0 0 1-3-3V7a3 3 0 0 1 1.5-2.6M7 20l5-5" />
  </Icon>
);

/** The tag icon crossed out, for hidden traits. */
export const TagOffIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3 12.5V4a1 1 0 0 1 1-1h8.5L21 11.5a1.5 1.5 0 0 1 0 2.1L13.6 21a1.5 1.5 0 0 1-2.1 0z" />
    <circle cx="8" cy="8" r="1.5" />
    <path d="M2 2l20 20" />
  </Icon>
);

/** A name badge, for showing full names. */
export const BadgeIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <circle cx="9" cy="11" r="2" />
    <path d="M6 16a3 3 0 0 1 6 0M15 10h3M15 14h3" />
  </Icon>
);

export const ZoomOutIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-4-4M8 11h6" />
  </Icon>
);

export const ChevronDownIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 9l7 7 7-7" />
  </Icon>
);
