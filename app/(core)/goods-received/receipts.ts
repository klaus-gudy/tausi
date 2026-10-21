// A receipt's lines are its "received" movements. A line entered by mistake is
// reversed, not removed, so it stays on the receipt but no longer counts.

type Line = {
  quantity: number;
  unitCost: number | null;
  reversedBy: { id: string } | null;
};

/** The receipt's lines with whether each was reversed, and the totals of those that weren't. */
export function receiptLines<T extends Line>(movements: T[]) {
  const lines = movements.map((movement) => ({ ...movement, reversed: Boolean(movement.reversedBy) }));
  const counted = lines.filter((line) => !line.reversed);
  const costed = counted.filter((line) => line.unitCost !== null);
  return {
    lines,
    units: counted.reduce((sum, line) => sum + line.quantity, 0),
    // Null when no line has a cost, so it reads as unknown rather than free.
    value: costed.length
      ? costed.reduce((sum, line) => sum + line.quantity * line.unitCost!, 0)
      : null,
  };
}
