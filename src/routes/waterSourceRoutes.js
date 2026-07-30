const express = require("express");
const WaterSourceEntry = require("../models/WaterSourceEntry");
const requireAuth = require("../middleware/authMiddleware");
const validateWaterSourceEntry = require("../validators/waterSourceValidator");
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

    const validationError = validateWaterSourceEntry(request.body);

    if (validationError) {
      return response.status(400).json({
        message: validationError,
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