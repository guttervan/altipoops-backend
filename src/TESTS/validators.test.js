const validateCatholeEntry = require("../validators/catholeValidator");
const validateWaterSourceEntry = require("../validators/waterSourceValidator");

describe("Cathole validator", () => {
  const validCathole = {
    latitude: 39.5501,
    longitude: -105.7821,
    terrainType: "alpine",
    method: "cathole",
    distanceFromWater: 250,
    distanceFromTrail: 250,
    distanceFromCamp: 250,
  };

  test("accepts a valid cathole entry", () => {
    expect(validateCatholeEntry(validCathole)).toBeNull();
  });

  test("rejects missing required fields", () => {
    expect(validateCatholeEntry({})).toBe(
      "Latitude, longitude, terrain type, and method are required."
    );
  });

  test("rejects invalid latitude", () => {
    expect(
      validateCatholeEntry({
        ...validCathole,
        latitude: 100,
      })
    ).toBe("Latitude must be between -90 and 90.");
  });

  test("rejects invalid longitude", () => {
    expect(
      validateCatholeEntry({
        ...validCathole,
        longitude: -200,
      })
    ).toBe("Longitude must be between -180 and 180.");
  });

  test("rejects invalid terrain type", () => {
    expect(
      validateCatholeEntry({
        ...validCathole,
        terrainType: "volcano",
      })
    ).toBe(
      "Terrain type must be forest, desert, alpine, snow, or other."
    );
  });

  test("rejects invalid method", () => {
    expect(
      validateCatholeEntry({
        ...validCathole,
        method: "bury_everything",
      })
    ).toBe("Method must be cathole, wag_bag, or groover.");
  });

  test("rejects negative distances", () => {
    expect(
      validateCatholeEntry({
        ...validCathole,
        distanceFromWater: -1,
      })
    ).toBe("Distance from water cannot be negative.");
  });
});

describe("Water source validator", () => {
  const validWaterSource = {
    latitude: 39.7392,
    longitude: -104.9903,
    sourceType: "spring",
    flowRating: "moderate",
    lastConfirmedDate: "2026-07-30",
  };

  test("accepts a valid water source entry", () => {
    expect(validateWaterSourceEntry(validWaterSource)).toBeNull();
  });

  test("rejects missing required fields", () => {
    expect(validateWaterSourceEntry({})).toBe(
      "Latitude, longitude, source type, flow rating, and last confirmed date are required."
    );
  });

  test("rejects invalid latitude", () => {
    expect(
      validateWaterSourceEntry({
        ...validWaterSource,
        latitude: -100,
      })
    ).toBe("Latitude must be between -90 and 90.");
  });

  test("rejects invalid longitude", () => {
    expect(
      validateWaterSourceEntry({
        ...validWaterSource,
        longitude: 200,
      })
    ).toBe("Longitude must be between -180 and 180.");
  });

  test("rejects invalid source type", () => {
    expect(
      validateWaterSourceEntry({
        ...validWaterSource,
        sourceType: "fountain",
      })
    ).toBe(
      "Source type must be spring, creek, lake, seasonal, or tank."
    );
  });

  test("rejects invalid flow rating", () => {
    expect(
      validateWaterSourceEntry({
        ...validWaterSource,
        flowRating: "massive",
      })
    ).toBe(
      "Flow rating must be dry, trickle, moderate, or strong."
    );
  });

  test("rejects an invalid date", () => {
    expect(
      validateWaterSourceEntry({
        ...validWaterSource,
        lastConfirmedDate: "not-a-date",
      })
    ).toBe("Last confirmed date must be a valid date.");
  });
});