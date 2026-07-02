import {
  detachOrphanedBatchMembers,
  detachWeanedLitterGraduates,
  prepareBatchForDeletion
} from "./livestock-batch-membership.helper";

function createTx(overrides: {
  orphans?: Array<{ id: string }>;
  graduates?: Array<{ id: string }>;
  litter?: { id: string } | null;
  activeCount?: number;
}) {
  const orphanFind = jest.fn().mockResolvedValue(overrides.orphans ?? []);
  const graduateFind = jest.fn().mockResolvedValue(overrides.graduates ?? []);
  const litterFind = jest.fn().mockResolvedValue(overrides.litter ?? null);
  const updateMany = jest.fn().mockResolvedValue({ count: 0 });
  const count = jest.fn().mockResolvedValue(overrides.activeCount ?? 0);

  const tx = {
    animal: {
      findMany: jest
        .fn()
        .mockImplementation((args: { where: { productionCategory?: unknown } }) => {
          if (args.where.productionCategory) {
            return graduateFind();
          }
          return orphanFind();
        }),
      updateMany,
      count
    },
    litter: { findFirst: litterFind }
  };

  return { tx: tx as never, updateMany, count };
}

describe("livestock-batch-membership.helper", () => {
  it("détache les sujets actifs sans loge", async () => {
    const { tx, updateMany } = createTx({
      orphans: [{ id: "a1" }, { id: "a2" }]
    });

    const detached = await detachOrphanedBatchMembers(tx, "farm-1", "batch-1");

    expect(detached).toBe(2);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["a1", "a2"] } },
      data: { livestockBatchId: null }
    });
  });

  it("détache les porcelets sevrés encore rattachés à la portée", async () => {
    const { tx, updateMany } = createTx({
      litter: { id: "litter-1" },
      graduates: [{ id: "pig-1" }]
    });

    const detached = await detachWeanedLitterGraduates(
      tx,
      "farm-1",
      "batch-portee"
    );

    expect(detached).toBe(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["pig-1"] } },
      data: { livestockBatchId: null }
    });
  });

  it("prepareBatchForDeletion enchaîne le nettoyage puis recompte", async () => {
    const { tx, count } = createTx({
      orphans: [{ id: "a1" }],
      litter: { id: "litter-1" },
      graduates: [{ id: "pig-1" }],
      activeCount: 0
    });

    const remaining = await prepareBatchForDeletion(tx, "farm-1", "batch-1");

    expect(remaining).toBe(0);
    expect(count).toHaveBeenCalled();
  });
});
