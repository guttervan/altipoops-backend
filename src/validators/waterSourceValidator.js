function validateWaterSourceEntry(data) {
  const {
    latitude,
    longitude,
    sourceType,
    flowRating,
    lastConfirmedDate,
  } = data;

  if (
    latitude === undefined ||
    longitude === undefined ||
    !sourceType ||
    !flowRating ||
    !lastConfirmedDate
  ) {
    return "Latitude, longitude, source type, flow rating, and last confirmed date are required.";
  }

  const allowedSourceTypes = [
    "spring",
    "creek",
    "lake",
    "seasonal",
    "tank",
  ];

  const allowedFlowRatings = [
    "dry",
    "trickle",
    "moderate",
    "strong",
  ];

  if (latitude < -90 || latitude > 90) {
    return "Latitude must be between -90 and 90.";
  }

  if (longitude < -180 || longitude > 180) {
    return "Longitude must be between -180 and 180.";
  }

  if (!allowedSourceTypes.includes(sourceType)) {
    return "Source type must be spring, creek, lake, seasonal, or tank.";
  }

  if (!allowedFlowRatings.includes(flowRating)) {
    return "Flow rating must be dry, trickle, moderate, or strong.";
  }

  const parsedDate = new Date(lastConfirmedDate);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Last confirmed date must be a valid date.";
  }

  return null;
}

module.exports = validateWaterSourceEntry;