// FRONTEND_UI_UX_BLUEPRINT §11.4 — ridingStyle: max 10; Edit Profile formunda virgül/enter ile.

export function parseRidingStyleCommas(input: string): string[] {
  return input
    .split(/[,;]|\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10);
}
