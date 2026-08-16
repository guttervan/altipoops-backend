const express = require("express");
const multer = require("multer");
const {
  InferenceClient,
} = require("@huggingface/inference");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024,
  },

  fileFilter(request, file, callback) {
    const allowedMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (
      !allowedMimeTypes.includes(
        file.mimetype
      )
    ) {
      const error = new Error(
        "Only JPEG, PNG, and WebP photos are supported."
      );

      error.statusCode = 400;

      return callback(error);
    }

    callback(null, true);
  },
});

const expectedKeys = [
  "summary",
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

function extractJson(rawText) {
  if (
    typeof rawText !== "string" ||
    !rawText.trim()
  ) {
    return null;
  }

  let text = rawText.trim();

  text = text
    .replace(
      /^```(?:json)?\s*/i,
      ""
    )
    .replace(
      /\s*```$/,
      ""
    )
    .trim();

  try {
    return JSON.parse(text);
  } catch (error) {
    // Try extracting only the JSON object.
  }

  const firstBrace =
    text.indexOf("{");

  const lastBrace =
    text.lastIndexOf("}");

  if (
    firstBrace === -1 ||
    lastBrace === -1 ||
    lastBrace <= firstBrace
  ) {
    return null;
  }

  const candidate =
    text.slice(
      firstBrace,
      lastBrace + 1
    );

  try {
    return JSON.parse(candidate);
  } catch (error) {
    return null;
  }
}

function findValueCaseInsensitive(
  object,
  expectedKey
) {
  if (
    !object ||
    typeof object !== "object"
  ) {
    return undefined;
  }

  const matchingKey =
    Object.keys(object).find(
      (key) =>
        key
          .trim()
          .toLowerCase() ===
        expectedKey.toLowerCase()
    );

  if (!matchingKey) {
    return undefined;
  }

  return object[matchingKey];
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item) =>
        typeof item === "string"
    )
    .map(
      (item) =>
        item.trim()
    )
    .filter(Boolean)
    .slice(0, 4);
}

function normalizeAnalysis(parsed) {
  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed)
  ) {
    return null;
  }

  const normalized = {};

  expectedKeys.forEach(
    (key) => {
      const value =
        findValueCaseInsensitive(
          parsed,
          key
        );

      if (key === "summary") {
        normalized.summary =
          typeof value === "string"
            ? value.trim()
            : "";

        return;
      }

      normalized[key] =
        normalizeStringArray(
          value
        );
    }
  );

  const hasObservations =
    expectedKeys
      .filter(
        (key) =>
          key !== "summary"
      )
      .some(
        (key) =>
          normalized[key].length > 0
      );

  if (
    !normalized.summary &&
    !hasObservations
  ) {
    return null;
  }

  return normalized;
}

router.post(
  "/trail-photo",
  upload.single("photo"),
  async (
    request,
    response,
    next
  ) => {
    try {
      if (
        !process.env.HF_TOKEN
      ) {
        return response
          .status(503)
          .json({
            message:
              "Trail photo analysis is not configured yet.",
          });
      }

      if (!request.file) {
        return response
          .status(400)
          .json({
            message:
              "A trail photo is required.",
          });
      }

      const client =
        new InferenceClient(
          process.env.HF_TOKEN
        );

      const base64Photo =
        request.file.buffer.toString(
          "base64"
        );

      const dataUrl =
        `data:${request.file.mimetype};base64,${base64Photo}`;

      const prompt = `
You are Altipoop Trail Photo Analysis.

Your job is to report DIRECTLY VISIBLE FACTS from a backcountry photo.

Do not infer a story, cause, purpose, route status, history, location, season, time of day, or safety condition from visual clues.

Return ONLY one JSON object.

Use EXACTLY these lowercase keys:

{
  "summary": "short visible summary",
  "terrain": [],
  "vegetation": [],
  "weather": [],
  "trail": [],
  "water": [],
  "snow": [],
  "wildlife": [],
  "other": [],
  "uncertainties": []
}

STRICT OUTPUT RULES:

- Do not use markdown.
- Do not use code fences.
- Do not add text before or after the JSON.
- Use all 10 keys.
- Keep the summary to no more than 2 short sentences.
- Maximum 3 observations per category.
- Maximum 15 words per observation.
- Use empty arrays when nothing useful is directly visible.

DIRECT-VISIBILITY RULE:

Every observation must describe something that can be pointed to in the pixels of the photo.

Good:
- "No distinct trail tread is visible."
- "Several cut tree stumps are visible."
- "Bright sunlight creates lens flare."
- "Distant mountain ridges are partly obscured by haze."
- "A dark-colored dog stands beside the hiker."

Do NOT write:
- "The hiker is off trail."
- "This appears to be a meadow."
- "The trees were cut by logging."
- "The area is recovering from wildfire."
- "Warm light suggests morning or evening."
- "The haze is caused by smoke."
- "The route looks difficult."
- "The trail is poorly maintained."
- "The water looks drinkable."
- "The slope looks safe."

Do not use visual evidence to infer an unseen cause.

For example:
- A cut stump may be described as a cut stump.
- Do not conclude why it was cut.
- A dead tree may be described as a dead standing tree.
- Do not conclude what killed it.
- Haze may be described as haze.
- Do not conclude whether it is smoke, fog, dust, or pollution.
- Low-angle light may be described as low-angle light.
- Do not infer morning, evening, sunrise, or sunset.

CONTENT RULES:

- Terrain: directly visible terrain, slope, rock, ridges, ground, or landforms.
- Vegetation: directly visible plants, trees, grasses, shrubs, or dead vegetation.
- Weather: directly visible clouds, precipitation, sky appearance, haze, lighting, or visibility.
- Trail: directly visible trail tread, path surface, obstacles, footprints, structures, or lack of visible tread.
- Water: directly visible water only.
- Snow: directly visible snow or ice only.
- Wildlife: directly visible animals or clearly visible animal evidence only.
- Other: directly visible objects or useful image details that do not fit another category.
- Uncertainties: facts people may want to know but the image alone cannot establish.

UNCERTAINTY RULES:

Put interpretation questions in "uncertainties" instead of guessing.

Examples:
- exact geographic location
- elevation
- distance to a mountain
- cause of tree death
- cause of haze
- cause of vegetation loss
- trail or route name
- whether the person is on or off an established route
- exact time of day
- exact season
- temperature
- weather beyond what is visible
- species when identification is uncertain

SAFETY RULES:

- Never declare anything safe or unsafe.
- Do not give rescue advice.
- Do not give avalanche advice.
- Do not give climbing advice.
- Do not give wildlife safety advice.
- Do not give water purification advice.
- Do not give medical advice.
- Do not identify the exact location from scenery.
- Do not invent elevation.
- Do not invent distance.
- Do not invent temperature.
- Do not invent coordinates.
- Do not invent a trail or route name.
- Do not guess species unless visually distinctive enough to support it.
      `.trim();

      const completion =
        await client.chatCompletion({
          model:
            "zai-org/GLM-4.5V",

          messages: [
            {
              role: "user",

              content: [
                {
                  type: "text",
                  text: prompt,
                },

                {
                  type:
                    "image_url",

                  image_url: {
                    url: dataUrl,
                  },
                },
              ],
            },
          ],

          extra_body: {
            chat_template_kwargs: {
              enable_thinking: false,
            },
          },

          response_format: {
            type: "json_schema",
            json_schema: {
              name: "trail_photo_analysis",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                required: [
                  "summary",
                  "terrain",
                  "vegetation",
                  "weather",
                  "trail",
                  "water",
                  "snow",
                  "wildlife",
                  "other",
                  "uncertainties",
                ],
                properties: {
                  summary: {
                    type: "string",
                  },
                  terrain: {
                    type: "array",
                    items: {
                      type: "string",
                    },
                  },
                  vegetation: {
                    type: "array",
                    items: {
                      type: "string",
                    },
                  },
                  weather: {
                    type: "array",
                    items: {
                      type: "string",
                    },
                  },
                  trail: {
                    type: "array",
                    items: {
                      type: "string",
                    },
                  },
                  water: {
                    type: "array",
                    items: {
                      type: "string",
                    },
                  },
                  snow: {
                    type: "array",
                    items: {
                      type: "string",
                    },
                  },
                  wildlife: {
                    type: "array",
                    items: {
                      type: "string",
                    },
                  },
                  other: {
                    type: "array",
                    items: {
                      type: "string",
                    },
                  },
                  uncertainties: {
                    type: "array",
                    items: {
                      type: "string",
                    },
                  },
                },
              },
            },
          },

          temperature: 0.1,

          max_tokens: 2200,
        });

      const rawText =
        completion
          ?.choices?.[0]
          ?.message?.content;

      if (!rawText) {
        console.error(
          "Hugging Face returned no visible content:",
          JSON.stringify(
            {
              finishReason:
                completion?.choices?.[0]?.finish_reason || null,
              reasoningContent:
                completion?.choices?.[0]?.message?.reasoning_content || null,
              message:
                completion?.choices?.[0]?.message || null,
            },
            null,
            2
          )
        );

        return response
          .status(502)
          .json({
            message:
              "Hugging Face returned an empty response.",
          });
      }

      const parsed =
        extractJson(rawText);

      if (!parsed) {
        console.error(
          "Hugging Face JSON could not be parsed:",
          rawText
        );

        return response
          .status(502)
          .json({
            message:
              "Hugging Face returned an incomplete or invalid response.",
          });
      }

      const analysis =
        normalizeAnalysis(parsed);

      if (!analysis) {
        console.error(
          "Hugging Face response could not be normalized:",
          parsed
        );

        return response
          .status(502)
          .json({
            message:
              "Hugging Face returned an unusable analysis.",
          });
      }

      return response
        .status(200)
        .json({
          provider:
            "huggingface",

          analysis,
        });
    } catch (error) {
      console.error(
        "Trail photo analysis failed:",
        error
      );

      next(error);
    }
  }
);

module.exports = router;