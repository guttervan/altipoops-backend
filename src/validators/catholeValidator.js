function validateCatholeEntry(data) {
  const {
    latitude,
    longitude,
    terrainType,
    method,
    distanceFromWater,
    distanceFromTrail,
    distanceFromCamp,
  } = data;

  if (
    latitude === undefined ||
    longitude === undefined ||
    !terrainType ||
    !method
  ) {
    return "Latitude, longitude, terrain type, and method are required.";
  }

  const allowedTerrainTypes = [
    "forest",
    "desert",
    "alpine",
    "snow",
    "other",
  ];

  const allowedMethods = [
    "cathole",
    "wag_bag",
    "groover",
  ];

  if (latitude < -90 || latitude > 90) {
    return "Latitude must be between -90 and 90.";
  }

  if (longitude < -180 || longitude > 180) {
    return "Longitude must be between -180 and 180.";
  }

  if (!allowedTerrainTypes.includes(terrainType)) {
    return "Terrain type must be forest, desert, alpine, snow, or other.";
  }

  if (!allowedMethods.includes(method)) {
    return "Method must be cathole, wag_bag, or groover.";
  }

  if (
    distanceFromWater !== undefined &&
    distanceFromWater < 0
  ) {
    return "Distance from water cannot be negative.";
  }

  if (
    distanceFromTrail !== undefined &&
    distanceFromTrail < 0
  ) {
    return "Distance from trail cannot be negative.";
  }

  if (
    distanceFromCamp !== undefined &&
    distanceFromCamp < 0
  ) {
    return "Distance from camp cannot be negative.";
  }

  return null;
}

module.exports = validateCatholeEntry;