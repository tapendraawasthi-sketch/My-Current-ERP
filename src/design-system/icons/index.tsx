import * as React from "react";

type IconProps = React.SVGProps<SVGSVGElement> & { title?: string };

function base(props: IconProps, paths: React.ReactNode) {
  const { title, className, ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {paths}
    </svg>
  );
}

/** Orbix intelligence mark — abstract signal, not a brand clone */
export function OrbixIcon(props: IconProps) {
  return base(
    props,
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21" />
      <path d="M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" />
    </>,
  );
}

export function NprIcon(props: IconProps) {
  return base(
    props,
    <>
      <path d="M7 5h8M7 5v14M7 12h6" />
      <path d="M13 8c2.2 0 4 1.3 4 3s-1.8 3-4 3" />
    </>,
  );
}

export function DualDateIcon(props: IconProps) {
  return base(
    props,
    <>
      <rect x="3" y="5" width="8" height="14" rx="1.5" />
      <rect x="13" y="5" width="8" height="14" rx="1.5" />
      <path d="M5 9h4M15 9h4M5 13h3M15 13h3" />
    </>,
  );
}

export function LedgerIcon(props: IconProps) {
  return base(
    props,
    <>
      <path d="M6 4h12v16H6z" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </>,
  );
}

export function ReconciliationIcon(props: IconProps) {
  return base(
    props,
    <>
      <path d="M4 8h7v8H4z" />
      <path d="M13 8h7v8h-7z" />
      <path d="M9 12h6" />
      <path d="M14.5 10.5L16 12l-1.5 1.5" />
    </>,
  );
}

export function SyncConflictIcon(props: IconProps) {
  return base(
    props,
    <>
      <path d="M12 3l8 14H4L12 3z" />
      <path d="M12 10v3" />
      <circle cx="12" cy="15.5" r="0.8" fill="currentColor" stroke="none" />
    </>,
  );
}
