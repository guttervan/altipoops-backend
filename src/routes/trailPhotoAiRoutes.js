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

    if (!allowedMimeTypes.includes(file.mimetype)) {
      const error = new Error(
        "Only JPEG, PNG, and WebP photos are supported."
      );

      error.statusCode = 400;

      return callback(error);
    }

    callback(null, true);
  },
});

function extractJson(text) {
  if (!text) {
    return null;
  }

  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    // Continue below.
  }

  const fencedMatch = trimmed.match(
    /```(?:json)?\s*([\s\S]*?)```/i
  );

  if (fencedMatch) {
    try {
      return JSON.parse(
        fencedMatch[1].trim()
      );
    } catch (error) {
      // Continue below.
    }
  }

  const firstBrace =
    trimmed.indexOf("{");

  const lastBrace =
    trimmed.lastIndexOf("}");

  if (
    firstBrace !== -1 &&
    lastBrace !== -1 &&
    lastBrace > firstBrace
  ) {
    try {
      return JSON.parse(
        trimmed.slice(
          firstBrace,
          lastBrace + 1
        )
      );
    } catch (error) {
      return null;
    }
  }

  return null;
}

router.post(
  "/trail-photo",
  upload.single("photo"),
  async (request, response, next) => {
    try {
      if (!process.env.HF_TOKEN) {
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

Analyze only what is visibly supported by this backcountry photo.

Return ONLY valid JSON using this exact structure:

{
  "summary": "1-2 sentence visible summary",
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

Rules:

- Terrain: visible terrain or landform observations only.
- Vegetation: visible vegetation observations only.
- Weather: visible sky, cloud, precipitation, or lighting observations only.
- Trail: visible trail, path, surface, obstacle, or route-feature observations only.
- Water: visible water observations only.
- Snow: visible snow or ice observations only.
- Wildlife: visible animals or clear animal evidence only.
- Other: other useful visible observations.
- Uncertainties: anything that cannot be confidently determined from the image.

Important:

- Do not declare anything safe or unsafe.
- Do not provide medical, rescue, avalanche, climbing, wildlife, water-purification, or route-safety advice.
- Do not identify an exact location from scenery.
- Do not invent elevations, distances, temperatures, weather forecasts, route names, or coordinates.
- Do not guess a species unless visually distinctive enough to support it.
- If uncertain, describe the uncertainty.
- Use empty arrays when there is nothing useful for a category.
- Keep observations concise.
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
                  type: "image_url",
                  image_url: {
                    url: dataUrl,
                  },
                },
              ],
            },
          ],

          temperature: 0.2,
          max_tokens: 900,
        });

      const rawText =
        completion?.choices?.[0]
          ?.message?.content;

      if (!rawText) {
        return response
          .status(502)
          .json({
            message:
              "Hugging Face returned an empty response.",
          });
      }

      const analysis =
        extractJson(rawText);

      if (!analysis) {
        return response
          .status(502)
          .json({
            message:
              "Hugging Face returned a response that could not be parsed.",
            raw:
              process.env.NODE_ENV ===
              "development"
                ? rawText
                : undefined,
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