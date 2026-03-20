export type RgbColor = {
  red: number;
  green: number;
  blue: number;
};

export function hexToRgb(hex: string): RgbColor {
  const clean = hex.replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
    throw new Error(
      `Invalid hex color: "${hex}" (expected #RRGGBB)`,
    );
  }
  return {
    red: parseInt(clean.substring(0, 2), 16) / 255,
    green: parseInt(clean.substring(2, 4), 16) / 255,
    blue: parseInt(clean.substring(4, 6), 16) / 255,
  };
}

export function rgb(
  r: number, g: number, b: number,
): RgbColor {
  return { red: r, green: g, blue: b };
}

export const MD_COLORS = {
  codeBg: rgb(0.95, 0.95, 0.95),
  link: rgb(0.06, 0.33, 0.8),
  blockquote: rgb(0.4, 0.4, 0.4),
  hrBorder: rgb(0.8, 0.8, 0.8),
} as const;
