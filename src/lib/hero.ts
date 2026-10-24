// Where the homepage banner's text sits over its picture (Admin → Site settings and Seasonal events).
export const HERO_TEXT_POSITIONS = [
  { value: "left", label: "Left (dark shade on the left)" },
  { value: "center", label: "Centre" },
  { value: "right", label: "Right (dark shade on the right)" },
  { value: "hidden", label: "Picture only — hide the text (the picture has its own)" },
] as const;

export type HeroTextPosition = (typeof HERO_TEXT_POSITIONS)[number]["value"];

export function heroTextPosition(value: string | null | undefined): HeroTextPosition {
  return HERO_TEXT_POSITIONS.some((p) => p.value === value) ? (value as HeroTextPosition) : "left";
}
