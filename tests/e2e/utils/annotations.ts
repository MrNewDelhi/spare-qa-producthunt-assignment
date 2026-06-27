/**
 * Link a test to a tracked defect so it renders as a clickable row in the HTML
 * report. Pair with `test.fail()` for known product bugs: the suite stays green
 * while the bug exists and turns red the moment it is fixed.
 */
export function bug(id: string, description: string): { type: string; description: string } {
  return { type: "bug", description: `${id} — ${description}` };
}
