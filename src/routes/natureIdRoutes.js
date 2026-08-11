const express = require("express");
const fs = require("fs");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const path = require("path");

const NatureObservation = require("../models/NatureObservation");
const requireAuth = require("../middleware/authMiddleware");

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadsDirectory = path.join(
  __dirname,
  "..",
  "..",
  "uploads"
);

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const identifyUpload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024,
  },

  fileFilter(request, file, callback) {
    if (!allowedMimeTypes.has(file.mimetype)) {
      const error = new Error(
        "Nature ID currently supports JPEG, PNG, and WebP photos."
      );

      error.statusCode = 400;
      callback(error);
      return;
    }

    callback(null, true);
  },
});

const saveUpload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize:
      5 * 1024 * 1024,
  },

  fileFilter(
    request,
    file,
    callback
  ) {
    if (
      !allowedMimeTypes.has(
        file.mimetype
      )
    ) {
      const error =
        new Error(
          "Nature ID currently supports JPEG, PNG, and WebP photos."
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
    const stream =
      cloudinary.uploader.upload_stream(
        {
          folder: "altipoop/nature",
          resource_type: "image",
        },
        (error, result) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(
            result?.secure_url || null
          );
        }
      );

    stream.end(file.buffer);
  });
}

function cloudinaryPublicIdFromUrl(
  photoUrl
) {
  try {
    const parsedUrl =
      new URL(photoUrl);

    if (
      parsedUrl.hostname !==
      "res.cloudinary.com"
    ) {
      return null;
    }

    const uploadMarker =
      "/upload/";

    const markerIndex =
      parsedUrl.pathname.indexOf(
        uploadMarker
      );

    if (markerIndex === -1) {
      return null;
    }

    let assetPath =
      parsedUrl.pathname.slice(
        markerIndex +
          uploadMarker.length
      );

    assetPath =
      assetPath.replace(
        /^v\d+\//,
        ""
      );

    assetPath =
      decodeURIComponent(
        assetPath
      );

    return assetPath.replace(
      /\.[^/.]+$/,
      ""
    );
  } catch {
    return null;
  }
}

async function deletePhotoFile(
  photoUrl
) {
  if (!photoUrl) {
    return;
  }

  const publicId =
    cloudinaryPublicIdFromUrl(
      photoUrl
    );

  if (publicId) {
    try {
      await cloudinary.uploader.destroy(
        publicId,
        {
          resource_type: "image",
          invalidate: true,
        }
      );
    } catch (error) {
      console.error(
        "Could not delete Cloudinary Nature ID photo:",
        error
      );
    }

    return;
  }

  if (
    !String(photoUrl).startsWith(
      "/uploads/"
    )
  ) {
    return;
  }

  const filename =
    path.basename(
      photoUrl
    );

  const fullPath =
    path.join(
      uploadsDirectory,
      filename
    );

  try {
    await fs.promises.unlink(
      fullPath
    );
  } catch (error) {
    if (
      error.code !== "ENOENT"
    ) {
      console.error(
        "Could not delete legacy Nature ID photo:",
        error
      );
    }
  }
}

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
    String(value).trim() === ""
  ) {
    return null;
  }

  const numberValue =
    Number(value);

  return Number.isFinite(numberValue)
    ? numberValue
    : null;
}

function normalizeMode(value) {
  const normalized =
    String(value || "auto")
      .trim()
      .toLowerCase();

  if (
    normalized === "mushroom" ||
    normalized === "plant" ||
    normalized === "insect"
  ) {
    return normalized;
  }

  return "auto";
}

function imageDataUrl(file) {
  const base64 =
    file.buffer.toString("base64");

  return (
    `data:${file.mimetype};base64,` +
    base64
  );
}

function extractResponseText(data) {
  if (
    typeof data?.output_text ===
      "string" &&
    data.output_text.trim()
  ) {
    return data.output_text.trim();
  }

  const textParts = [];

  for (const outputItem of data?.output || []) {
    for (const contentItem of outputItem?.content || []) {
      if (
        contentItem?.type ===
          "output_text" &&
        typeof contentItem.text ===
          "string"
      ) {
        textParts.push(
          contentItem.text
        );
      }
    }
  }

  return textParts
    .join("\n")
    .trim();
}

async function callOpenAI(payload) {
  const apiKey =
    process.env.OPENAI_API_KEY;

  if (!apiKey) {
    const error = new Error(
      "Nature ID is not configured on the server yet. OPENAI_API_KEY is missing."
    );

    error.statusCode = 503;
    throw error;
  }

  const response =
    await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${apiKey}`,

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify(payload),
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    const errorMessage =
      data?.error?.message ||
      "OpenAI could not identify this observation.";

    const error =
      new Error(errorMessage);

    error.statusCode =
      response.status >= 400 &&
      response.status < 500
        ? 502
        : 503;

    throw error;
  }

  return data;
}

const natureIdSchema = {
  type: "object",
  additionalProperties: false,

  properties: {
    category: {
      type: "string",
      enum: [
        "mushroom",
        "plant",
        "insect",
        "unknown",
      ],
    },

    commonName: {
      type: [
        "string",
        "null",
      ],
    },

    scientificName: {
      type: [
        "string",
        "null",
      ],
    },

    confidence: {
      type: [
        "number",
        "null",
      ],
      minimum: 0,
      maximum: 1,
    },

    summary: {
      type: "string",
    },

    keyTraits: {
      type: "array",
      items: {
        type: "string",
      },
    },

    lookalikes: {
      type: "array",
      items: {
        type: "string",
      },
    },

    safetyNote: {
      type: "string",
    },
  },

  required: [
    "category",
    "commonName",
    "scientificName",
    "confidence",
    "summary",
    "keyTraits",
    "lookalikes",
    "safetyNote",
  ],
};

router.post(
  "/identify",
  requireAuth,
  identifyUpload.single("photo"),
  async (request, response) => {
    try {
      if (!request.file) {
        return response
          .status(400)
          .json({
            message:
              "A photo is required for identification.",
          });
      }

      const mode =
        normalizeMode(
          request.body?.mode
        );

      const notes =
        optionalText(
          request.body?.notes
        );

      const latitude =
        optionalNumber(
          request.body?.latitude
        );

      const longitude =
        optionalNumber(
          request.body?.longitude
        );

      const elevation =
        optionalNumber(
          request.body?.elevation
        );

      const elevationSource =
        optionalText(
          request.body?.elevationSource
        ) || "unknown";

      const locationContext = [
        latitude !== null
          ? `Latitude: ${latitude}`
          : null,

        longitude !== null
          ? `Longitude: ${longitude}`
          : null,

        elevation !== null
          ? `Elevation: ${elevation} ft`
          : null,

        `Elevation source: ${elevationSource}`,
      ]
        .filter(Boolean)
        .join("\n");

      const modeInstruction =
        mode === "mushroom"
          ? "The user says this is a mushroom or other fungus."
          : mode === "plant"
            ? "The user says this is a plant."
            : mode === "insect"
              ? "The user says this is an insect or other terrestrial arthropod. Identify it as narrowly as the image supports, including order/family/genus/species when reasonably supported."
              : "Determine whether the observation is most likely a mushroom/fungus, plant, insect/arthropod, or unknown.";

      const userText = [
        "Identify the wild nature observation in the attached image as carefully as possible.",
        modeInstruction,
        "",
        "Field context:",
        locationContext ||
          "No location context provided.",
        "",
        `Field notes: ${notes || "None provided."}`,
        "",
        "Return a conservative identification. If the image is insufficient, ambiguous, damaged, blurry, or missing critical diagnostic features, lower confidence and say so.",
        "Do not invent diagnostic features that are not visible.",
        "Give a likely common name and scientific name only when supported by the image and context.",
        "List the most relevant visible traits.",
        "List plausible lookalikes when useful.",
        "For mushrooms and potentially toxic plants, never say the specimen is safe or edible. Never recommend eating, tasting, touching, or using a wild specimen based on this image.",
        "For insects and other arthropods, do not claim an animal is harmless unless supported. Mention bite, sting, venom, allergen, or handling concerns when relevant and advise avoiding bare-hand handling when uncertain.",
        "The safety note must make clear that image-based identification is not sufficient to determine edibility or toxicity.",
      ].join("\n");

      const model =
        process.env.OPENAI_NATURE_ID_MODEL ||
        "gpt-5";

      const openAIResponse =
        await callOpenAI({
          model,

          input: [
            {
              role: "user",

              content: [
                {
                  type: "input_text",
                  text: userText,
                },

                {
                  type: "input_image",

                  image_url:
                    imageDataUrl(
                      request.file
                    ),

                  detail: "high",
                },
              ],
            },
          ],

          text: {
            format: {
              type: "json_schema",

              name:
                "nature_identification",

              description:
                "A conservative field identification for a photographed plant, mushroom, fungus, insect/arthropod, or unknown natural observation.",

              strict: true,

              schema:
                natureIdSchema,
            },
          },
        });

      const outputText =
        extractResponseText(
          openAIResponse
        );

      if (!outputText) {
        console.error(
          "Nature ID response contained no text output:",
          openAIResponse
        );

        return response
          .status(502)
          .json({
            message:
              "The identification service returned an empty result. Please try another photo.",
          });
      }

      let result;

      try {
        result =
          JSON.parse(outputText);
      } catch (error) {
        console.error(
          "Could not parse Nature ID structured result:",
          outputText
        );

        return response
          .status(502)
          .json({
            message:
              "The identification service returned an unreadable result. Please try again.",
          });
      }

      response
        .status(200)
        .json({
          result,
        });
    } catch (error) {
      console.error(
        "Nature ID error:",
        error
      );

      const statusCode =
        Number.isInteger(
          error.statusCode
        )
          ? error.statusCode
          : 500;

      response
        .status(statusCode)
        .json({
          message:
            error.message ||
            "Something went wrong while identifying the observation.",
        });
    }
  }
);

router.post(
  "/save",
  requireAuth,
  saveUpload.single("photo"),
  async (
    request,
    response
  ) => {
    let photoUrl = null;

    try {
      if (!request.file) {
        return response
          .status(400)
          .json({
            message:
              "A photo is required to save the observation.",
          });
      }

      const category =
        String(
          request.body?.category ||
            "unknown"
        )
          .trim()
          .toLowerCase();

      if (
        ![
          "mushroom",
          "plant",
          "insect",
          "unknown",
        ].includes(
          category
        )
      ) {
        return response
          .status(400)
          .json({
            message:
              "Nature observation category is invalid.",
          });
      }

      const confidence =
        optionalNumber(
          request.body?.confidence
        );

      let keyTraits = [];
      let lookalikes = [];

      try {
        const parsed =
          JSON.parse(
            request.body?.keyTraits ||
              "[]"
          );

        if (
          Array.isArray(
            parsed
          )
        ) {
          keyTraits =
            parsed
              .map(
                (item) =>
                  String(
                    item
                  ).trim()
              )
              .filter(Boolean);
        }
      } catch {
        keyTraits = [];
      }

      try {
        const parsed =
          JSON.parse(
            request.body?.lookalikes ||
              "[]"
          );

        if (
          Array.isArray(
            parsed
          )
        ) {
          lookalikes =
            parsed
              .map(
                (item) =>
                  String(
                    item
                  ).trim()
              )
              .filter(Boolean);
        }
      } catch {
        lookalikes = [];
      }

      photoUrl =
        await uploadPhotoToCloudinary(
          request.file
        );

      const entry =
        await NatureObservation.create({
          userId:
            request.user.userId,

          category,

          commonName:
            optionalText(
              request.body?.commonName
            ),

          scientificName:
            optionalText(
              request.body?.scientificName
            ),

          confidence,

          summary:
            optionalText(
              request.body?.summary
            ),

          keyTraits,
          lookalikes,

          safetyNote:
            optionalText(
              request.body?.safetyNote
            ),

          notes:
            optionalText(
              request.body?.notes
            ),

          latitude:
            optionalNumber(
              request.body?.latitude
            ),

          longitude:
            optionalNumber(
              request.body?.longitude
            ),

          elevation:
            optionalNumber(
              request.body?.elevation
            ),

          elevationSource:
            optionalText(
              request.body?.elevationSource
            ) || "unknown",

          photoUrl,
        });

      response
        .status(201)
        .json({
          message:
            "Nature observation saved to the Field Journal.",
          entry,
        });
    } catch (error) {
      await deletePhotoFile(
        photoUrl
      );

      console.error(
        "Nature observation save error:",
        error
      );

      response
        .status(500)
        .json({
          message:
            "Something went wrong while saving the nature observation.",
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
      const entries =
        await NatureObservation.findAll({
          where: {
            userId:
              request.user.userId,
          },

          order: [
            [
              "createdAt",
              "DESC",
            ],
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
      console.error(
        "Nature observation load error:",
        error
      );

      response
        .status(500)
        .json({
          message:
            "Something went wrong while loading nature observations.",
        });
    }
  }
);

module.exports = router;