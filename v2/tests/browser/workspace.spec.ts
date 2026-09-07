import { expect, test } from "@playwright/test";

test("V2 workspace placeholder loads", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "AI Clinical Simulation Platform V2" })
  ).toBeVisible();
  await expect(page.getByText("Workspace Initialized")).toBeVisible();
});

test("versioned PWA shell reloads safely without a network", async ({ context, page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(
    () => page.evaluate(() => navigator.serviceWorker.controller !== null)
  ).toBe(true);

  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "AI Clinical Simulation Platform V2" })
    ).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});

test("IndexedDB recovery metadata survives reload and is isolated across tabs and principals", async ({ context, page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("ai-clinical-simulation-v2-recovery", 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        const journal = db.createObjectStore("recovery_journal", {
          keyPath: "journal_entry_id"
        });
        journal.createIndex("by-principal", "principal_user_id");
        const projections = db.createObjectStore("safe_projections");
        projections.createIndex("by-principal", "principal_user_id");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("recovery_journal", "readwrite");
    transaction.objectStore("recovery_journal").put({
      journal_entry_id: "recovery:playwright:principal-a",
      principal_user_id: "principal.playwright-a",
      marker: "IN_DOUBT_A"
    });
    transaction.objectStore("recovery_journal").put({
      journal_entry_id: "recovery:playwright:principal-b",
      principal_user_id: "principal.playwright-b",
      marker: "IN_DOUBT_B"
    });
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
  });

  await page.reload();
  const secondTab = await context.newPage();
  await secondTab.goto("/");
  const records = await secondTab.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("ai-clinical-simulation-v2-recovery", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("recovery_journal", "readwrite");
    const store = transaction.objectStore("recovery_journal");
    const before = await new Promise<unknown[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    store.delete("recovery:playwright:principal-a");
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    const read = database.transaction("recovery_journal", "readonly")
      .objectStore("recovery_journal");
    const after = await new Promise<unknown[]>((resolve, reject) => {
      const request = read.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return { before, after };
  });

  expect(records.before).toHaveLength(2);
  expect(records.after).toEqual([
    expect.objectContaining({
      principal_user_id: "principal.playwright-b",
      marker: "IN_DOUBT_B"
    })
  ]);
  await secondTab.close();
});

test("service-worker update preserves recovery metadata without caching private APIs", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(
    () => page.evaluate(() => navigator.serviceWorker.controller !== null)
  ).toBe(true);

  const result = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("ai-clinical-simulation-v2-recovery", 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        const journal = db.createObjectStore("recovery_journal", {
          keyPath: "journal_entry_id"
        });
        journal.createIndex("by-principal", "principal_user_id");
        const projections = db.createObjectStore("safe_projections");
        projections.createIndex("by-principal", "principal_user_id");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const write = database.transaction("recovery_journal", "readwrite");
    write.objectStore("recovery_journal").put({
      journal_entry_id: "recovery:playwright:sw-update",
      principal_user_id: "principal.playwright-sw",
      marker: "IN_DOUBT_SW"
    });
    await new Promise<void>((resolve, reject) => {
      write.oncomplete = () => resolve();
      write.onerror = () => reject(write.error);
      write.onabort = () => reject(write.error);
    });

    const registration = await navigator.serviceWorker.ready;
    const controllerBefore = navigator.serviceWorker.controller?.scriptURL ?? null;
    await fetch("/v1/private-recovery-chaos", {
      headers: { Authorization: "Bearer synthetic-playwright-only" }
    }).catch(() => undefined);
    await registration.update();
    const controllerAfter = navigator.serviceWorker.controller?.scriptURL ?? null;

    const cacheEntries: Array<{ url: string; authorization: string | null }> = [];
    for (const cacheName of await caches.keys()) {
      const cache = await caches.open(cacheName);
      for (const request of await cache.keys()) {
        cacheEntries.push({
          url: request.url,
          authorization: request.headers.get("Authorization")
        });
      }
    }
    const stored = await new Promise<unknown>((resolve, reject) => {
      const request = database.transaction("recovery_journal", "readonly")
        .objectStore("recovery_journal")
        .get("recovery:playwright:sw-update");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return {
      controllerBefore,
      controllerAfter,
      waitingWorker: registration.waiting?.scriptURL ?? null,
      cacheEntries,
      stored
    };
  });

  expect(result.controllerBefore).not.toBeNull();
  expect(result.controllerAfter).toBe(result.controllerBefore);
  expect(result.waitingWorker).toBeNull();
  expect(result.stored).toEqual(expect.objectContaining({ marker: "IN_DOUBT_SW" }));
  expect(result.cacheEntries.some((entry) => new URL(entry.url).pathname.startsWith("/v1")))
    .toBe(false);
  expect(result.cacheEntries.every((entry) => entry.authorization === null)).toBe(true);
});
