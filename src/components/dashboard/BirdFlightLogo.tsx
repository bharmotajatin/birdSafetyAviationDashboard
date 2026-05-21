"use client";

import Image from "next/image";

const LOGO_SRC = "/bird-flight-services-logo.png";
/** Source image is 1024×243; emblem is the left ~243px (circle height). */
const LOGO_ASPECT = 243 / 1024;
const EMBLEM_ASPECT = 243 / 1024;

type MarkProps = {
  size?: number;
  className?: string;
};

/** Circular emblem cropped from the official wordmark asset. */
export function BirdFlightMark({ size = 64, className }: MarkProps) {
  const imgWidth = Math.round(size / EMBLEM_ASPECT);

  return (
    <div
      className={`shrink-0 overflow-hidden rounded-full bg-white ${className ?? ""}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <img
        src={LOGO_SRC}
        alt=""
        width={imgWidth}
        height={size}
        className="block max-w-none"
        style={{ width: imgWidth, height: size }}
        draggable={false}
      />
    </div>
  );
}

type LogoProps = {
  width?: number;
  className?: string;
};

/** Full official Bird Flight Services wordmark (provided brand asset). */
export function BirdFlightLogo({ width = 280, className }: LogoProps) {
  const height = Math.round(width * LOGO_ASPECT);

  return (
    <Image
      src={LOGO_SRC}
      alt="Bird Flight Services"
      width={width}
      height={height}
      priority
      className={`h-auto ${className ?? ""}`}
      style={{ width, height: "auto", maxWidth: "100%" }}
    />
  );
}
