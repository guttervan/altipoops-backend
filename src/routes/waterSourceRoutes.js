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