const express = require("express");
const multer = require("multer");
const { InferenceClient } = require("@huggingface/inference");
const crypto = require("crypto");

const FinishedHike = require("../models/FinishedHike");
const PublicTrack = require("../models/PublicTrack");
const requireAuth = require("../middleware/authMiddleware");
const cloudinary = require("../config/cloudinary");

const router = express.Router();

const finishedHikePhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
  },
  fileFilter: (request, file, callback) => {
    if (
      file.mimetype === "image/jpeg" ||
      file.mimetype === "image/png" ||
      file.mimetype === "image/webp"
    ) {
      return callback(null, true);
    }

    const error = new Error(
      "Finished hike photos must be JPEG, PNG, or WebP."
    );
    error.statusCode = 400;
    return callback(error);
  },
});

function uploadFinishedHikePhotoToCloudinary(file, hikeId) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `altipoop/finished-hikes/${hikeId}`,
        resource_type: "image",
        overwrite: false,
        unique_filename: true,
        use_filename: false,
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }

        return resolve(result);
      }
    );

    uploadStream.end(file.buffer);
  });
}

function optionalText(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const cleanValue = String(value).trim();
  return cleanValue || null;
}

function optionalNumber(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }

  return null;
}

function normalizeFinishedHike(body) {
  return {
    id: optionalText(body.id),
    routeKey: optionalText(body.routeKey),
    routeTitle: optionalText(body.routeTitle),
    routeSavedAt: optionalText(body.routeSavedAt),
    routeEntry: normalizeObject(body.routeEntry),
    routeCoordinates: normalizeArray(body.routeCoordinates),
    startedAt: optionalText(body.startedAt),
    endedAt: optionalText(body.endedAt),
    expectedReturn: optionalText(body.expectedReturn),
    distanceMiles: optionalNumber(body.distanceMiles) ?? 0,
    durationSeconds: optionalNumber(body.durationSeconds) ?? 0,
    movingDurationSeconds: optionalNumber(body.movingDurationSeconds),
    averagePaceMinutesPerMile: optionalNumber(body.averagePaceMinutesPerMile),
    elevationGainFeet: optionalNumber(body.elevationGainFeet),
    breadcrumbPoints: normalizeArray(body.breadcrumbPoints),
    offRouteEvents: optionalNumber(body.offRouteEvents) ?? 0,
    maxOffRouteFeet: optionalNumber(body.maxOffRouteFeet),
    checkInCount: optionalNumber(body.checkInCount) ?? 0,
    contact: optionalText(body.contact),
    vehicle: optionalText(body.vehicle),
    notes: optionalText(body.notes),
    waypoints: normalizeArray(body.waypoints),
    safetyTimeline: normalizeArray(body.safetyTimeline),
    weatherLog: normalizeArray(body.weatherLog),
    conditionChecks: normalizeArray(body.conditionChecks),
    journalSummary: optionalText(body.journalSummary),
    bestMomentId: optionalText(body.bestMomentId),
    isJournalPrivate:
      typeof body.isJournalPrivate === "boolean" ? body.isJournalPrivate : true,
    postHikeQuality: normalizeObject(body.postHikeQuality),
    correctionReview: normalizeObject(body.correctionReview),
    savedHikeVerification: normalizeObject(body.savedHikeVerification),
    savedHikeRepairHistory: normalizeArray(body.savedHikeRepairHistory),
  };
}

function validateFinishedHike(hike) {
  if (!hike.id) return "Finished hike id is required.";
  if (!hike.routeKey) return "Route key is required.";
  if (!hike.routeTitle) return "Route title is required.";
  if (!hike.startedAt) return "Start time is required.";
  if (!hike.endedAt) return "End time is required.";

  const started = new Date(hike.startedAt);
  const ended = new Date(hike.endedAt);

  if (Number.isNaN(started.getTime())) return "Start time is invalid.";
  if (Number.isNaN(ended.getTime())) return "End time is invalid.";
  if (ended < started) return "End time cannot be before start time.";
  if (hike.distanceMiles < 0) return "Distance cannot be negative.";
  if (hike.durationSeconds < 0) return "Duration cannot be negative.";

  if (hike.movingDurationSeconds !== null && hike.movingDurationSeconds < 0) {
    return "Moving duration cannot be negative.";
  }

  if (hike.elevationGainFeet !== null && hike.elevationGainFeet < 0) {
    return "Elevation gain cannot be negative.";
  }

  return null;
}

function extractJson(rawText) {
  if (typeof rawText !== "string" || !rawText.trim()) {
    return null;
  }

  let text = rawText.trim();

  text = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    return JSON.parse(text);
  } catch (error) {
    // Try extracting only the JSON object.
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  try {
    return JSON.parse(text.slice(firstBrace, lastBrace + 1));
  } catch (error) {
    return null;
  }
}

function normalizeRecapString(value, maxLength = 900) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function normalizeRecapArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4)
    .map((item) => item.slice(0, 180));
}

function normalizeRecap(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const recap = {
    headline: normalizeRecapString(parsed.headline, 120),
    summary: normalizeRecapString(parsed.summary, 900),
    highlights: normalizeRecapArray(parsed.highlights),
    challenges: normalizeRecapArray(parsed.challenges),
    closing: normalizeRecapString(parsed.closing, 220),
  };

  if (
    !recap.headline &&
    !recap.summary &&
    recap.highlights.length === 0 &&
    recap.challenges.length === 0 &&
    !recap.closing
  ) {
    return null;
  }

  return recap;
}

function finiteOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function buildHikeFacts(hike) {
  const weatherLog =
    Array.isArray(hike.weatherLog)
      ? hike.weatherLog
      : [];

  const conditionChecks =
    Array.isArray(hike.conditionChecks)
      ? hike.conditionChecks
      : [];

  const waypoints =
    Array.isArray(hike.waypoints)
      ? hike.waypoints
      : [];

  const postHikeQuality =
    hike.postHikeQuality &&
    typeof hike.postHikeQuality ===
      "object"
      ? hike.postHikeQuality
      : null;

  const correctionReview =
    hike.correctionReview &&
    typeof hike.correctionReview ===
      "object"
      ? hike.correctionReview
      : null;

  return {
    routeTitle:
      hike.routeTitle,

    hasRecordedRouteDeviation:
      typeof hike.offRouteEvents ===
        "number" &&
      Number.isFinite(
        hike.offRouteEvents
      ) &&
      hike.offRouteEvents > 0,

    hasRecordedCheckIns:
      typeof hike.checkInCount ===
        "number" &&
      Number.isFinite(
        hike.checkInCount
      ) &&
      hike.checkInCount > 0,

    waypointKinds:
      waypoints
        .map(
          (waypoint) =>
            typeof waypoint?.kind ===
              "string"
              ? waypoint.kind.trim()
              : null
        )
        .filter(Boolean)
        .slice(0, 12),

    weatherEvents:
      weatherLog
        .map(
          (event) => ({
            label:
              typeof event?.label ===
                "string"
                ? event.label.trim()
                : null,

            severity:
              typeof event?.severity ===
                "string"
                ? event.severity.trim()
                : null,
          })
        )
        .filter(
          (event) =>
            event.label
        )
        .slice(0, 12),

    conditionLevels:
      conditionChecks
        .map(
          (check) =>
            typeof check?.level ===
              "string"
              ? check.level.trim()
              : null
        )
        .filter(Boolean)
        .slice(0, 12),

    quality:
      postHikeQuality
        ? {
            grade:
              typeof postHikeQuality.grade ===
                "string"
                ? postHikeQuality.grade
                : null,
          }
        : null,

    correction:
      correctionReview
        ? {
            status:
              typeof correctionReview.status ===
                "string"
                ? correctionReview.status
                : null,

            decision:
              typeof correctionReview.decision ===
                "string"
                ? correctionReview.decision
                : null,

            applied:
              correctionReview.applied ===
                true,
          }
        : null,
  };
}


function normalizeFinishedHikePhoto(body) {
  const url = optionalText(body?.url);
  const caption = optionalText(body?.caption);
  const takenAt = optionalText(body?.takenAt);
  const source = optionalText(body?.source) || "website";

  if (!url) {
    return {
      error: "Photo URL is required.",
    };
  }

  if (!/^https?:\/\//i.test(url)) {
    return {
      error: "Photo URL must use http or https.",
    };
  }

  if (takenAt) {
    const parsedTakenAt = new Date(takenAt);

    if (Number.isNaN(parsedTakenAt.getTime())) {
      return {
        error: "Photo takenAt value is invalid.",
      };
    }
  }

  return {
    photo: {
      id:
        optionalText(body?.id) ||
        `photo-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      url: url.slice(0, 1600),
      caption: caption ? caption.slice(0, 300) : null,
      takenAt: takenAt || null,
      source: source.slice(0, 80),
      addedAt: new Date().toISOString(),
    },
  };
}

function normalizeStoredPhotos(value) {
  return Array.isArray(value)
    ? value.filter(
        (item) =>
          item &&
          typeof item === "object" &&
          !Array.isArray(item) &&
          typeof item.url === "string" &&
          item.url.trim()
      )
    : [];
}

function cleanJournalText(value, maxLength = 1200) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function normalizeJournalObservationGroups(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const allowedGroups = [
    "terrain",
    "vegetation",
    "weather",
    "trail",
    "water",
    "snow",
    "wildlife",
    "other",
    "uncertainties",
  ];

  const normalized = {};

  for (const key of allowedGroups) {
    if (!Array.isArray(value[key])) {
      continue;
    }

    const items = value[key]
      .filter((item) => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 8)
      .map((item) => item.slice(0, 240));

    if (items.length) {
      normalized[key] = items;
    }
  }

  return normalized;
}

function buildManualJournalBlock(body) {
  const summary = cleanJournalText(body?.summary, 1200);

  if (!summary) {
    return {
      error: "Journal text is required.",
    };
  }

  const recordedAt = new Date().toISOString();

  return {
    entry: [
      `[Journal Entry · ${recordedAt}]`,
      summary,
    ].join("\n"),
    recordedAt,
    summary,
    photoName: null,
    photoUrl: null,
    observations: {},
    type: "manual",
  };
}

function buildPhotoJournalBlock(body) {
  const summary = cleanJournalText(body?.summary, 1200);
  const photoName = cleanJournalText(body?.photoName, 180);
  const photoUrl = cleanJournalText(body?.photoUrl, 1200);
  const observations = normalizeJournalObservationGroups(
    body?.observations
  );

  if (!summary && Object.keys(observations).length === 0) {
    return {
      error:
        "A visible summary or at least one observation is required.",
    };
  }

  if (
    photoUrl &&
    !/^https?:\/\//i.test(photoUrl)
  ) {
    return {
      error:
        "Photo URL must use http or https.",
    };
  }

  const recordedAt = new Date().toISOString();
  const lines = [
    `[Trail Photo Observation · ${recordedAt}]`,
  ];

  if (photoName) {
    lines.push(`Photo: ${photoName}`);
  }

  if (photoUrl) {
    lines.push(`Photo URL: ${photoUrl}`);
  }

  if (summary) {
    lines.push(`Visible summary: ${summary}`);
  }

  for (const [group, items] of Object.entries(observations)) {
    const label =
      group.charAt(0).toUpperCase() +
      group.slice(1);

    lines.push(`${label}: ${items.join(" | ")}`);
  }

  lines.push(
    "Note: AI-assisted visual observations only; no safety conclusion recorded."
  );

  return {
    entry: lines.join("\n"),
    recordedAt,
    summary,
    photoName: photoName || null,
    photoUrl: photoUrl || null,
    observations,
  };
}

router.post("/", requireAuth, async (request, response) => {
  try {
    const normalized = normalizeFinishedHike(request.body || {});
    const validationError = validateFinishedHike(normalized);

    if (validationError) {
      return response.status(400).json({ message: validationError });
    }

    const [hike, created] = await FinishedHike.findOrCreate({
      where: {
        id: normalized.id,
        userId: request.user.userId,
      },
      defaults: {
        ...normalized,
        userId: request.user.userId,
      },
    });

    if (!created) {
      await hike.update(normalized);
    }

    return response.status(created ? 201 : 200).json({
      message: created
        ? "Finished hike saved successfully!"
        : "Finished hike updated successfully!",
      hike,
    });
  } catch (error) {
    console.error("Finished hike save failed:", error);

    return response.status(500).json({
      message: "Something went wrong while saving the finished hike.",
    });
  }
});

router.get("/", requireAuth, async (request, response) => {
  try {
    const hikes = await FinishedHike.findAll({
      where: {
        userId: request.user.userId,
      },
      order: [["endedAt", "DESC"]],
    });

    return response.status(200).json({
      count: hikes.length,
      hikes,
    });
  } catch (error) {
    console.error("Finished hike list failed:", error);

    return response.status(500).json({
      message: "Something went wrong while loading finished hikes.",
    });
  }
});


router.post(
  "/:id/photos/upload",
  requireAuth,
  finishedHikePhotoUpload.single("photo"),
  async (request, response) => {
    try {
      const hike = await FinishedHike.findOne({
        where: {
          id: request.params.id,
          userId: request.user.userId,
        },
      });

      if (!hike) {
        return response.status(404).json({
          message: "Finished hike not found.",
        });
      }

      if (!request.file) {
        return response.status(400).json({
          message: "A photo file is required.",
        });
      }

      const existingPhotos =
        normalizeStoredPhotos(hike.photos);

      if (existingPhotos.length >= 50) {
        return response.status(400).json({
          message:
            "This finished hike already has the maximum of 50 photos.",
        });
      }

      const uploadResult =
        await uploadFinishedHikePhotoToCloudinary(
          request.file,
          hike.id
        );

      if (!uploadResult?.secure_url) {
        return response.status(502).json({
          message:
            "Cloudinary did not return a photo URL.",
        });
      }

      const caption =
        optionalText(request.body?.caption);
      const takenAt =
        optionalText(request.body?.takenAt);

      if (takenAt) {
        const parsedTakenAt =
          new Date(takenAt);

        if (
          Number.isNaN(
            parsedTakenAt.getTime()
          )
        ) {
          if (uploadResult.public_id) {
            await cloudinary.uploader
              .destroy(uploadResult.public_id)
              .catch(() => {});
          }

          return response.status(400).json({
            message:
              "Photo takenAt value is invalid.",
          });
        }
      }

      const photo = {
        id:
          `photo-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 10)}`,
        url: uploadResult.secure_url,
        cloudinaryPublicId:
          uploadResult.public_id || null,
        caption:
          caption
            ? caption.slice(0, 300)
            : null,
        takenAt:
          takenAt || null,
        source: "website-upload",
        originalName:
          optionalText(
            request.file.originalname
          ),
        width:
          Number.isFinite(uploadResult.width)
            ? uploadResult.width
            : null,
        height:
          Number.isFinite(uploadResult.height)
            ? uploadResult.height
            : null,
        format:
          optionalText(uploadResult.format),
        bytes:
          Number.isFinite(uploadResult.bytes)
            ? uploadResult.bytes
            : null,
        addedAt:
          new Date().toISOString(),
      };

      const nextPhotos = [
        ...existingPhotos,
        photo,
      ];

      try {
        await hike.update({
          photos: nextPhotos,
        });
      } catch (databaseError) {
        if (uploadResult.public_id) {
          await cloudinary.uploader
            .destroy(uploadResult.public_id)
            .catch(() => {});
        }

        throw databaseError;
      }

      return response.status(201).json({
        message:
          "Photo uploaded and attached to finished hike successfully!",
        hikeId: hike.id,
        photo,
        photos: hike.photos,
      });
    } catch (error) {
      console.error(
        "Finished hike photo upload failed:",
        error
      );

      return response.status(500).json({
        message:
          "Something went wrong while uploading the photo.",
      });
    }
  }
);


router.post("/:id/photos", requireAuth, async (request, response) => {
  try {
    const hike = await FinishedHike.findOne({
      where: {
        id: request.params.id,
        userId: request.user.userId,
      },
    });

    if (!hike) {
      return response.status(404).json({
        message: "Finished hike not found.",
      });
    }

    const normalized = normalizeFinishedHikePhoto(
      request.body || {}
    );

    if (normalized.error) {
      return response.status(400).json({
        message: normalized.error,
      });
    }

    const existingPhotos =
      normalizeStoredPhotos(hike.photos);

    if (existingPhotos.length >= 50) {
      return response.status(400).json({
        message:
          "This finished hike already has the maximum of 50 photos.",
      });
    }

    const duplicate = existingPhotos.some(
      (photo) =>
        photo.id === normalized.photo.id ||
        photo.url === normalized.photo.url
    );

    if (duplicate) {
      return response.status(409).json({
        message:
          "That photo is already attached to this finished hike.",
      });
    }

    const nextPhotos = [
      ...existingPhotos,
      normalized.photo,
    ];

    await hike.update({
      photos: nextPhotos,
    });

    return response.status(201).json({
      message:
        "Photo attached to finished hike successfully!",
      hikeId: hike.id,
      photo: normalized.photo,
      photos: hike.photos,
    });
  } catch (error) {
    console.error(
      "Finished hike photo attach failed:",
      error
    );

    return response.status(500).json({
      message:
        "Something went wrong while attaching the photo.",
    });
  }
});

router.put(
  "/:id/photos/:photoId/analysis",
  requireAuth,
  async (request, response) => {
    try {
      const hike = await FinishedHike.findOne({
        where: {
          id: request.params.id,
          userId: request.user.userId,
        },
      });

      if (!hike) {
        return response.status(404).json({
          message: "Finished hike not found.",
        });
      }

      const existingPhotos =
        normalizeStoredPhotos(hike.photos);

      const photoIndex = existingPhotos.findIndex(
        (photo) =>
          photo.id === request.params.photoId
      );

      if (photoIndex < 0) {
        return response.status(404).json({
          message: "Finished hike photo not found.",
        });
      }

      const summary =
        cleanJournalText(
          request.body?.summary,
          1200
        );

      const observations =
        normalizeJournalObservationGroups(
          request.body?.observations
        );

      if (
        !summary &&
        Object.keys(observations).length === 0
      ) {
        return response.status(400).json({
          message:
            "A visible summary or at least one observation is required.",
        });
      }

      const analysis = {
        summary: summary || null,
        ...observations,
        provider:
          optionalText(
            request.body?.provider
          ) || "huggingface",
        savedAt:
          new Date().toISOString(),
        safetyNote:
          "AI-assisted visual observations only; no safety conclusion recorded.",
      };

      const updatedPhoto = {
        ...existingPhotos[photoIndex],
        analysis,
      };

      const nextPhotos = [
        ...existingPhotos,
      ];

      nextPhotos[photoIndex] =
        updatedPhoto;

      await hike.update({
        photos: nextPhotos,
      });

      return response.status(200).json({
        message:
          "Trail photo analysis saved successfully!",
        hikeId: hike.id,
        photo: updatedPhoto,
        photos: hike.photos,
      });
    } catch (error) {
      console.error(
        "Finished hike photo analysis save failed:",
        error
      );

      return response.status(500).json({
        message:
          "Something went wrong while saving the trail photo analysis.",
      });
    }
  }
);


function normalizeCairnCollector(body) {
  const allowedCategories = [
    "LEGIT",
    "QUESTIONABLE",
    "ABSURD",
    "MONSTER",
    "SUMMIT",
  ];

  const category =
    optionalText(body?.category)?.toUpperCase() || null;

  if (!category || !allowedCategories.includes(category)) {
    return {
      error:
        "Cairn category must be LEGIT, QUESTIONABLE, ABSURD, MONSTER, or SUMMIT.",
    };
  }

  const note = optionalText(body?.note);

  return {
    cairnCollector: {
      category,
      note: note ? note.slice(0, 500) : null,
      isPublic: false,
      addedAt: new Date().toISOString(),
    },
  };
}


router.put(
  "/:id/photos/:photoId/cairn-collector",
  requireAuth,
  async (request, response) => {
    try {
      const hike = await FinishedHike.findOne({
        where: {
          id: request.params.id,
          userId: request.user.userId,
        },
      });

      if (!hike) {
        return response.status(404).json({
          message: "Finished hike not found.",
        });
      }

      const existingPhotos =
        normalizeStoredPhotos(hike.photos);

      const photoIndex = existingPhotos.findIndex(
        (photo) =>
          photo.id === request.params.photoId
      );

      if (photoIndex < 0) {
        return response.status(404).json({
          message: "Finished hike photo not found.",
        });
      }

      const normalized =
        normalizeCairnCollector(request.body || {});

      if (normalized.error) {
        return response.status(400).json({
          message: normalized.error,
        });
      }

      const existingCairnCollector =
        existingPhotos[photoIndex].cairnCollector &&
        typeof existingPhotos[photoIndex].cairnCollector === "object"
          ? existingPhotos[photoIndex].cairnCollector
          : null;

      const updatedPhoto = {
        ...existingPhotos[photoIndex],
        cairnCollector: {
          ...normalized.cairnCollector,
          isPublic:
            existingCairnCollector?.isPublic === true,
          addedAt:
            existingCairnCollector?.addedAt ||
            normalized.cairnCollector.addedAt,
          updatedAt:
            new Date().toISOString(),
          fieldRead:
            existingCairnCollector?.fieldRead || null,
        },
      };

      const nextPhotos = [
        ...existingPhotos,
      ];

      nextPhotos[photoIndex] =
        updatedPhoto;

      await hike.update({
        photos: nextPhotos,
      });

      return response.status(200).json({
        message: existingCairnCollector
          ? "Cairn Collector specimen updated successfully!"
          : "Photo added to Cairn Collector successfully!",
        hikeId: hike.id,
        photo: updatedPhoto,
        photos: hike.photos,
      });
    } catch (error) {
      console.error(
        "Cairn Collector save failed:",
        error
      );

      return response.status(500).json({
        message:
          "Something went wrong while adding the photo to Cairn Collector.",
      });
    }
  }
);


router.put(
  "/:id/photos/:photoId/cairn-collector/field-read",
  requireAuth,
  async (request, response) => {
    try {
      const hike = await FinishedHike.findOne({
        where: {
          id: request.params.id,
          userId: request.user.userId,
        },
      });

      if (!hike) {
        return response.status(404).json({
          message: "Finished hike not found.",
        });
      }

      const existingPhotos =
        normalizeStoredPhotos(hike.photos);

      const photoIndex = existingPhotos.findIndex(
        (photo) =>
          photo.id === request.params.photoId
      );

      if (photoIndex < 0) {
        return response.status(404).json({
          message: "Finished hike photo not found.",
        });
      }

      const existingCairnCollector =
        existingPhotos[photoIndex].cairnCollector;

      if (
        !existingCairnCollector ||
        typeof existingCairnCollector !== "object"
      ) {
        return response.status(404).json({
          message:
            "That photo is not in the Cairn Collector.",
        });
      }

      if (existingCairnCollector.fieldRead) {
        return response.status(200).json({
          message:
            "Cairn Field Read was already saved.",
          hikeId: hike.id,
          photo: existingPhotos[photoIndex],
          fieldRead:
            existingCairnCollector.fieldRead,
        });
      }

      const analysis =
        normalizeObject(request.body?.analysis);

      if (!analysis) {
        return response.status(400).json({
          message:
            "A Cairn Field Read analysis object is required.",
        });
      }

      const fieldRead = {
        analysis,
        provider:
          optionalText(request.body?.provider) ||
          "huggingface",
        model:
          optionalText(request.body?.model),
        savedAt:
          new Date().toISOString(),
      };

      const updatedPhoto = {
        ...existingPhotos[photoIndex],
        cairnCollector: {
          ...existingCairnCollector,
          fieldRead,
        },
      };

      const nextPhotos = [
        ...existingPhotos,
      ];

      nextPhotos[photoIndex] =
        updatedPhoto;

      await hike.update({
        photos: nextPhotos,
      });

      return response.status(200).json({
        message:
          "Cairn Field Read saved successfully!",
        hikeId: hike.id,
        photo: updatedPhoto,
        fieldRead,
        photos: hike.photos,
      });
    } catch (error) {
      console.error(
        "Cairn Field Read save failed:",
        error
      );

      return response.status(500).json({
        message:
          "Something went wrong while saving the Cairn Field Read.",
      });
    }
  }
);


router.put(
  "/:id/photos/:photoId/cairn-collector/visibility",
  requireAuth,
  async (request, response) => {
    try {
      const hike = await FinishedHike.findOne({
        where: {
          id: request.params.id,
          userId: request.user.userId,
        },
      });

      if (!hike) {
        return response.status(404).json({
          message: "Finished hike not found.",
        });
      }

      const existingPhotos =
        normalizeStoredPhotos(hike.photos);

      const photoIndex = existingPhotos.findIndex(
        (photo) =>
          photo.id === request.params.photoId
      );

      if (photoIndex < 0) {
        return response.status(404).json({
          message: "Finished hike photo not found.",
        });
      }

      const existingCairnCollector =
        existingPhotos[photoIndex].cairnCollector;

      if (!existingCairnCollector) {
        return response.status(404).json({
          message:
            "That photo is not in the Cairn Collector.",
        });
      }

      if (typeof request.body?.isPublic !== "boolean") {
        return response.status(400).json({
          message:
            "Cairn Collector visibility requires an isPublic boolean.",
        });
      }

      const updatedPhoto = {
        ...existingPhotos[photoIndex],
        cairnCollector: {
          ...existingCairnCollector,
          isPublic: request.body.isPublic,
          visibilityUpdatedAt:
            new Date().toISOString(),
        },
      };

      const nextPhotos = [
        ...existingPhotos,
      ];

      nextPhotos[photoIndex] =
        updatedPhoto;

      await hike.update({
        photos: nextPhotos,
      });

      return response.status(200).json({
        message: request.body.isPublic
          ? "Cairn Collector specimen shared publicly."
          : "Cairn Collector specimen set to private.",
        hikeId: hike.id,
        photo: updatedPhoto,
        photos: hike.photos,
      });
    } catch (error) {
      console.error(
        "Cairn Collector visibility update failed:",
        error
      );

      return response.status(500).json({
        message:
          "Something went wrong while updating Cairn Collector visibility.",
      });
    }
  }
);


router.get("/public/cairns", async (request, response) => {
  try {
    const hikes = await FinishedHike.findAll({
      attributes: [
        "id",
        "routeTitle",
        "endedAt",
        "photos",
      ],
      order: [["endedAt", "DESC"]],
    });

    const cairns = [];

    for (const hike of hikes) {
      const photos = normalizeStoredPhotos(hike.photos);

      for (const photo of photos) {
        const collector = photo?.cairnCollector;

        if (
          !collector ||
          collector.isPublic !== true
        ) {
          continue;
        }

        cairns.push({
          id: photo.id,
          photoUrl: photo.url,
          caption:
            typeof photo.caption === "string"
              ? photo.caption.slice(0, 300)
              : null,
          takenAt: photo.takenAt || null,
          category:
            typeof collector.category === "string"
              ? collector.category
              : null,
          note:
            typeof collector.note === "string"
              ? collector.note.slice(0, 500)
              : null,
          addedAt: collector.addedAt || null,
          fieldRead:
            collector.fieldRead &&
            typeof collector.fieldRead === "object"
              ? collector.fieldRead
              : null,
          hike: {
            title:
              typeof hike.routeTitle === "string"
                ? hike.routeTitle
                : null,
            endedAt: hike.endedAt || null,
          },
        });
      }
    }

    cairns.sort((a, b) => {
      const aTime = new Date(
        a.addedAt ||
        a.takenAt ||
        a.hike.endedAt ||
        0
      ).getTime();

      const bTime = new Date(
        b.addedAt ||
        b.takenAt ||
        b.hike.endedAt ||
        0
      ).getTime();

      return bTime - aTime;
    });

    return response.status(200).json({
      count: cairns.length,
      cairns,
    });
  } catch (error) {
    console.error(
      "Public Cairn Collector gallery load failed:",
      error
    );

    return response.status(500).json({
      message:
        "Something went wrong while loading the public Cairn Collector gallery.",
    });
  }
});


router.delete(
  "/:id/photos/:photoId/cairn-collector",
  requireAuth,
  async (request, response) => {
    try {
      const hike = await FinishedHike.findOne({
        where: {
          id: request.params.id,
          userId: request.user.userId,
        },
      });

      if (!hike) {
        return response.status(404).json({
          message: "Finished hike not found.",
        });
      }

      const existingPhotos =
        normalizeStoredPhotos(hike.photos);

      const photoIndex = existingPhotos.findIndex(
        (photo) =>
          photo.id === request.params.photoId
      );

      if (photoIndex < 0) {
        return response.status(404).json({
          message: "Finished hike photo not found.",
        });
      }

      if (!existingPhotos[photoIndex].cairnCollector) {
        return response.status(404).json({
          message:
            "That photo is not in the Cairn Collector.",
        });
      }

      const updatedPhoto = {
        ...existingPhotos[photoIndex],
      };

      delete updatedPhoto.cairnCollector;

      const nextPhotos = [
        ...existingPhotos,
      ];

      nextPhotos[photoIndex] =
        updatedPhoto;

      await hike.update({
        photos: nextPhotos,
      });

      return response.status(200).json({
        message:
          "Photo removed from Cairn Collector successfully!",
        hikeId: hike.id,
        photo: updatedPhoto,
        photos: hike.photos,
      });
    } catch (error) {
      console.error(
        "Cairn Collector remove failed:",
        error
      );

      return response.status(500).json({
        message:
          "Something went wrong while removing the photo from Cairn Collector.",
      });
    }
  }
);


router.delete(
  "/:id/photos/:photoId",
  requireAuth,
  async (request, response) => {
    try {
      const hike = await FinishedHike.findOne({
        where: {
          id: request.params.id,
          userId: request.user.userId,
        },
      });

      if (!hike) {
        return response.status(404).json({
          message: "Finished hike not found.",
        });
      }

      const existingPhotos =
        normalizeStoredPhotos(hike.photos);

      const photoToDelete =
        existingPhotos.find(
          (photo) =>
            photo.id === request.params.photoId
        );

      const nextPhotos = existingPhotos.filter(
        (photo) =>
          photo.id !== request.params.photoId
      );

      if (
        nextPhotos.length ===
        existingPhotos.length
      ) {
        return response.status(404).json({
          message:
            "Finished hike photo not found.",
        });
      }

      await hike.update({
        photos: nextPhotos,
      });

      if (photoToDelete?.cloudinaryPublicId) {
        try {
          await cloudinary.uploader.destroy(
            photoToDelete.cloudinaryPublicId
          );
        } catch (cloudinaryError) {
          console.error(
            "Cloudinary photo cleanup failed:",
            cloudinaryError
          );
        }
      }

      return response.status(200).json({
        message:
          "Photo removed from finished hike successfully!",
        hikeId: hike.id,
        photos: hike.photos,
      });
    } catch (error) {
      console.error(
        "Finished hike photo delete failed:",
        error
      );

      return response.status(500).json({
        message:
          "Something went wrong while removing the photo.",
      });
    }
  }
);


router.post("/:id/journal-entry", requireAuth, async (request, response) => {
  try {
    const hike = await FinishedHike.findOne({
      where: {
        id: request.params.id,
        userId: request.user.userId,
      },
    });

    if (!hike) {
      return response.status(404).json({
        message: "Finished hike not found.",
      });
    }

const requestBody = request.body || {};
const entryType =
  optionalText(requestBody.entryType)?.toLowerCase() || "trail-photo-observation";



const journalEntry =
  entryType === "manual"
    ? buildManualJournalBlock(requestBody)
    : buildPhotoJournalBlock(requestBody);

    if (journalEntry.error) {
      return response.status(400).json({
        message: journalEntry.error,
      });
    }

    const existingSummary =
      typeof hike.journalSummary === "string"
        ? hike.journalSummary.trim()
        : "";

    const nextSummary = existingSummary
      ? `${existingSummary}\n\n${journalEntry.entry}`
      : journalEntry.entry;

    await hike.update({
      journalSummary: nextSummary,
    });

    return response.status(201).json({
      message: "Journal entry added successfully!",
      hikeId: hike.id,
      journalEntry: {
        type:
          journalEntry.type === "manual"
            ? "manual"
            : "trail-photo-observation",
        recordedAt: journalEntry.recordedAt,
        summary: journalEntry.summary,
        photoName: journalEntry.photoName,
        photoUrl: journalEntry.photoUrl,
        observations: journalEntry.observations,
      },
      journalSummary: hike.journalSummary,
    });
  } catch (error) {
    console.error("Finished hike journal entry save failed:", error);

    return response.status(500).json({
      message:
        "Something went wrong while adding the journal entry.",
    });
  }
});

router.post("/:id/ai-recap", requireAuth, async (request, response) => {
  try {
    if (!process.env.HF_TOKEN) {
      return response.status(503).json({
        message: "AI hike recap is not configured yet.",
      });
    }

    const hike = await FinishedHike.findOne({
      where: {
        id: request.params.id,
        userId: request.user.userId,
      },
    });

    if (!hike) {
      return response.status(404).json({
        message: "Finished hike not found.",
      });
    }

    const facts = buildHikeFacts(hike.toJSON());

    const prompt = `
You are Altipoop AI Hike Recap.

Write a short post-hike recap using ONLY the sanitized hike facts supplied below.

Return ONLY one JSON object with EXACTLY these lowercase keys:

{
  "headline": "",
  "summary": "",
  "highlights": [],
  "challenges": [],
  "closing": ""
}

STRICT RULES:

- Do not use markdown.
- Do not use code fences.
- Do not add text before or after the JSON.
- Keep headline under 10 words.
- Keep summary to 2 short sentences maximum.
- Maximum 3 highlights.
- Maximum 3 challenges.
- Keep closing to 1 short sentence.
- Do not invent events, scenery, wildlife, weather, terrain, route conditions, emotions, motives, achievements, locations, or safety conclusions.
- Do not infer anything from the route title, including whether the route was planned, followed, completed, or reached.
- Do not claim a summit, destination, or named place was reached unless the supplied facts explicitly establish it.
- Do not include coordinates.
- Do not provide medical, rescue, avalanche, climbing, wildlife, or water-safety advice.
- Do not call the hike safe or unsafe.
- Do not mention private contact, vehicle, GPS coordinates, or raw breadcrumb data.
- Do not mention ANY numeric hike statistics in headline, summary, highlights, challenges, or closing. Altipoop displays verified numeric stats separately.
- Do not say "planned route", "intended path", "completed the route", "completed as planned", "as scheduled", "successfully", or similar language unless a supplied fact explicitly says that.
- A route title is only a title. It does not establish that the route was planned, followed, completed, or reached.
- If hasRecordedRouteDeviation is true, you may describe it only as "a recorded route deviation" or "recorded route deviations".
- If hasRecordedCheckIns is true, you may say only that a check-in or check-ins were recorded.
- You may describe recorded weather events only by the supplied labels, without adding causes or consequences.
- You may describe hiker-condition checks only by their supplied level, without interpreting health or safety.
- If the facts are sparse, keep the recap sparse rather than guessing.
- "challenges" must be empty when there is no directly recorded challenge fact.
- "highlights" must be empty when there is no directly recorded highlight fact.
- The closing must be neutral. Good examples: "The hike ended at the recorded finish time." or "The recording ended with the hike saved."
- Never transform a statistic into an inferred accomplishment or judgment.

SANITIZED HIKE FACTS:

${JSON.stringify(facts, null, 2)}
    `.trim();

    const client = new InferenceClient(process.env.HF_TOKEN);

    const completion = await client.chatCompletion({
      model: "zai-org/GLM-4.5V",

      extra_body: {
        chat_template_kwargs: {
          enable_thinking: false,
        },
      },

      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],

      temperature: 0.1,

      max_tokens: 900,
    });

    const rawText =
      completion
        ?.choices?.[0]
        ?.message?.content;

    if (!rawText) {
      return response.status(502).json({
        message: "Hugging Face returned an empty recap.",
      });
    }

    const parsed = extractJson(rawText);

    if (!parsed) {
      console.error("AI hike recap JSON could not be parsed:", rawText);

      return response.status(502).json({
        message: "Hugging Face returned an invalid recap.",
      });
    }

    const recap = normalizeRecap(parsed);

    if (!recap) {
      console.error("AI hike recap could not be normalized:", parsed);

      return response.status(502).json({
        message: "Hugging Face returned an unusable recap.",
      });
    }

    return response.status(200).json({
      provider: "huggingface",
      hikeId: hike.id,
      facts,
      recap,
    });
  } catch (error) {
    console.error("AI hike recap failed:", error);

    return response.status(500).json({
      message: "Something went wrong while generating the AI hike recap.",
    });
  }
});

function clampPublicText(value, maxLength = 180) {
  const textValue = optionalText(value);
  return textValue ? textValue.slice(0, maxLength) : null;
}

function normalizePublicTerrainTags(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(
    value
      .filter((item) => typeof item === "string")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 12)
      .map((item) => item.slice(0, 40))
  )];
}

function normalizePublicSignalCounts(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const allowed = [
    "water",
    "snow",
    "wildlife",
    "trail",
    "deadfall",
    "mud",
    "ice",
    "wind",
    "smoke",
    "other",
  ];

  const counts = {};

  for (const key of allowed) {
    const count = Number(value[key]);

    if (Number.isFinite(count) && count > 0) {
      counts[key] = Math.min(999, Math.round(count));
    }
  }

  return counts;
}

function normalizePublicObservations(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item) =>
        item &&
        typeof item === "object" &&
        !Array.isArray(item)
    )
    .slice(0, 20)
    .map((item) => ({
      type:
        clampPublicText(item.type, 40) || "other",
      label:
        clampPublicText(item.label, 280),
      confidence:
        Number.isFinite(Number(item.confidence))
          ? Math.max(0, Math.min(1, Number(item.confidence)))
          : null,
    }))
    .filter((item) => item.label);
}

function normalizePublicPhotos(hike, selectedPhotoIds) {
  if (!Array.isArray(selectedPhotoIds) || selectedPhotoIds.length === 0) {
    return [];
  }

  const selected = new Set(
    selectedPhotoIds
      .filter((id) => typeof id === "string")
      .slice(0, 12)
  );

  return normalizeStoredPhotos(hike.photos)
    .filter((photo) => selected.has(photo.id))
    .map((photo) => ({
      id: photo.id,
      url: photo.url,
      caption:
        typeof photo.caption === "string"
          ? photo.caption.slice(0, 300)
          : null,
      takenAt: photo.takenAt || null,
    }));
}

function readCoordinatePoint(value) {
  if (!value) {
    return null;
  }

  let latitude = null;
  let longitude = null;
  let elevation = null;

  if (Array.isArray(value)) {
    if (value.length < 2) {
      return null;
    }

    const first = Number(value[0]);
    const second = Number(value[1]);

    if (!Number.isFinite(first) || !Number.isFinite(second)) {
      return null;
    }

    if (Math.abs(first) > 90 && Math.abs(second) <= 90) {
      longitude = first;
      latitude = second;
    } else if (Math.abs(second) > 90 && Math.abs(first) <= 90) {
      latitude = first;
      longitude = second;
    } else {
      latitude = first;
      longitude = second;
    }

    const possibleElevation = Number(value[2]);

    if (Number.isFinite(possibleElevation)) {
      elevation = possibleElevation;
    }
  } else if (typeof value === "object") {
    latitude = Number(
      value.latitude ??
      value.lat
    );

    longitude = Number(
      value.longitude ??
      value.lng ??
      value.lon
    );

    const possibleElevation = Number(
      value.elevation ??
      value.altitude ??
      value.ele
    );

    if (Number.isFinite(possibleElevation)) {
      elevation = possibleElevation;
    }
  }

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return null;
  }

  return {
    latitude,
    longitude,
    elevation,
  };
}

function extractFinishedHikeTrackPoints(hike) {
  const candidateSets = [
    hike.routeCoordinates,
    hike.breadcrumbPoints,
    hike.routeEntry?.coordinates,
    hike.routeEntry?.routeCoordinates,
    hike.routeEntry?.points,
  ];

  for (const candidate of candidateSets) {
    if (!Array.isArray(candidate)) {
      continue;
    }

    const points =
      candidate
        .map(readCoordinatePoint)
        .filter(Boolean);

    if (points.length >= 2) {
      return points;
    }
  }

  return [];
}

function haversineMiles(a, b) {
  const earthRadiusMiles = 3958.7613;
  const toRadians = (degrees) => degrees * Math.PI / 180;

  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLon = toRadians(b.longitude - a.longitude);

  const sinLat = Math.sin(deltaLat / 2);
  const sinLon = Math.sin(deltaLon / 2);

  const h =
    sinLat * sinLat +
    Math.cos(lat1) *
      Math.cos(lat2) *
      sinLon *
      sinLon;

  return 2 * earthRadiusMiles * Math.asin(Math.min(1, Math.sqrt(h)));
}

function cumulativeTrackMiles(points) {
  const cumulative = [0];

  for (let index = 1; index < points.length; index += 1) {
    cumulative[index] =
      cumulative[index - 1] +
      haversineMiles(points[index - 1], points[index]);
  }

  return cumulative;
}

function trimTrackByMiles(points, startTrimMiles, endTrimMiles) {
  if (points.length < 2) {
    return [];
  }

  const cumulative = cumulativeTrackMiles(points);
  const totalMiles = cumulative[cumulative.length - 1];

  if (
    totalMiles <= 0 ||
    startTrimMiles + endTrimMiles >= totalMiles
  ) {
    return points;
  }

  const startTarget = startTrimMiles;
  const endTarget = totalMiles - endTrimMiles;

  const trimmed = points.filter(
    (_, index) =>
      cumulative[index] >= startTarget &&
      cumulative[index] <= endTarget
  );

  return trimmed.length >= 2 ? trimmed : points;
}

function downsamplePoints(points, maxPoints) {
  if (points.length <= maxPoints) {
    return points;
  }

  const sampled = [];

  for (let index = 0; index < maxPoints; index += 1) {
    const sourceIndex = Math.round(
      index * (points.length - 1) / (maxPoints - 1)
    );

    sampled.push(points[sourceIndex]);
  }

  return sampled;
}

function sanitizeTrackGeometry(points, privacyMode) {
  if (points.length < 2) {
    return {
      geometry: [],
      startTrimMiles: 0,
      endTrimMiles: 0,
      locationPrecision: "none",
    };
  }

  if (privacyMode === "full") {
    return {
      geometry: points.map((point) => [
        point.longitude,
        point.latitude,
      ]),
      startTrimMiles: 0,
      endTrimMiles: 0,
      locationPrecision: "exact",
    };
  }

  const startTrimMiles =
    privacyMode === "corridor" ? 0.75 : 0.5;

  const endTrimMiles =
    privacyMode === "corridor" ? 0.75 : 0.5;

  const trimmed =
    trimTrackByMiles(
      points,
      startTrimMiles,
      endTrimMiles
    );

  const sampled =
    downsamplePoints(
      trimmed,
      privacyMode === "corridor" ? 60 : 180
    );

  const decimalPlaces =
    privacyMode === "corridor" ? 3 : 4;

  return {
    geometry:
      sampled.map((point) => [
        Number(point.longitude.toFixed(decimalPlaces)),
        Number(point.latitude.toFixed(decimalPlaces)),
      ]),
    startTrimMiles,
    endTrimMiles,
    locationPrecision:
      privacyMode === "corridor"
        ? "corridor"
        : "generalized",
  };
}

function buildPublicElevationProfile(points, distanceMiles) {
  const elevationPoints =
    points.filter(
      (point) =>
        Number.isFinite(point.elevation)
    );

  if (elevationPoints.length < 2) {
    return [];
  }

  const sampled =
    downsamplePoints(elevationPoints, 60);

  const cumulative =
    cumulativeTrackMiles(sampled);

  const measuredMiles =
    cumulative[cumulative.length - 1];

  return sampled.map((point, index) => {
    const mile =
      measuredMiles > 0
        ? cumulative[index]
        : (
            Number(distanceMiles) || 0
          ) * index / Math.max(1, sampled.length - 1);

    return [
      Number(mile.toFixed(2)),
      Math.round(point.elevation),
    ];
  });
}

function publicElevationExtremes(points) {
  const elevations =
    points
      .map((point) => point.elevation)
      .filter(Number.isFinite);

  if (!elevations.length) {
    return {
      highPointFt: null,
      lowPointFt: null,
    };
  }

  return {
    highPointFt: Math.max(...elevations),
    lowPointFt: Math.min(...elevations),
  };
}

function publicTrackResponse(track) {
  return {
    publicId: track.publicId,
    sourceHikeId: track.sourceHikeId,
    title: track.title,
    sharedAt: track.sharedAt,
    activityDate: track.activityDate,
    privacyMode: track.privacyMode,
    publicPointCount: track.publicPointCount,
    startTrimMiles: track.startTrimMiles,
    endTrimMiles: track.endTrimMiles,
    locationPrecision: track.locationPrecision,
    distanceMiles: track.distanceMiles,
    elevationGainFt: track.elevationGainFt,
    elevationLossFt: track.elevationLossFt,
    highPointFt: track.highPointFt,
    lowPointFt: track.lowPointFt,
    movingTimeSeconds: track.movingTimeSeconds,
    elapsedTimeSeconds: track.elapsedTimeSeconds,
    region: track.region,
    terrainTags: track.terrainTags,
    fieldSignalCounts: track.fieldSignalCounts,
    publicObservations: track.publicObservations,
    publicPhotos: track.publicPhotos,
    elevationProfile: track.elevationProfile,
    isAnonymous: track.isAnonymous,
    displayName:
      track.isAnonymous
        ? null
        : track.displayName,
    status: track.status,
  };
}

router.post(
  "/:id/public-track",
  requireAuth,
  async (request, response) => {
    try {
      const hike =
        await FinishedHike.findOne({
          where: {
            id: request.params.id,
            userId: request.user.userId,
          },
        });

      if (!hike) {
        return response.status(404).json({
          message: "Finished hike not found.",
        });
      }

      const privacyMode =
        optionalText(
          request.body?.privacyMode
        )?.toLowerCase() || "masked";

      if (
        ![
          "corridor",
          "masked",
          "full",
        ].includes(privacyMode)
      ) {
        return response.status(400).json({
          message:
            "privacyMode must be corridor, masked, or full.",
        });
      }

      if (
        privacyMode === "full" &&
        request.body?.confirmExactRoute !== true
      ) {
        return response.status(400).json({
          message:
            "Publishing an exact route requires confirmExactRoute: true.",
        });
      }

      const sourcePoints =
        extractFinishedHikeTrackPoints(hike);

      if (sourcePoints.length < 2) {
        return response.status(400).json({
          message:
            "This finished hike does not contain enough route points to publish.",
        });
      }

      const sanitized =
        sanitizeTrackGeometry(
          sourcePoints,
          privacyMode
        );

      const elevation =
        publicElevationExtremes(
          sourcePoints
        );

      const isAnonymous =
        request.body?.isAnonymous !== false;

      const title =
        clampPublicText(
          request.body?.title,
          140
        ) ||
        clampPublicText(
          hike.routeTitle,
          140
        );

      const terrainTags =
        normalizePublicTerrainTags(
          request.body?.terrainTags
        );

      const fieldSignalCounts =
        normalizePublicSignalCounts(
          request.body?.fieldSignalCounts
        );

      const publicObservations =
        normalizePublicObservations(
          request.body?.publicObservations
        );

      const publicPhotos =
        normalizePublicPhotos(
          hike,
          request.body?.publicPhotoIds
        );

      const elevationProfile =
        buildPublicElevationProfile(
          sourcePoints,
          hike.distanceMiles
        );

      const endedAt =
        hike.endedAt
          ? new Date(hike.endedAt)
          : new Date();

      const activityDate =
        Number.isNaN(endedAt.getTime())
          ? new Date().toISOString().slice(0, 10)
          : endedAt.toISOString().slice(0, 10);

      const now =
        new Date();

      let publicTrack =
        await PublicTrack.findOne({
          where: {
            sourceHikeId: hike.id,
          },
        });

      const values = {
        title,
        sharedAt: now,
        activityDate,
        privacyMode,
        geometry: sanitized.geometry,
        originalPointCount: sourcePoints.length,
        publicPointCount: sanitized.geometry.length,
        startTrimMiles: sanitized.startTrimMiles,
        endTrimMiles: sanitized.endTrimMiles,
        locationPrecision: sanitized.locationPrecision,
        distanceMiles:
          Number(hike.distanceMiles) || 0,
        elevationGainFt:
          Number.isFinite(Number(hike.elevationGainFeet))
            ? Number(hike.elevationGainFeet)
            : null,
        elevationLossFt:
          optionalNumber(request.body?.elevationLossFt),
        highPointFt:
          elevation.highPointFt,
        lowPointFt:
          elevation.lowPointFt,
        movingTimeSeconds:
          Number.isFinite(Number(hike.movingDurationSeconds))
            ? Math.round(Number(hike.movingDurationSeconds))
            : null,
        elapsedTimeSeconds:
          Number.isFinite(Number(hike.durationSeconds))
            ? Math.round(Number(hike.durationSeconds))
            : null,
        startedAtPublic:
          privacyMode === "corridor"
            ? null
            : hike.startedAt,
        region:
          clampPublicText(
            request.body?.region,
            120
          ),
        terrainTags,
        fieldSignalCounts,
        publicObservations,
        publicPhotos,
        elevationProfile,
        isAnonymous,
        displayName:
          isAnonymous
            ? null
            : clampPublicText(
                request.body?.displayName,
                80
              ),
        status: "active",
      };

      if (publicTrack) {
        await publicTrack.update(values);
      } else {
        publicTrack =
          await PublicTrack.create({
            id:
              `public-track-${crypto.randomUUID()}`,
            publicId:
              `pub-${crypto.randomUUID()}`,
            sourceHikeId: hike.id,
            userId: request.user.userId,
            ...values,
          });
      }

      return response.status(200).json({
        message:
          publicTrack.createdAt?.getTime?.() ===
          publicTrack.updatedAt?.getTime?.()
            ? "Finished hike published to Public Activity."
            : "Public Activity track updated.",
        publicTrack:
          publicTrackResponse(publicTrack),
      });
    } catch (error) {
      console.error(
        "Finished hike public-track publish failed:",
        error
      );

      return response.status(500).json({
        message:
          "Something went wrong while publishing the finished hike.",
      });
    }
  }
);

router.get(
  "/:id/public-track",
  requireAuth,
  async (request, response) => {
    try {
      const hike =
        await FinishedHike.findOne({
          where: {
            id: request.params.id,
            userId: request.user.userId,
          },

          attributes: [
            "id",
            "routeTitle",
          ],
        });

      if (!hike) {
        return response.status(404).json({
          message: "Finished hike not found.",
        });
      }

      const publicTrack =
        await PublicTrack.findOne({
          where: {
            sourceHikeId: hike.id,
            userId: request.user.userId,
          },
        });

      if (!publicTrack) {
        return response.status(200).json({
          hikeId: hike.id,
          published: false,
          publicTrack: null,
        });
      }

      return response.status(200).json({
        hikeId: hike.id,
        published:
          publicTrack.status === "active",
        publicTrack:
          publicTrackResponse(publicTrack),
      });
    } catch (error) {
      console.error(
        "Finished hike public-track status load failed:",
        error
      );

      return response.status(500).json({
        message:
          "Something went wrong while loading Public Activity status.",
      });
    }
  }
);


router.delete(
  "/:id/public-track",
  requireAuth,
  async (request, response) => {
    try {
      const hike =
        await FinishedHike.findOne({
          where: {
            id: request.params.id,
            userId: request.user.userId,
          },
        });

      if (!hike) {
        return response.status(404).json({
          message: "Finished hike not found.",
        });
      }

      const publicTrack =
        await PublicTrack.findOne({
          where: {
            sourceHikeId: hike.id,
            userId: request.user.userId,
          },
        });

      if (!publicTrack) {
        return response.status(404).json({
          message:
            "This finished hike is not published to Public Activity.",
        });
      }

      await publicTrack.update({
        status: "hidden",
      });

      return response.status(200).json({
        message:
          "Finished hike removed from Public Activity.",
        publicId: publicTrack.publicId,
        status: publicTrack.status,
      });
    } catch (error) {
      console.error(
        "Finished hike public-track unpublish failed:",
        error
      );

      return response.status(500).json({
        message:
          "Something went wrong while removing the finished hike from Public Activity.",
      });
    }
  }
);


router.get("/:id", requireAuth, async (request, response) => {
  try {
    const hike = await FinishedHike.findOne({
      where: {
        id: request.params.id,
        userId: request.user.userId,
      },
    });

    if (!hike) {
      return response.status(404).json({
        message: "Finished hike not found.",
      });
    }

    return response.status(200).json({ hike });
  } catch (error) {
    console.error("Finished hike load failed:", error);

    return response.status(500).json({
      message: "Something went wrong while loading the finished hike.",
    });
  }
});

router.delete("/:id", requireAuth, async (request, response) => {
  try {
    const hike = await FinishedHike.findOne({
      where: {
        id: request.params.id,
        userId: request.user.userId,
      },
    });

    if (!hike) {
      return response.status(404).json({
        message: "Finished hike not found.",
      });
    }

    await hike.destroy();

    return response.status(200).json({
      message: "Finished hike deleted successfully!",
    });
  } catch (error) {
    console.error("Finished hike delete failed:", error);

    return response.status(500).json({
      message: "Something went wrong while deleting the finished hike.",
    });
  }
});

module.exports = router;
