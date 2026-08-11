const express = require("express");
const fs = require("fs");
const multer = require("multer");
const path = require("path");
const cloudinary = require("cloudinary").v2;

const BeerSpotEntry = require("../models/BeerSpotEntry");
const Trip = require("../models/Trip");
const requireAuth = require("../middleware/authMiddleware");
const validateEntryId = require("../middleware/validateEntryId");
const validateBeerSpotEntry = require("../validators/beerSpotValidator");

const router = express.Router();

const uploadsDirectory = path.join(
  __dirname,
  "..",
  "..",
  "uploads"
);

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
        folder: "altipoop/beer-spots",
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
  } catch (error) {
    return null;
  }
}

async function deletePhotoFile(photoUrl) {
  if (!photoUrl) {
    return;
  }

  const publicId = cloudinaryPublicIdFromUrl(photoUrl);

  if (publicId) {
    try {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: "image",
        invalidate: true,
      });
    } catch (error) {
      console.error(
        "Could not delete Cloudinary beer-spot photo:",
        error
      );
    }

    return;
  }

  if (!String(photoUrl).startsWith("/uploads/")) {
    return;
  }

  const filename = path.basename(photoUrl);

  const fullPath = path.join(
    uploadsDirectory,
    filename
  );

  try {
    await fs.promises.unlink(fullPath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error(
        "Could not delete legacy beer-spot photo:",
        error
      );
    }
  }
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

  return Number.isNaN(numberValue)
    ? value
    : numberValue;
}

function optionalText(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const cleanValue = String(value).trim();

  return cleanValue || null;
}

function optionalTripId(value) {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const tripId = Number(value);

  if (!Number.isInteger(tripId) || tripId <= 0) {
    return NaN;
  }

  return tripId;
}

function booleanValue(value, fallback = false) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalized =
    String(value).trim().toLowerCase();

  if (
    normalized === "true" ||
    normalized === "1"
  ) {
    return true;
  }

  if (
    normalized === "false" ||
    normalized === "0"
  ) {
    return false;
  }

  return value;
}

async function validateOwnedTrip(tripId, userId) {
  if (tripId === null) {
    return true;
  }

  const trip = await Trip.findOne({
    where: {
      id: tripId,
      userId,
    },
  });

  return Boolean(trip);
}

router.post(
  "/",
  requireAuth,
  upload.single("photo"),
  async (request, response) => {
    let photoUrl = null;

    try {
      const {
        latitude,
        longitude,
        elevation,
        elevationSource,
        venueName,
        spotType,
        beerName,
        beerStyle,
        rating,
        postHikeStop,
        notes,
        tripId,
      } = request.body || {};

      const normalizedEntry = {
        latitude: Number(latitude),
        longitude: Number(longitude),

        elevation:
          optionalNumber(elevation),

        elevationSource:
          elevationSource || "unknown",

        venueName:
          String(venueName || "").trim(),

        spotType:
          spotType || "brewery",

        beerName:
          optionalText(beerName),

        beerStyle:
          optionalText(beerStyle),

        rating:
          optionalNumber(rating),

        postHikeStop:
          booleanValue(
            postHikeStop,
            false
          ),

        notes:
          optionalText(notes),

        tripId:
          optionalTripId(tripId),
      };

      if (
        Number.isNaN(
          normalizedEntry.tripId
        )
      ) {
        return response
          .status(400)
          .json({
            message:
              "Trip ID must be a positive whole number.",
          });
      }

      const tripIsValid =
        await validateOwnedTrip(
          normalizedEntry.tripId,
          request.user.userId
        );

      if (!tripIsValid) {
        return response
          .status(400)
          .json({
            message:
              "The selected trip was not found.",
          });
      }

      const validationError =
        validateBeerSpotEntry(
          normalizedEntry
        );

      if (validationError) {
        return response
          .status(400)
          .json({
            message:
              validationError,
          });
      }

      photoUrl = await uploadPhotoToCloudinary(
        request.file
      );

      const entry =
        await BeerSpotEntry.create({
          userId:
            request.user.userId,
          ...normalizedEntry,
          photoUrl,
        });

      response
        .status(201)
        .json({
          message:
            "Beer spot created successfully!",
          entry,
        });
    } catch (error) {
      await deletePhotoFile(photoUrl);
      console.error(error);

      response
        .status(500)
        .json({
          message:
            "Something went wrong while creating the beer spot.",
        });
    }
  }
);

router.get(
  "/",
  requireAuth,
  async (request, response) => {
    try {
      const entries =
        await BeerSpotEntry.findAll({
          where: {
            userId:
              request.user.userId,
          },

          order: [
            ["createdAt", "DESC"],
          ],
        });

      response
        .status(200)
        .json({
          count:
            entries.length,
          entries,
        });
    } catch (error) {
      console.error(error);

      response
        .status(500)
        .json({
          message:
            "Something went wrong while loading beer spots.",
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
      const entry =
        await BeerSpotEntry.findOne({
          where: {
            id:
              request.params.id,

            userId:
              request.user.userId,
          },
        });

      if (!entry) {
        return response
          .status(404)
          .json({
            message:
              "Beer spot not found.",
          });
      }

      response
        .status(200)
        .json({
          entry,
        });
    } catch (error) {
      console.error(error);

      response
        .status(500)
        .json({
          message:
            "Something went wrong while loading the beer spot.",
        });
    }
  }
);

router.put(
  "/:id",
  requireAuth,
  validateEntryId,
  upload.single("photo"),
  async (request, response) => {
    let newPhotoUrl = null;

    try {
      const entry =
        await BeerSpotEntry.findOne({
          where: {
            id:
              request.params.id,

            userId:
              request.user.userId,
          },
        });

      if (!entry) {
        return response
          .status(404)
          .json({
            message:
              "Beer spot not found.",
          });
      }

      const {
        latitude,
        longitude,
        elevation,
        elevationSource,
        venueName,
        spotType,
        beerName,
        beerStyle,
        rating,
        postHikeStop,
        notes,
        tripId,
        removePhoto,
      } = request.body || {};

      const normalizedEntry = {
        latitude:
          latitude !== undefined
            ? Number(latitude)
            : Number(
                entry.latitude
              ),

        longitude:
          longitude !== undefined
            ? Number(longitude)
            : Number(
                entry.longitude
              ),

        elevation:
          elevation !== undefined
            ? optionalNumber(
                elevation
              )
            : entry.elevation,

        elevationSource:
          elevationSource !== undefined
            ? elevationSource
            : entry.elevationSource,

        venueName:
          venueName !== undefined
            ? String(
                venueName || ""
              ).trim()
            : entry.venueName,

        spotType:
          spotType !== undefined
            ? spotType
            : entry.spotType,

        beerName:
          beerName !== undefined
            ? optionalText(
                beerName
              )
            : entry.beerName,

        beerStyle:
          beerStyle !== undefined
            ? optionalText(
                beerStyle
              )
            : entry.beerStyle,

        rating:
          rating !== undefined
            ? optionalNumber(
                rating
              )
            : entry.rating,

        postHikeStop:
          postHikeStop !== undefined
            ? booleanValue(
                postHikeStop
              )
            : entry.postHikeStop,

        notes:
          notes !== undefined
            ? optionalText(
                notes
              )
            : entry.notes,

        tripId:
          tripId !== undefined
            ? optionalTripId(
                tripId
              )
            : entry.tripId,
      };

      if (
        Number.isNaN(
          normalizedEntry.tripId
        )
      ) {
        return response
          .status(400)
          .json({
            message:
              "Trip ID must be a positive whole number.",
          });
      }

      const tripIsValid =
        await validateOwnedTrip(
          normalizedEntry.tripId,
          request.user.userId
        );

      if (!tripIsValid) {
        return response
          .status(400)
          .json({
            message:
              "The selected trip was not found.",
          });
      }

      const validationError =
        validateBeerSpotEntry(
          normalizedEntry
        );

      if (validationError) {
        return response
          .status(400)
          .json({
            message:
              validationError,
          });
      }

      const oldPhotoUrl =
        entry.photoUrl;

      newPhotoUrl =
        await uploadPhotoToCloudinary(
          request.file
        );

      let nextPhotoUrl =
        oldPhotoUrl;

      if (newPhotoUrl) {
        nextPhotoUrl =
          newPhotoUrl;
      } else if (
        String(removePhoto)
          .toLowerCase() ===
        "true"
      ) {
        nextPhotoUrl = null;
      }

      await entry.update({
        ...normalizedEntry,
        photoUrl:
          nextPhotoUrl,
      });

      if (
        oldPhotoUrl &&
        oldPhotoUrl !==
          nextPhotoUrl
      ) {
        await deletePhotoFile(
          oldPhotoUrl
        );
      }

      response
        .status(200)
        .json({
          message:
            "Beer spot updated successfully!",
          entry,
        });
    } catch (error) {
      await deletePhotoFile(
        newPhotoUrl
      );

      console.error(error);

      response
        .status(500)
        .json({
          message:
            "Something went wrong while updating the beer spot.",
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
      const entry =
        await BeerSpotEntry.findOne({
          where: {
            id:
              request.params.id,

            userId:
              request.user.userId,
          },
        });

      if (!entry) {
        return response
          .status(404)
          .json({
            message:
              "Beer spot not found.",
          });
      }

      const photoUrl =
        entry.photoUrl;

      await entry.destroy();

      await deletePhotoFile(
        photoUrl
      );

      response
        .status(200)
        .json({
          message:
            "Beer spot deleted successfully!",
        });
    } catch (error) {
      console.error(error);

      response
        .status(500)
        .json({
          message:
            "Something went wrong while deleting the beer spot.",
        });
    }
  }
);

module.exports = router;