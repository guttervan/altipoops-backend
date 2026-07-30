const express = require("express");
const WaterSourceEntry = require("../models/WaterSourceEntry");
const requireAuth = require("../middleware/authMiddleware");
const validateEntryId = require("../middleware/validateEntryId");
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
    } = request.body || {};

    const validationError = validateWaterSourceEntry(request.body || {});

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

router.get(
  "/:id",
  requireAuth,
  validateEntryId,
  async (request, response) => {
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
  }
);

router.put(
  "/:id",
  requireAuth,
  validateEntryId,
  async (request, response) => {
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

      const {
        latitude,
        longitude,
        elevation,
        sourceType,
        flowRating,
        lastConfirmedDate,
        potabilityNotes,
        notes,
      } = request.body || {};

      const updatedData = {
        latitude: latitude ?? entry.latitude,
        longitude: longitude ?? entry.longitude,
        sourceType: sourceType ?? entry.sourceType,
        flowRating: flowRating ?? entry.flowRating,
        lastConfirmedDate:
          lastConfirmedDate ?? entry.lastConfirmedDate,
      };

      const validationError =
        validateWaterSourceEntry(updatedData);

      if (validationError) {
        return response.status(400).json({
          message: validationError,
        });
      }

      await entry.update({
        latitude: latitude ?? entry.latitude,
        longitude: longitude ?? entry.longitude,
        elevation: elevation ?? entry.elevation,
        sourceType: sourceType ?? entry.sourceType,
        flowRating: flowRating ?? entry.flowRating,
        lastConfirmedDate:
          lastConfirmedDate ?? entry.lastConfirmedDate,
        potabilityNotes:
          potabilityNotes ?? entry.potabilityNotes,
        notes: notes ?? entry.notes,
      });

      response.status(200).json({
        message: "Water source entry updated successfully!",
        entry,
      });
    } catch (error) {
      console.error(error);

      response.status(500).json({
        message: "Something went wrong while updating the water source entry.",
      });
    }
  }
);

router.delete(
  "/:id",
  requireAuth,
  validateEntryId,
  async (request, response) => {
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

      await entry.destroy();

      response.status(200).json({
        message: "Water source entry deleted successfully!",
      });
    } catch (error) {
      console.error(error);

      response.status(500).json({
        message: "Something went wrong while deleting the water source entry.",
      });
    }
  }
);

module.exports = router;