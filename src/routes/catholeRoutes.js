const express = require("express");
const CatholeEntry = require("../models/CatholeEntry");
const requireAuth = require("../middleware/authMiddleware");
const validateCatholeEntry = require("../validators/catholeValidator");

const router = express.Router();

router.post("/", requireAuth, async (request, response) => {
  try {
    // 1. Read the values
    const {
      latitude,
      longitude,
      elevation,
      terrainType,
      method,
      distanceFromWater,
      distanceFromTrail,
      distanceFromCamp,
      depthConfirmed,
      tpPackedOut,
      notes,
    } = request.body;

    // 2. Validate
    const validationError = validateCatholeEntry(request.body);

    if (validationError) {
      return response.status(400).json({
        message: validationError,
      });
    }

    // 3. Save
    const entry = await CatholeEntry.create({
      userId: request.user.userId,
      latitude,
      longitude,
      elevation: elevation ?? null,
      terrainType,
      method,
      distanceFromWater: distanceFromWater ?? null,
      distanceFromTrail: distanceFromTrail ?? null,
      distanceFromCamp: distanceFromCamp ?? null,
      depthConfirmed: depthConfirmed ?? false,
      tpPackedOut: tpPackedOut ?? false,
      notes: notes ?? null,
    });

    response.status(201).json({
      message: "Cathole entry created successfully!",
      entry,
    });
  } catch (error) {
    console.error(error);

    response.status(500).json({
      message: "Something went wrong while creating the cathole entry.",
    });
  }
});
module.exports = router;