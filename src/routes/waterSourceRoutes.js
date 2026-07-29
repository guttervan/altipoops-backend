const express = require("express");
const WaterSourceEntry = require("../models/WaterSourceEntry");
const requireAuth = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", requireAuth, async (request, response) => {
  try {
    const {
      latitude,
      longitude,
      elevation,
      sourceType,
      flowRating,
      lastConfirmedDate,
      potabilityNotes,
      notes,
    } = request.body;

    if (
      latitude === undefined ||
      longitude === undefined ||
      !sourceType ||
      !flowRating ||
      !lastConfirmedDate
    ) {
      return response.status(400).json({
        message:
          "Latitude, longitude, source type, flow rating, and last confirmed date are required.",
      });
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
      return response.status(400).json({
        message: "Latitude must be between -90 and 90.",
      });
    }

    if (longitude < -180 || longitude > 180) {
      return response.status(400).json({
        message: "Longitude must be between -180 and 180.",
      });
    }

    if (!allowedSourceTypes.includes(sourceType)) {
      return response.status(400).json({
        message:
          "Source type must be spring, creek, lake, seasonal, or tank.",
      });
    }

    if (!allowedFlowRatings.includes(flowRating)) {
      return response.status(400).json({
        message:
          "Flow rating must be dry, trickle, moderate, or strong.",
      });
    }

    const parsedDate = new Date(lastConfirmedDate);

    if (Number.isNaN(parsedDate.getTime())) {
      return response.status(400).json({
        message: "Last confirmed date must be a valid date.",
      });
    }

    const entry = await WaterSourceEntry.create({
      userId: request.user.userId,
      latitude,
      longitude,
      elevation: elevation ?? null,
      sourceType,
      flowRating,
      lastConfirmedDate,
      potabilityNotes: potabilityNotes ?? null,
      notes: notes ?? null,
    });

    response.status(201).json({
      message: "Water source entry created successfully!",
      entry,
    });
  } catch (error) {
    console.error(error);

    response.status(500).json({
      message: "Something went wrong while creating the water source entry.",
    });
  }
});
module.exports = router;