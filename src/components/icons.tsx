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

export const InstallIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="5" y="2" width="14" height="20" rx="3" />
    <path d="M12 7v7M9 11l3 3 3-3M10 18h4" />
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

export const CloseIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);

export const StarIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 4l2.4 5 5.6.7-4.1 3.8 1.1 5.5-5-2.8-5 2.8 1.1-5.5L4 9.7 9.6 9z" />
  </Icon>
);

export const CardsIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3" y="7" width="13" height="14" rx="2" />
    <path d="M8 7V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-3" />
  </Icon>
);

export const WandIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 20L15 9" strokeWidth={2.5} />
    <path
      d="M16 3v3M14.5 4.5h3M20 9v3M18.5 10.5h3M9 4v2M8 5h2"
      strokeWidth={1.5}
    />
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
