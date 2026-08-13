const express = require("express");

const FinishedHike =
  require("../models/FinishedHike");

const requireAuth =
  require("../middleware/authMiddleware");

const router = express.Router();

function optionalText(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const cleanValue =
    String(value).trim();

  return cleanValue || null;
}

function optionalNumber(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function normalizeArray(value) {
  return Array.isArray(value)
    ? value
    : [];
}

function normalizeObject(value) {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value;
  }

  return null;
}

function normalizeFinishedHike(
  body
) {
  return {
    id:
      optionalText(body.id),

    routeKey:
      optionalText(body.routeKey),

    routeTitle:
      optionalText(body.routeTitle),

    routeSavedAt:
      optionalText(body.routeSavedAt),

    routeEntry:
      normalizeObject(
        body.routeEntry
      ),

    routeCoordinates:
      normalizeArray(
        body.routeCoordinates
      ),

    startedAt:
      optionalText(body.startedAt),

    endedAt:
      optionalText(body.endedAt),

    expectedReturn:
      optionalText(
        body.expectedReturn
      ),

    distanceMiles:
      optionalNumber(
        body.distanceMiles
      ) ?? 0,

    durationSeconds:
      optionalNumber(
        body.durationSeconds
      ) ?? 0,

    movingDurationSeconds:
      optionalNumber(
        body.movingDurationSeconds
      ),

    averagePaceMinutesPerMile:
      optionalNumber(
        body.averagePaceMinutesPerMile
      ),

    elevationGainFeet:
      optionalNumber(
        body.elevationGainFeet
      ),

    breadcrumbPoints:
      normalizeArray(
        body.breadcrumbPoints
      ),

    offRouteEvents:
      optionalNumber(
        body.offRouteEvents
      ) ?? 0,

    maxOffRouteFeet:
      optionalNumber(
        body.maxOffRouteFeet
      ),

    checkInCount:
      optionalNumber(
        body.checkInCount
      ) ?? 0,

    contact:
      optionalText(body.contact),

    vehicle:
      optionalText(body.vehicle),

    notes:
      optionalText(body.notes),

    waypoints:
      normalizeArray(
        body.waypoints
      ),

    safetyTimeline:
      normalizeArray(
        body.safetyTimeline
      ),

    weatherLog:
      normalizeArray(
        body.weatherLog
      ),

    conditionChecks:
      normalizeArray(
        body.conditionChecks
      ),

    journalSummary:
      optionalText(
        body.journalSummary
      ),

    bestMomentId:
      optionalText(
        body.bestMomentId
      ),

    isJournalPrivate:
      typeof body.isJournalPrivate ===
      "boolean"
        ? body.isJournalPrivate
        : true,

    postHikeQuality:
      normalizeObject(
        body.postHikeQuality
      ),

    correctionReview:
      normalizeObject(
        body.correctionReview
      ),

    savedHikeVerification:
      normalizeObject(
        body.savedHikeVerification
      ),

    savedHikeRepairHistory:
      normalizeArray(
        body.savedHikeRepairHistory
      ),
  };
}

function validateFinishedHike(
  hike
) {
  if (!hike.id) {
    return "Finished hike id is required.";
  }

  if (!hike.routeKey) {
    return "Route key is required.";
  }

  if (!hike.routeTitle) {
    return "Route title is required.";
  }

  if (!hike.startedAt) {
    return "Start time is required.";
  }

  if (!hike.endedAt) {
    return "End time is required.";
  }

  const started =
    new Date(hike.startedAt);

  const ended =
    new Date(hike.endedAt);

  if (
    Number.isNaN(
      started.getTime()
    )
  ) {
    return "Start time is invalid.";
  }

  if (
    Number.isNaN(
      ended.getTime()
    )
  ) {
    return "End time is invalid.";
  }

  if (ended < started) {
    return "End time cannot be before start time.";
  }

  if (
    hike.distanceMiles < 0
  ) {
    return "Distance cannot be negative.";
  }

  if (
    hike.durationSeconds < 0
  ) {
    return "Duration cannot be negative.";
  }

  if (
    hike.movingDurationSeconds !==
      null &&
    hike.movingDurationSeconds < 0
  ) {
    return "Moving duration cannot be negative.";
  }

  if (
    hike.elevationGainFeet !==
      null &&
    hike.elevationGainFeet < 0
  ) {
    return "Elevation gain cannot be negative.";
  }

  return null;
}

router.post(
  "/",
  requireAuth,
  async (
    request,
    response
  ) => {
    try {
      const normalized =
        normalizeFinishedHike(
          request.body || {}
        );

      const validationError =
        validateFinishedHike(
          normalized
        );

      if (validationError) {
        return response
          .status(400)
          .json({
            message:
              validationError,
          });
      }

      const [
        hike,
        created,
      ] =
        await FinishedHike.findOrCreate(
          {
            where: {
              id:
                normalized.id,

              userId:
                request.user.userId,
            },

            defaults: {
              ...normalized,

              userId:
                request.user.userId,
            },
          }
        );

      if (!created) {
        await hike.update(
          normalized
        );
      }

      return response
        .status(
          created
            ? 201
            : 200
        )
        .json({
          message:
            created
              ? "Finished hike saved successfully!"
              : "Finished hike updated successfully!",

          hike,
        });
    } catch (error) {
      console.error(
        "Finished hike save failed:",
        error
      );

      return response
        .status(500)
        .json({
          message:
            "Something went wrong while saving the finished hike.",
        });
    }
  }
);

router.get(
  "/",
  requireAuth,
  async (
    request,
    response
  ) => {
    try {
      const hikes =
        await FinishedHike.findAll(
          {
            where: {
              userId:
                request.user.userId,
            },

            order: [
              [
                "endedAt",
                "DESC",
              ],
            ],
          }
        );

      return response
        .status(200)
        .json({
          count:
            hikes.length,

          hikes,
        });
    } catch (error) {
      console.error(
        "Finished hike list failed:",
        error
      );

      return response
        .status(500)
        .json({
          message:
            "Something went wrong while loading finished hikes.",
        });
    }
  }
);

router.get(
  "/:id",
  requireAuth,
  async (
    request,
    response
  ) => {
    try {
      const hike =
        await FinishedHike.findOne(
          {
            where: {
              id:
                request.params.id,

              userId:
                request.user.userId,
            },
          }
        );

      if (!hike) {
        return response
          .status(404)
          .json({
            message:
              "Finished hike not found.",
          });
      }

      return response
        .status(200)
        .json({
          hike,
        });
    } catch (error) {
      console.error(
        "Finished hike load failed:",
        error
      );

      return response
        .status(500)
        .json({
          message:
            "Something went wrong while loading the finished hike.",
        });
    }
  }
);

router.delete(
  "/:id",
  requireAuth,
  async (
    request,
    response
  ) => {
    try {
      const hike =
        await FinishedHike.findOne(
          {
            where: {
              id:
                request.params.id,

              userId:
                request.user.userId,
            },
          }
        );

      if (!hike) {
        return response
          .status(404)
          .json({
            message:
              "Finished hike not found.",
          });
      }

      await hike.destroy();

      return response
        .status(200)
        .json({
          message:
            "Finished hike deleted successfully!",
        });
    } catch (error) {
      console.error(
        "Finished hike delete failed:",
        error
      );

      return response
        .status(500)
        .json({
          message:
            "Something went wrong while deleting the finished hike.",
        });
    }
  }
);

module.exports = router;