const CatholeEntry = require("../models/CatholeEntry");

describe("CatholeEntry model validation", () => {
  const validEntry = {
    userId: 1,
    latitude: 39.5501,
    longitude: -105.7821,
    elevation: 10500,
    terrainType: "alpine",
    method: "cathole",
    distanceFromWater: 250,
    distanceFromTrail: 250,
    distanceFromCamp: 250,
    depthConfirmed: true,
    tpPackedOut: true,
    notes: "Model validation test.",
  };

  test("accepts a valid cathole entry", async () => {
    const entry = CatholeEntry.build(validEntry);

    await expect(entry.validate()).resolves.toBeDefined();
  });

  test("rejects latitude above 90", async () => {
    const entry = CatholeEntry.build({
      ...validEntry,
      latitude: 91,
    });

    await expect(entry.validate()).rejects.toThrow();
  });

  test("rejects longitude below -180", async () => {
    const entry = CatholeEntry.build({
      ...validEntry,
      longitude: -181,
    });

    await expect(entry.validate()).rejects.toThrow();
  });

  test("rejects an invalid terrain type", async () => {
    const entry = CatholeEntry.build({
      ...validEntry,
      terrainType: "volcano",
    });

    await expect(entry.validate()).rejects.toThrow();
  });

  test("rejects an invalid method", async () => {
    const entry = CatholeEntry.build({
      ...validEntry,
      method: "leave_it",
    });

    await expect(entry.validate()).rejects.toThrow();
  });

  test("rejects a negative distance from water", async () => {
    const entry = CatholeEntry.build({
      ...validEntry,
      distanceFromWater: -1,
    });

    await expect(entry.validate()).rejects.toThrow();
  });

  test("rejects a negative distance from trail", async () => {
    const entry = CatholeEntry.build({
      ...validEntry,
      distanceFromTrail: -1,
    });

    await expect(entry.validate()).rejects.toThrow();
  });

  test("rejects a negative distance from camp", async () => {
    const entry = CatholeEntry.build({
      ...validEntry,
      distanceFromCamp: -1,
    });

    await expect(entry.validate()).rejects.toThrow();
  });

  test("rejects a missing terrain type", async () => {
    const entry = CatholeEntry.build({
      ...validEntry,
      terrainType: null,
    });

    await expect(entry.validate()).rejects.toThrow();
  });
});