// A receipt's lines are its "received" movements. A line entered by mistake is
// reversed, not removed, so it stays on the receipt but no longer counts.

type Line = {
  quantity: number;
  reversedBy: { id: string } | null;
};

/** The receipt's lines with whether each was reversed, and the units of those that weren't. */
export function receiptLines<T extends Line>(movements: T[]) {
  const lines = movements.map((movement) => ({ ...movement, reversed: Boolean(movement.reversedBy) }));
  const counted = lines.filter((line) => !line.reversed);
  return { lines, units: counted.reduce((sum, line) => sum + line.quantity, 0) };
}
