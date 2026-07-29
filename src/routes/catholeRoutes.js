const express = require("express");
const CatholeEntry = require("../models/CatholeEntry");
const requireAuth = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", requireAuth, async (request, response) => {
  try {
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

    if (
      latitude === undefined ||
      longitude === undefined ||
      !terrainType ||
      !method
    ) {
      return response.status(400).json({
        message:
          "Latitude, longitude, terrain type, and method are required.",
      });
    }

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
router.get("/", requireAuth, async (request, response) => {
  try {
    const entries = await CatholeEntry.findAll({
      where: {
        userId: request.user.userId,
      },
      order: [["createdAt", "DESC"]],
    });

    response.status(200).json({
      count: entries.length,
      entries,
    });
  } catch (error) {
    console.error(error);

    response.status(500).json({
      message: "Something went wrong while loading cathole entries.",
    });
  }
});
module.exports = router;