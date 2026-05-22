export function barnCodeForIndex(index: number): string {
  return String.fromCharCode(65 + Math.min(index, 25));
}

export function barnLabelForIndex(index: number): string {
  return `Bâtiment ${barnCodeForIndex(index)}`;
}

export function penNameForBarn(code: string, penIndex: number): string {
  return `${code}-${penIndex + 1}`;
}

export type PenSlot = { capacity: number; occupancy: number };

function freeCapacity(pen: PenSlot): number {
  return Math.max(0, pen.capacity - pen.occupancy);
}

function occupy(pen: PenSlot, amount: number) {
  pen.occupancy += amount;
}

export function planBatchDistribution(
  headcount: number,
  pens: PenSlot[]
): Array<{ penIndex: number; headcount: number }> {
  if (headcount <= 0 || pens.length === 0) {
    return [];
  }
  const slots = pens.map((p, penIndex) => ({ ...p, penIndex }));
  const single = slots.find((p) => freeCapacity(p) >= headcount);
  if (single) {
    return [{ penIndex: single.penIndex, headcount }];
  }
  const plan: Array<{ penIndex: number; headcount: number }> = [];
  let remaining = headcount;
  const ordered = [...slots].sort(
    (a, b) => freeCapacity(b) - freeCapacity(a)
  );
  for (const pen of ordered) {
    if (remaining <= 0) {
      break;
    }
    const free = freeCapacity(pen);
    if (free <= 0) {
      continue;
    }
    const take = Math.min(remaining, free);
    plan.push({ penIndex: pen.penIndex, headcount: take });
    occupy(pen, take);
    remaining -= take;
  }
  if (remaining > 0 && plan.length > 0) {
    plan[plan.length - 1].headcount += remaining;
  }
  return plan;
}

export type PenAssignmentKind =
  | "females"
  | "male"
  | "starter"
  | "fattening"
  | "mixed";

export type PenAssignment = {
  kind: PenAssignmentKind;
  headcount?: number;
};

export function buildPenAssignmentMap(params: {
  buildingsCount: number;
  pensPerBuilding: number;
  capacity: number;
  femaleCount: number;
  maleCount: number;
  starterCount: number;
  fatteningCount: number;
}): Map<string, PenAssignment> {
  const map = new Map<string, PenAssignment>();
  const key = (barn: number, pen: number) => `${barn}-${pen}`;

  const pensByBarn: PenSlot[][] = Array.from(
    { length: params.buildingsCount },
    () =>
      Array.from({ length: params.pensPerBuilding }, () => ({
        capacity: params.capacity,
        occupancy: 0
      }))
  );

  if (params.femaleCount > 0 && pensByBarn[0]?.[0]) {
    map.set(key(0, 0), { kind: "females", headcount: params.femaleCount });
    occupy(pensByBarn[0][0], params.femaleCount);
  }

  const malePool: Array<{ barn: number; pen: number }> = [];
  for (let b = 1; b < params.buildingsCount; b += 1) {
    for (let p = 0; p < params.pensPerBuilding; p += 1) {
      malePool.push({ barn: b, pen: p });
    }
  }
  for (let p = 1; p < params.pensPerBuilding; p += 1) {
    malePool.push({ barn: 0, pen: p });
  }

  let maleIdx = 0;
  for (let m = 0; m < params.maleCount; m += 1) {
    while (maleIdx < malePool.length) {
      const slot = malePool[maleIdx];
      const pen = pensByBarn[slot.barn]?.[slot.pen];
      if (pen && freeCapacity(pen) >= 1) {
        map.set(key(slot.barn, slot.pen), { kind: "male", headcount: 1 });
        occupy(pen, 1);
        maleIdx += 1;
        break;
      }
      maleIdx += 1;
    }
  }

  const allSlots: Array<{ barn: number; pen: number; slot: PenSlot }> = [];
  for (let b = 0; b < params.buildingsCount; b += 1) {
    for (let p = 0; p < params.pensPerBuilding; p += 1) {
      const slot = pensByBarn[b][p];
      if (freeCapacity(slot) > 0) {
        allSlots.push({ barn: b, pen: p, slot });
      }
    }
  }

  const productionSlots = allSlots.map((s, i) => ({
    penIndex: i,
    capacity: s.slot.capacity,
    occupancy: s.slot.occupancy
  }));

  const starterSplits = planBatchDistribution(
    params.starterCount,
    productionSlots
  );
  for (const part of starterSplits) {
    const target = allSlots[part.penIndex];
    if (!target) {
      continue;
    }
    const k = key(target.barn, target.pen);
    const existing = map.get(k);
    if (existing?.kind === "male") {
      map.set(k, {
        kind: "mixed",
        headcount: (existing.headcount ?? 1) + part.headcount
      });
    } else {
      map.set(k, { kind: "starter", headcount: part.headcount });
    }
    occupy(target.slot, part.headcount);
  }

  const afterStarter = allSlots.filter((s) => freeCapacity(s.slot) > 0);
  const fatteningPool = afterStarter.map((s, penIndex) => ({
    penIndex,
    capacity: s.slot.capacity,
    occupancy: s.slot.occupancy
  }));

  const fatteningSplits = planBatchDistribution(
    params.fatteningCount,
    fatteningPool
  );
  for (const part of fatteningSplits) {
    const target = afterStarter[part.penIndex];
    if (!target) {
      continue;
    }
    const k = key(target.barn, target.pen);
    const existing = map.get(k);
    if (existing) {
      map.set(k, {
        kind: "mixed",
        headcount: (existing.headcount ?? 0) + part.headcount
      });
    } else {
      map.set(k, { kind: "fattening", headcount: part.headcount });
    }
    occupy(target.slot, part.headcount);
  }

  return map;
}
