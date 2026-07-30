const express = require("express");
const CatholeEntry = require("../models/CatholeEntry");
const requireAuth = require("../middleware/authMiddleware");
const validateCatholeEntry = require("../validators/catholeValidator");
const validateEntryId = require("../middleware/validateEntryId");

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
    } = request.body || {};

    const validationError = validateCatholeEntry(request.body || {});

    if (validationError) {
      return response.status(400).json({
        message: validationError,
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

router.get(
  "/:id",
  requireAuth,
  validateEntryId,
  async (request, response) => {
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

      response.status(200).json({
        entry,
      });
    } catch (error) {
      console.error(error);

      response.status(500).json({
        message: "Something went wrong while loading the cathole entry.",
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
      } = request.body || {};

      const updatedData = {
        latitude: latitude ?? entry.latitude,
        longitude: longitude ?? entry.longitude,
        terrainType: terrainType ?? entry.terrainType,
        method: method ?? entry.method,
        distanceFromWater:
          distanceFromWater ?? entry.distanceFromWater,
        distanceFromTrail:
          distanceFromTrail ?? entry.distanceFromTrail,
        distanceFromCamp:
          distanceFromCamp ?? entry.distanceFromCamp,
      };

      const validationError = validateCatholeEntry(updatedData);

      if (validationError) {
        return response.status(400).json({
          message: validationError,
        });
      }

      await entry.update({
        latitude: latitude ?? entry.latitude,
        longitude: longitude ?? entry.longitude,
        elevation: elevation ?? entry.elevation,
        terrainType: terrainType ?? entry.terrainType,
        method: method ?? entry.method,
        distanceFromWater:
          distanceFromWater ?? entry.distanceFromWater,
        distanceFromTrail:
          distanceFromTrail ?? entry.distanceFromTrail,
        distanceFromCamp:
          distanceFromCamp ?? entry.distanceFromCamp,
        depthConfirmed:
          depthConfirmed ?? entry.depthConfirmed,
        tpPackedOut:
          tpPackedOut ?? entry.tpPackedOut,
        notes: notes ?? entry.notes,
      });

      response.status(200).json({
        message: "Cathole entry updated successfully!",
        entry,
      });
    } catch (error) {
      console.error(error);

      response.status(500).json({
        message: "Something went wrong while updating the cathole entry.",
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
  }
);

module.exports = router;