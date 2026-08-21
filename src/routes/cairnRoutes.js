const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;

const CairnEntry = require("../models/CairnEntry");
const requireAuth = require("../middleware/authMiddleware");
const validateEntryId = require("../middleware/validateEntryId");

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter(request, file, callback) {
    if (!allowedMimeTypes.has(file.mimetype)) {
      const error = new Error(
        "Only JPEG, PNG, WebP, HEIC, and HEIF images are allowed."
      );
      error.statusCode = 400;
      callback(error);
      return;
    }

    callback(null, true);
  },
});

function uploadPhotoToCloudinary(file) {
  if (!file) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "altipoop/cairns",
        resource_type: "image",
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(result?.secure_url || null);
      }
    );

    stream.end(file.buffer);
  });
}

function cloudinaryPublicIdFromUrl(photoUrl) {
  try {
    const parsedUrl = new URL(photoUrl);

    if (parsedUrl.hostname !== "res.cloudinary.com") {
      return null;
    }

    const uploadMarker = "/upload/";
    const markerIndex = parsedUrl.pathname.indexOf(uploadMarker);

    if (markerIndex === -1) {
      return null;
    }

    let assetPath = parsedUrl.pathname.slice(
      markerIndex + uploadMarker.length
    );

    assetPath = assetPath.replace(/^v\d+\//, "");
    assetPath = decodeURIComponent(assetPath);

    return assetPath.replace(/\.[^/.]+$/, "");
  } catch {
    return null;
  }
}

async function deletePhoto(photoUrl) {
  if (!photoUrl) {
    return;
  }

  const publicId = cloudinaryPublicIdFromUrl(photoUrl);

  if (!publicId) {
    return;
  }

  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
      invalidate: true,
    });
  } catch (error) {
    console.error("Could not delete cairn photo:", error);
  }
}

function optionalText(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const cleanValue = String(value).trim();
  return cleanValue || null;
}

function optionalNumber(value) {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : NaN;
}

function parseBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  const cleanValue = String(value || "")
    .trim()
    .toLowerCase();

  if (
    cleanValue === "true" ||
    cleanValue === "1" ||
    cleanValue === "yes"
  ) {
    return true;
  }

  if (
    cleanValue === "false" ||
    cleanValue === "0" ||
    cleanValue === "no"
  ) {
    return false;
  }

  return null;
}

const categories = new Set([
  "legit",
  "questionable",
  "absurd",
  "monster",
  "summit",
]);

const locationModes = new Set([
  "private",
  "corridor",
  "masked",
  "generalized",
]);

router.post(
  "/",
  requireAuth,
  upload.single("photo"),
  async (request, response) => {
    let photoUrl = null;

    try {
      const {
        category,
        hikeTitle,
        collectedAt,
        elevationFeet,
        latitude,
        longitude,
        locationMode,
        note,
        isPublic,
      } = request.body || {};

      if (!request.file) {
        return response.status(400).json({
          message: "A cairn photo is required.",
        });
      }

      const cleanCategory = String(category || "")
        .trim()
        .toLowerCase();

      if (!categories.has(cleanCategory)) {
        return response.status(400).json({
          message: "Choose a valid cairn category.",
        });
      }

      const cleanLocationMode = String(
        locationMode || "private"
      )
        .trim()
        .toLowerCase();

      if (!locationModes.has(cleanLocationMode)) {
        return response.status(400).json({
          message: "Choose a valid cairn location mode.",
        });
      }

      const parsedLatitude = optionalNumber(latitude);
      const parsedLongitude = optionalNumber(longitude);
      const parsedElevation = optionalNumber(elevationFeet);

      if (
        Number.isNaN(parsedLatitude) ||
        Number.isNaN(parsedLongitude) ||
        Number.isNaN(parsedElevation)
      ) {
        return response.status(400).json({
          message: "Cairn location or elevation is invalid.",
        });
      }

      if (
        parsedLatitude !== null &&
        (parsedLatitude < -90 || parsedLatitude > 90)
      ) {
        return response.status(400).json({
          message: "Latitude must be between -90 and 90.",
        });
      }

      if (
        parsedLongitude !== null &&
        (parsedLongitude < -180 || parsedLongitude > 180)
      ) {
        return response.status(400).json({
          message: "Longitude must be between -180 and 180.",
        });
      }

      const requestedPublic =
        isPublic === undefined
          ? cleanLocationMode !== "private"
          : parseBoolean(isPublic);

      if (requestedPublic === null) {
        return response.status(400).json({
          message: "Public sharing must be true or false.",
        });
      }

      // Privacy rule: private cairns can never become public merely because
      // a client sends isPublic=true.
      const publicAllowed =
        cleanLocationMode !== "private";

      const normalizedIsPublic =
        publicAllowed && requestedPublic;

      const parsedCollectedAt = collectedAt
        ? new Date(collectedAt)
        : new Date();

      if (Number.isNaN(parsedCollectedAt.getTime())) {
        return response.status(400).json({
          message: "Collected date is invalid.",
        });
      }

      photoUrl = await uploadPhotoToCloudinary(
        request.file
      );

      if (!photoUrl) {
        return response.status(500).json({
          message: "The cairn photo could not be uploaded.",
        });
      }

      const entry = await CairnEntry.create({
        userId: request.user.userId,
        photoUrl,
        category: cleanCategory,
        hikeTitle: optionalText(hikeTitle),
        collectedAt: parsedCollectedAt,
        elevationFeet: parsedElevation,
        latitude: parsedLatitude,
        longitude: parsedLongitude,
        locationMode: cleanLocationMode,
        note: optionalText(note),
        isPublic: normalizedIsPublic,
      });

      response.status(201).json({
        message: normalizedIsPublic
          ? "Cairn saved and shared to the public field feed."
          : "Cairn saved privately.",
        entry,
      });
    } catch (error) {
      await deletePhoto(photoUrl);
      console.error("Could not create cairn entry:", error);

      response.status(500).json({
        message:
          "Something went wrong while creating the cairn entry.",
      });
    }
  }
);

router.get(
  "/",
  requireAuth,
  async (request, response) => {
    try {
      const entries = await CairnEntry.findAll({
        where: {
          userId: request.user.userId,
        },
        order: [["collectedAt", "DESC"]],
      });

      response.status(200).json({
        count: entries.length,
        entries,
      });
    } catch (error) {
      console.error("Could not load cairn entries:", error);

      response.status(500).json({
        message:
          "Something went wrong while loading cairn entries.",
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
      const entry = await CairnEntry.findOne({
        where: {
          id: request.params.id,
          userId: request.user.userId,
        },
      });

      if (!entry) {
        return response.status(404).json({
          message: "Cairn entry not found.",
        });
      }

      const photoUrl = entry.photoUrl;

      await entry.destroy();
      await deletePhoto(photoUrl);

      response.status(200).json({
        message: "Cairn entry deleted successfully!",
      });
    } catch (error) {
      console.error("Could not delete cairn entry:", error);

      response.status(500).json({
        message:
          "Something went wrong while deleting the cairn entry.",
      });
    }
  }
);

module.exports = router;
