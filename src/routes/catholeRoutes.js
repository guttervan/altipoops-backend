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
      return response.status(400).json({
        message: "Latitude must be between -90 and 90.",
      });
    }

    if (longitude < -180 || longitude > 180) {
      return response.status(400).json({
        message: "Longitude must be between -180 and 180.",
      });
    }

    if (!allowedTerrainTypes.includes(terrainType)) {
      return response.status(400).json({
        message:
          "Terrain type must be forest, desert, alpine, snow, or other.",
      });
    }

    if (!allowedMethods.includes(method)) {
      return response.status(400).json({
        message: "Method must be cathole, wag_bag, or groover.",
      });
    }

    if (
      distanceFromWater !== undefined &&
      distanceFromWater < 0
    ) {
      return response.status(400).json({
        message: "Distance from water cannot be negative.",
      });
    }

    if (
      distanceFromTrail !== undefined &&
      distanceFromTrail < 0
    ) {
      return response.status(400).json({
        message: "Distance from trail cannot be negative.",
      });
    }

    if (
      distanceFromCamp !== undefined &&
      distanceFromCamp < 0
    ) {
      return response.status(400).json({
        message: "Distance from camp cannot be negative.",
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

router.delete("/:id", requireAuth, async (request, response) => {
  try {
    const entry = await CatholeEntry.findOne({
      where: {
        id: request.params.id,
        userId: request.user.userId,
      },
    });

    if (!entry) {
      return response.status(404).json({
        message: "Cathole entry not found.",
      });
    }

    await entry.destroy();

    response.status(200).json({
      message: "Cathole entry deleted successfully!",
    });
  } catch (error) {
    console.error(error);

    response.status(500).json({
      message: "Something went wrong while deleting the cathole entry.",
    });
  }
});
module.exports = router;