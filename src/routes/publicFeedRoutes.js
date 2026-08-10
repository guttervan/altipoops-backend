const express = require("express");

const WaterSourceEntry = require("../models/WaterSourceEntry");

const router = express.Router();

function publicCoordinate(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return null;
  }

  // Roughly neighborhood/trail-area precision instead of exposing
  // the exact private GPS point on the public website.
  return Number(numberValue.toFixed(3));
}

function publicPhotoUrl(request, photoUrl) {
  if (!photoUrl) {
    return null;
  }

  return `${request.protocol}://${request.get("host")}${photoUrl}`;
}

router.get(
  "/feed",
  async (request, response) => {
    try {
      const waterSources =
        await WaterSourceEntry.findAll({
          where: {
            isPublic: true,
          },

          order: [
            ["createdAt", "DESC"],
          ],

          limit: 50,
        });

      const items = waterSources.map(
        (entry) => ({
          id: `water-${entry.id}`,
          type: "water",

          sourceType: entry.sourceType,
          flowRating: entry.flowRating,

          elevation:
            entry.elevation === null
              ? null
              : Number(entry.elevation),

          lastConfirmedDate:
            entry.lastConfirmedDate,

          notes:
            entry.notes || null,

          potabilityNotes:
            entry.potabilityNotes || null,

          photoUrl: publicPhotoUrl(
            request,
            entry.photoUrl
          ),

          location: {
            latitude: publicCoordinate(
              entry.latitude
            ),

            longitude: publicCoordinate(
              entry.longitude
            ),
          },

          createdAt:
            entry.createdAt,

          updatedAt:
            entry.updatedAt,
        })
      );

      response.status(200).json({
        count: items.length,
        items,
      });
    } catch (error) {
      console.error(
        "Could not load public feed:",
        error
      );

      response.status(500).json({
        message:
          "Could not load the public Altipoop feed.",
      });
    }
  }
);

module.exports = router;