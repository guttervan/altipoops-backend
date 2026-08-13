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

  /*
   * Remove markdown code fences such as:
   *
   * ```json
   * { ... }
   * ```
   */
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

  /*
   * First try the whole response.
   */
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

  /*
   * Make sure the model returned
   * at least some useful content.
   */
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

Analyze ONLY what is visibly supported by this backcountry photo.

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
- Use empty arrays when nothing useful is visible.

CONTENT RULES:

- Terrain: visible terrain or landforms only.
- Vegetation: visible vegetation only.
- Weather: visible sky, clouds, precipitation, lighting, or atmospheric appearance only.
- Trail: visible trail, path, surface, obstacles, or route features only.
- Water: visible water only.
- Snow: visible snow or ice only.
- Wildlife: visible animals or clear animal evidence only.
- Other: other useful visible details.
- Uncertainties: things that cannot be confidently determined from the photo.

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

          temperature: 0.1,

          max_tokens: 1400,
        });

      const rawText =
        completion
          ?.choices?.[0]
          ?.message?.content;

      if (!rawText) {
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