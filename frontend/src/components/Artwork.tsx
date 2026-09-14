/**
 * Original vector artwork for The Bond.
 *
 * Everything here is drawn from scratch as inline SVG in the site palette — no image
 * files, no external requests, crisp at any size, and a few kB rather than a few hundred.
 * Colours come from the CSS custom properties in index.css, so the art stays in step with
 * the rest of the design if the palette is ever adjusted.
 */

/** A four-point sparkle with concave sides. The building block for all the glitter. */
function sparklePath(cx: number, cy: number, r: number): string {
  const w = r * 0.12; // waist — smaller value gives sharper points
  const s = r * 0.3;
  return [
    `M ${cx} ${cy - r}`,
    `C ${cx + w} ${cy - s}, ${cx + s} ${cy - w}, ${cx + r} ${cy}`,
    `C ${cx + s} ${cy + w}, ${cx + w} ${cy + s}, ${cx} ${cy + r}`,
    `C ${cx - w} ${cy + s}, ${cx - s} ${cy + w}, ${cx - r} ${cy}`,
    `C ${cx - s} ${cy - w}, ${cx - w} ${cy - s}, ${cx} ${cy - r}`,
    "Z",
  ].join(" ");
}

/** Standalone sparkle, for use inline beside a word or a label. */
export function Sparkle({ className, size = 16 }: { className?: string; size?: number }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d={sparklePath(12, 12, 11)} />
    </svg>
  );
}

/**
 * The tote itself — the thing everyone goes home with.
 * Canvas body, stitched hem, and a scatter of sparkles where the bedazzling happens.
 */
export function ToteIllustration({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 240 320"
      fill="none"
      role="img"
      aria-label="A canvas tote bag decorated with sparkles"
    >
      {/* Handles — one continuous strap loop */}
      <path
        d="M74 116 C74 58 96 40 120 40 C144 40 166 58 166 116"
        stroke="var(--ink)"
        strokeWidth="5"
        strokeLinecap="round"
      />

      {/* Bag body, very slightly tapered so it reads as fabric not a box */}
      <path
        d="M36 114 L204 114 L195 296 C194.6 300 191 303 187 303 L53 303 C49 303 45.4 300 45 296 Z"
        fill="var(--paper-card)"
        stroke="var(--ink)"
        strokeWidth="4"
        strokeLinejoin="round"
      />

      {/* Hem line under the opening */}
      <path d="M40 133 L200 133" stroke="var(--ink)" strokeWidth="2.5" opacity="0.55" />

      {/* Stitch dashes along the hem */}
      <path
        d="M48 142 L192 142"
        stroke="var(--clay)"
        strokeWidth="2"
        strokeDasharray="7 7"
        strokeLinecap="round"
        opacity="0.7"
      />

      {/* The bedazzling: a cluster of sparkles in three weights */}
      <g fill="var(--clay)">
        <path d={sparklePath(120, 210, 40)} />
        <path d={sparklePath(78, 178, 17)} opacity="0.85" />
        <path d={sparklePath(166, 186, 13)} opacity="0.7" />
        <path d={sparklePath(158, 252, 19)} opacity="0.8" />
        <path d={sparklePath(83, 254, 11)} opacity="0.6" />
      </g>

      {/* Small gems — flat facets, a different shape so it isn't all stars */}
      <g fill="var(--clay-deep)" opacity="0.5">
        <path d="M104 272 L112 264 L120 272 L112 280 Z" />
        <path d="M138 158 L145 151 L152 158 L145 165 Z" />
      </g>

      {/* A few sparkles escaping the bag */}
      <g fill="var(--clay)" opacity="0.45">
        <path d={sparklePath(212, 86, 12)} />
        <path d={sparklePath(28, 66, 9)} />
        <path d={sparklePath(196, 44, 7)} />
      </g>
    </svg>
  );
}

/**
 * A wash of confetti for a full-width band. Positions are fixed rather than random so
 * the composition is the same on every render and never lands somewhere awkward.
 * Decorative only — hidden from assistive tech and inert to the pointer.
 */
export function ConfettiField({ className }: { className?: string }) {
  const stars: Array<[number, number, number, number]> = [
    // [x, y, radius, opacity]
    [40, 60, 9, 0.5], [150, 28, 6, 0.35], [268, 88, 11, 0.45], [372, 40, 7, 0.3],
    [492, 74, 9, 0.4], [604, 32, 6, 0.3], [712, 96, 10, 0.35], [828, 52, 7, 0.4],
    [928, 92, 8, 0.3], [1044, 38, 10, 0.35], [1140, 80, 6, 0.3],
    [96, 168, 7, 0.35], [212, 208, 10, 0.3], [330, 168, 6, 0.4], [452, 214, 8, 0.3],
    [566, 172, 7, 0.35], [676, 212, 9, 0.3], [790, 168, 6, 0.35], [900, 206, 8, 0.3],
    [1010, 166, 7, 0.35], [1112, 210, 9, 0.3],
  ];
  const dots: Array<[number, number, number, number]> = [
    [88, 108, 3, 0.35], [196, 124, 2.5, 0.3], [300, 148, 3, 0.3], [412, 108, 2.5, 0.35],
    [528, 136, 3, 0.3], [640, 118, 2.5, 0.3], [748, 150, 3, 0.35], [862, 122, 2.5, 0.3],
    [972, 146, 3, 0.3], [1080, 118, 2.5, 0.35], [1168, 150, 3, 0.3],
    [140, 236, 2.5, 0.3], [356, 246, 3, 0.25], [592, 240, 2.5, 0.3], [836, 248, 3, 0.25],
    [1056, 238, 2.5, 0.3],
  ];

  return (
    <svg
      className={className}
      viewBox="0 0 1200 280"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="var(--clay)">
        {stars.map(([x, y, r, o], i) => (
          <path key={`s${i}`} d={sparklePath(x, y, r)} opacity={o} />
        ))}
      </g>
      <g fill="var(--clay-deep)">
        {dots.map(([x, y, r, o], i) => (
          <circle key={`d${i}`} cx={x} cy={y} r={r} opacity={o} />
        ))}
      </g>
    </svg>
  );
}
