import type { QueryClient } from "@tanstack/react-query";
import {
  resetQueueItemForRetry,
  syncOfflineQueue,
  syncOneQueueItem
} from "../syncEngine";
import type { OfflineQueueItem } from "../types";
import {
  OFFLINE_MAX_RETRIES,
  attachIdempotencyHeaders,
  createIdempotencyKey
} from "../types";

jest.mock("../../supabase", () => ({
  getSupabase: () => null
}));

jest.mock("../queueStore", () => ({
  loadIdMappings: jest.fn(async () => ({})),
  saveIdMappings: jest.fn(async () => undefined)
}));

const mockExecuteCall = jest.fn();
jest.mock("../executeCall", () => ({
  executeOfflineApiCall: (...args: unknown[]) => mockExecuteCall(...args)
}));

function makeItem(
  partial: Partial<OfflineQueueItem> & Pick<OfflineQueueItem, "id" | "label">
): OfflineQueueItem {
  return {
    farmId: "farm-1",
    type: "cheptel.postWeight",
    calls: [
      {
        method: "POST",
        path: "/farms/farm-1/animals/a1/weights",
        body: { weightKg: 12 }
      }
    ],
    invalidateRoots: ["farmAnimals"],
    createdAt: Date.now(),
    status: "pending",
    retryCount: 0,
    idempotencyKey: createIdempotencyKey(),
    ...partial
  };
}

describe("offline queue — enqueue helpers", () => {
  it("attachIdempotencyHeaders pose X-Idempotency-Key", () => {
    const calls = attachIdempotencyHeaders(
      [{ method: "POST", path: "/x", body: {} }],
      "uuid-1"
    );
    expect(calls[0]?.headers?.["X-Idempotency-Key"]).toBe("uuid-1");
  });

  it("attachIdempotencyHeaders indexe les appels chaînés", () => {
    const calls = attachIdempotencyHeaders(
      [
        { method: "POST", path: "/a", body: {} },
        { method: "POST", path: "/b", body: {} }
      ],
      "uuid-1"
    );
    expect(calls[0]?.headers?.["X-Idempotency-Key"]).toBe("uuid-1:0");
    expect(calls[1]?.headers?.["X-Idempotency-Key"]).toBe("uuid-1:1");
  });
});

describe("syncOfflineQueue — ordre et dédup", () => {
  const qc = {
    invalidateQueries: jest.fn()
  } as unknown as QueryClient;

  beforeEach(() => {
    mockExecuteCall.mockReset();
    (qc.invalidateQueries as jest.Mock).mockReset();
  });

  it("rejoue dans l’ordre FIFO et marque synced", async () => {
    const order: string[] = [];
    mockExecuteCall.mockImplementation(async (call: { path: string }) => {
      order.push(call.path);
      return { id: `id-${order.length}` };
    });

    const items = [
      makeItem({ id: "q1", label: "Pesée 1", createdAt: 1 }),
      makeItem({
        id: "q2",
        label: "Pesée 2",
        createdAt: 2,
        calls: [
          {
            method: "POST",
            path: "/farms/farm-1/animals/a2/weights",
            body: { weightKg: 20 }
          }
        ]
      })
    ];

    const result = await syncOfflineQueue({
      items,
      accessToken: "tok",
      queryClient: qc
    });

    expect(order).toEqual([
      "/farms/farm-1/animals/a1/weights",
      "/farms/farm-1/animals/a2/weights"
    ]);
    expect(result.map((i) => i.status)).toEqual(["synced", "synced"]);
    expect(mockExecuteCall.mock.calls[0][0].headers["X-Idempotency-Key"]).toBe(
      items[0]!.idempotencyKey
    );
  });

  it("conserve l’ordre : stop sur erreur réseau, reprend plus tard", async () => {
    mockExecuteCall
      .mockRejectedValueOnce(new TypeError("Network request failed"))
      .mockResolvedValueOnce({ id: "ok" });

    const items = [
      makeItem({ id: "q1", label: "A", createdAt: 1 }),
      makeItem({ id: "q2", label: "B", createdAt: 2 })
    ];

    const first = await syncOfflineQueue({
      items,
      accessToken: "tok",
      queryClient: qc
    });
    expect(first[0]?.status).toBe("failed");
    expect(first[0]?.retryCount).toBe(1);
    expect(first[1]?.status).toBe("pending");

    mockExecuteCall.mockResolvedValue({ id: "ok" });
    const second = await syncOfflineQueue({
      items: first.map((i) =>
        i.id === "q1" ? { ...i, status: "pending" as const } : i
      ),
      accessToken: "tok",
      queryClient: qc
    });
    expect(second.every((i) => i.status === "synced")).toBe(true);
  });

  it("échec définitif après OFFLINE_MAX_RETRIES et passe au suivant", async () => {
    mockExecuteCall
      .mockRejectedValueOnce(new TypeError("Network request failed"))
      .mockResolvedValueOnce({ id: "second-ok" });

    const items = [
      makeItem({
        id: "q1",
        label: "A",
        retryCount: OFFLINE_MAX_RETRIES - 1,
        status: "pending"
      }),
      makeItem({ id: "q2", label: "B" })
    ];

    const result = await syncOfflineQueue({
      items,
      accessToken: "tok",
      queryClient: qc
    });

    expect(result[0]?.retryCount).toBe(OFFLINE_MAX_RETRIES);
    expect(result[0]?.status).toBe("failed");
    expect(result[1]?.status).toBe("synced");
  });

  it("réutilise la même clé d’idempotence au rejeu (dédup serveur)", async () => {
    const key = "fixed-uuid-replay";
    mockExecuteCall
      .mockRejectedValueOnce(new TypeError("Network request failed"))
      .mockResolvedValueOnce({ id: "w1" });

    const item = makeItem({
      id: "q1",
      label: "Pesée",
      idempotencyKey: key
    });

    const afterFail = await syncOneQueueItem(item, "tok", null, {});
    expect(afterFail.ok).toBe(false);

    const afterOk = await syncOneQueueItem(
      { ...afterFail.item, status: "pending" },
      "tok",
      null,
      {}
    );
    expect(afterOk.ok).toBe(true);
    expect(mockExecuteCall.mock.calls[0][0].headers["X-Idempotency-Key"]).toBe(key);
    expect(mockExecuteCall.mock.calls[1][0].headers["X-Idempotency-Key"]).toBe(key);
  });

  it("resetQueueItemForRetry remet pending / retryCount 0", () => {
    const reset = resetQueueItemForRetry(
      makeItem({
        id: "q1",
        label: "X",
        status: "failed",
        retryCount: 5,
        lastError: "boom"
      })
    );
    expect(reset.status).toBe("pending");
    expect(reset.retryCount).toBe(0);
    expect(reset.lastError).toBeUndefined();
  });
});
