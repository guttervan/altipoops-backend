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

router.get("/", requireAuth, async (request, response) => {
  try {
    const entries = await WaterSourceEntry.findAll({
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
      message: "Something went wrong while loading water source entries.",
    });
  }
});
router.get("/:id", requireAuth, async (request, response) => {
  try {
    const entry = await WaterSourceEntry.findOne({
      where: {
        id: request.params.id,
        userId: request.user.userId,
      },
    });

    if (!entry) {
      return response.status(404).json({
        message: "Water source entry not found.",
      });
    }

    response.status(200).json({
      entry,
    });
  } catch (error) {
    console.error(error);

    response.status(500).json({
      message: "Something went wrong while loading the water source entry.",
    });
  }
});
module.exports = router;