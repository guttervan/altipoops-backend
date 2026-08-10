function validateBeerSpotEntry(entry) {
  const latitude = Number(entry.latitude);
  const longitude = Number(entry.longitude);

  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90
  ) {
    return "Latitude must be between -90 and 90.";
  }

  if (
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    return "Longitude must be between -180 and 180.";
  }

  if (
    entry.elevation !== null &&
    entry.elevation !== undefined &&
    entry.elevation !== "" &&
    !Number.isFinite(Number(entry.elevation))
  ) {
    return "Elevation must be a number.";
  }

  const elevationSources = new Set([
    "usgs",
    "phone_gps",
    "manual",
    "unknown",
  ]);

  if (
    entry.elevationSource &&
    !elevationSources.has(entry.elevationSource)
  ) {
    return "Elevation source is invalid.";
  }

  const venueName =
    String(entry.venueName || "").trim();

  if (!venueName) {
    return "Beer spot name is required.";
  }

  if (venueName.length > 160) {
    return "Beer spot name must be 160 characters or fewer.";
  }

  const spotTypes = new Set([
    "summit",
    "brewery",
    "taproom",
    "bar",
    "restaurant",
    "campsite",
    "other",
  ]);

  if (!spotTypes.has(entry.spotType)) {
    return "Beer spot type is invalid.";
  }

  if (
    entry.rating !== null &&
    entry.rating !== undefined &&
    entry.rating !== ""
  ) {
    const rating = Number(entry.rating);

    if (
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5
    ) {
      return "Rating must be a whole number from 1 to 5.";
    }
  }

  if (
    entry.postHikeStop !== true &&
    entry.postHikeStop !== false
  ) {
    return "Post-hike stop must be true or false.";
  }

  return null;
}

module.exports = validateBeerSpotEntry;