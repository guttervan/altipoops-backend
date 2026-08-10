const express = require("express");

const Trip = require("../models/Trip");
const CatholeEntry = require("../models/CatholeEntry");
const WaterSourceEntry = require("../models/WaterSourceEntry");
const requireAuth = require("../middleware/authMiddleware");
const validateEntryId = require("../middleware/validateEntryId");

const router = express.Router();

function optionalText(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const cleanValue = String(value).trim();

  return cleanValue || null;
}

function optionalDate(value) {
  const cleanValue = optionalText(value);

  if (!cleanValue) {
    return null;
  }

  const parsedDate = new Date(cleanValue);

  return Number.isNaN(parsedDate.getTime())
    ? null
    : cleanValue;
}

function validateTrip({
  name,
  startDate,
  endDate,
}) {
  if (!name || !String(name).trim()) {
    return "Trip name is required.";
  }

  if (String(name).trim().length > 120) {
    return "Trip name must be 120 characters or fewer.";
  }

  if (
    startDate &&
    !optionalDate(startDate)
  ) {
    return "Start date must use a valid date.";
  }

  if (
    endDate &&
    !optionalDate(endDate)
  ) {
    return "End date must use a valid date.";
  }

  if (
    startDate &&
    endDate &&
    new Date(startDate) > new Date(endDate)
  ) {
    return "End date cannot be before the start date.";
  }

  return null;
}

router.post(
  "/",
  requireAuth,
  async (request, response) => {
    try {
      const {
        name,
        startDate,
        endDate,
        notes,
      } = request.body || {};

      const normalizedTrip = {
        name: String(name || "").trim(),
        startDate: optionalDate(startDate),
        endDate: optionalDate(endDate),
        notes: optionalText(notes),
      };

      const validationError =
        validateTrip(normalizedTrip);

      if (validationError) {
        return response.status(400).json({
          message: validationError,
        });
      }

      const trip = await Trip.create({
        userId: request.user.userId,
        ...normalizedTrip,
      });

      response.status(201).json({
        message: "Trip created successfully!",
        trip,
      });
    } catch (error) {
      console.error(error);

      response.status(500).json({
        message:
          "Something went wrong while creating the trip.",
      });
    }
  }
);

router.get(
  "/",
  requireAuth,
  async (request, response) => {
    try {
      const trips = await Trip.findAll({
        where: {
          userId: request.user.userId,
        },
        include: [
          {
            model: CatholeEntry,
            as: "catholes",
            attributes: ["id"],
            required: false,
          },
          {
            model: WaterSourceEntry,
            as: "waterSources",
            attributes: ["id"],
            required: false,
          },
        ],
        order: [
          ["startDate", "DESC"],
          ["createdAt", "DESC"],
        ],
      });

      const normalizedTrips = trips.map((trip) => {
        const plainTrip = trip.get({
          plain: true,
        });

        return {
          ...plainTrip,
          catholeCount:
            plainTrip.catholes?.length || 0,
          waterSourceCount:
            plainTrip.waterSources?.length || 0,
          totalEntries:
            (plainTrip.catholes?.length || 0) +
            (plainTrip.waterSources?.length || 0),
          catholes: undefined,
          waterSources: undefined,
        };
      });

      response.status(200).json({
        count: normalizedTrips.length,
        trips: normalizedTrips,
      });
    } catch (error) {
      console.error(error);

      response.status(500).json({
        message:
          "Something went wrong while loading trips.",
      });
    }
  }
);

router.get(
  "/:id",
  requireAuth,
  validateEntryId,
  async (request, response) => {
    try {
      const trip = await Trip.findOne({
        where: {
          id: request.params.id,
          userId: request.user.userId,
        },
        include: [
          {
            model: CatholeEntry,
            as: "catholes",
            required: false,
          },
          {
            model: WaterSourceEntry,
            as: "waterSources",
            required: false,
          },
        ],
      });

      if (!trip) {
        return response.status(404).json({
          message: "Trip not found.",
        });
      }

      response.status(200).json({
        trip,
      });
    } catch (error) {
      console.error(error);

      response.status(500).json({
        message:
          "Something went wrong while loading the trip.",
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
      const trip = await Trip.findOne({
        where: {
          id: request.params.id,
          userId: request.user.userId,
        },
      });

      if (!trip) {
        return response.status(404).json({
          message: "Trip not found.",
        });
      }

      const {
        name,
        startDate,
        endDate,
        notes,
      } = request.body || {};

      const normalizedTrip = {
        name:
          name !== undefined
            ? String(name).trim()
            : trip.name,
        startDate:
          startDate !== undefined
            ? optionalDate(startDate)
            : trip.startDate,
        endDate:
          endDate !== undefined
            ? optionalDate(endDate)
            : trip.endDate,
        notes:
          notes !== undefined
            ? optionalText(notes)
            : trip.notes,
      };

      const validationError =
        validateTrip(normalizedTrip);

      if (validationError) {
        return response.status(400).json({
          message: validationError,
        });
      }

      await trip.update(normalizedTrip);

      response.status(200).json({
        message: "Trip updated successfully!",
        trip,
      });
    } catch (error) {
      console.error(error);

      response.status(500).json({
        message:
          "Something went wrong while updating the trip.",
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
      const trip = await Trip.findOne({
        where: {
          id: request.params.id,
          userId: request.user.userId,
        },
      });

      if (!trip) {
        return response.status(404).json({
          message: "Trip not found.",
        });
      }

      await Promise.all([
        CatholeEntry.update(
          {
            tripId: null,
          },
          {
            where: {
              tripId: trip.id,
              userId: request.user.userId,
            },
          }
        ),
        WaterSourceEntry.update(
          {
            tripId: null,
          },
          {
            where: {
              tripId: trip.id,
              userId: request.user.userId,
            },
          }
        ),
      ]);

      await trip.destroy();

      response.status(200).json({
        message: "Trip deleted successfully!",
      });
    } catch (error) {
      console.error(error);

      response.status(500).json({
        message:
          "Something went wrong while deleting the trip.",
      });
    }
  }
);

module.exports = router;