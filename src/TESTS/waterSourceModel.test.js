const WaterSourceEntry = require("../models/WaterSourceEntry");

describe("WaterSourceEntry model validation", () => {
  const validEntry = {
    userId: 1,
    latitude: 39.7392,
    longitude: -104.9903,
    elevation: 9200,
    sourceType: "spring",
    flowRating: "moderate",
    lastConfirmedDate: "2026-07-30",
    potabilityNotes: "Filter before drinking.",
    notes: "Model validation test.",
  };

  test("accepts a valid water source entry", async () => {
    const entry = WaterSourceEntry.build(validEntry);

    await expect(entry.validate()).resolves.toBeDefined();
  });

  test("rejects latitude above 90", async () => {
    const entry = WaterSourceEntry.build({
      ...validEntry,
      latitude: 91,
    });

    await expect(entry.validate()).rejects.toThrow();
  });

  test("rejects longitude below -180", async () => {
    const entry = WaterSourceEntry.build({
      ...validEntry,
      longitude: -181,
    });

    await expect(entry.validate()).rejects.toThrow();
  });

  test("rejects an invalid source type", async () => {
    const entry = WaterSourceEntry.build({
      ...validEntry,
      sourceType: "fountain",
    });

    await expect(entry.validate()).rejects.toThrow();
  });

  test("rejects an invalid flow rating", async () => {
    const entry = WaterSourceEntry.build({
      ...validEntry,
      flowRating: "massive",
    });

    await expect(entry.validate()).rejects.toThrow();
  });

  test("rejects an invalid confirmed date", async () => {
    const entry = WaterSourceEntry.build({
      ...validEntry,
      lastConfirmedDate: "not-a-date",
    });

    await expect(entry.validate()).rejects.toThrow();
  });

  test("rejects a missing source type", async () => {
    const entry = WaterSourceEntry.build({
      ...validEntry,
      sourceType: null,
    });

    await expect(entry.validate()).rejects.toThrow();
  });

  test("rejects a missing flow rating", async () => {
    const entry = WaterSourceEntry.build({
      ...validEntry,
      flowRating: null,
    });

    await expect(entry.validate()).rejects.toThrow();
  });

  test("rejects a missing confirmed date", async () => {
    const entry = WaterSourceEntry.build({
      ...validEntry,
      lastConfirmedDate: null,
    });

    await expect(entry.validate()).rejects.toThrow();
  });
});