const crypto = require("crypto");
const express = require("express");
const fs = require("fs");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const BirdObservation = require("../models/BirdObservation");
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

fs.mkdirSync(
  uploadsDirectory,
  {
    recursive: true,
  }
);

const allowedMimeTypes = new Set([
  "audio/m4a",
  "audio/mp4",
  "audio/aac",
  "audio/x-m4a",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/flac",
  "audio/x-flac",
  "audio/ogg",
]);

const audioUpload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 25 * 1024 * 1024,
  },

  fileFilter(request, file, callback) {
    if (!allowedMimeTypes.has(file.mimetype)) {
      const error = new Error(
        "Bird Call ID supports M4A/MP4, AAC, MP3, WAV, FLAC, and OGG audio."
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
    fileSize: 25 * 1024 * 1024,
  },

  fileFilter(request, file, callback) {
    if (!allowedMimeTypes.has(file.mimetype)) {
      const error = new Error(
        "Bird Call ID supports M4A/MP4, AAC, MP3, WAV, FLAC, and OGG audio."
      );

      error.statusCode = 400;
      callback(error);
      return;
    }

    callback(null, true);
  },
});

function optionalNumber(value) {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue)
    ? numberValue
    : null;
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

function uploadAudioToCloudinary(file) {
  if (!file) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const stream =
      cloudinary.uploader.upload_stream(
        {
          folder: "altipoop/birds",
          resource_type: "video",
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
  audioUrl
) {
  try {
    const parsedUrl =
      new URL(audioUrl);

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

async function deleteAudioFile(
  audioUrl
) {
  if (!audioUrl) {
    return;
  }

  const publicId =
    cloudinaryPublicIdFromUrl(
      audioUrl
    );

  if (publicId) {
    try {
      await cloudinary.uploader.destroy(
        publicId,
        {
          resource_type: "video",
          invalidate: true,
        }
      );
    } catch (error) {
      console.error(
        "Could not delete Cloudinary Bird ID audio:",
        error
      );
    }

    return;
  }

  if (
    !String(audioUrl).startsWith(
      "/uploads/"
    )
  ) {
    return;
  }

  const filename =
    path.basename(audioUrl);

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
        "Could not delete legacy Bird ID audio:",
        error
      );
    }
  }
}

function extensionForAudio(file) {
  const extensionByMimeType = {
    "audio/m4a": ".m4a",
    "audio/mp4": ".m4a",
    "audio/aac": ".aac",
    "audio/x-m4a": ".m4a",
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/flac": ".flac",
    "audio/x-flac": ".flac",
    "audio/ogg": ".ogg",
  };

  return extensionByMimeType[file.mimetype] || ".m4a";
}

function weekOfBirdnetYear(date = new Date()) {
  const startOfYear = new Date(
    date.getFullYear(),
    0,
    1
  );

  const elapsedDays = Math.floor(
    (date - startOfYear) / 86400000
  );

  const monthIndex = Math.min(
    11,
    Math.floor(elapsedDays / 30.5)
  );

  const dayWithinApproxMonth =
    elapsedDays -
    Math.floor(monthIndex * 30.5);

  const weekWithinMonth = Math.min(
    3,
    Math.floor(dayWithinApproxMonth / 7.625)
  );

  return monthIndex * 4 + weekWithinMonth + 1;
}

function runProcess(
  executable,
  args,
  options = {}
) {
  return new Promise(
    (resolve, reject) => {
      const child = spawn(
        executable,
        args,
        {
          windowsHide: true,
          ...options,
        }
      );

      let stdout = "";
      let stderr = "";

      child.stdout?.on(
        "data",
        (chunk) => {
          stdout += chunk.toString();
        }
      );

      child.stderr?.on(
        "data",
        (chunk) => {
          stderr += chunk.toString();
        }
      );

      child.on(
        "error",
        reject
      );

      child.on(
        "close",
        (code) => {
          if (code === 0) {
            resolve({
              stdout,
              stderr,
            });

            return;
          }

          const error = new Error(
            stderr.trim() ||
            stdout.trim() ||
            `Process exited with code ${code}.`
          );

          error.statusCode = 502;
          reject(error);
        }
      );
    }
  );
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let insideQuotes = false;

  for (
    let index = 0;
    index < line.length;
    index += 1
  ) {
    const character = line[index];

    if (character === '"') {
      if (
        insideQuotes &&
        line[index + 1] === '"'
      ) {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }

      continue;
    }

    if (
      character === "," &&
      !insideQuotes
    ) {
      values.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current);

  return values;
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function parseBirdnetCsv(csvText) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(
    lines[0]
  );

  const normalizedHeaders =
    headers.map(
      normalizeHeader
    );

  function indexOfAny(
    candidates
  ) {
    return normalizedHeaders.findIndex(
      (header) =>
        candidates.includes(header)
    );
  }

  const scientificNameIndex =
    indexOfAny([
      "scientificname",
      "scientific",
      "speciescode",
    ]);

  const commonNameIndex =
    indexOfAny([
      "commonname",
      "common",
    ]);

  const confidenceIndex =
    indexOfAny([
      "confidence",
      "score",
    ]);

  const startIndex =
    indexOfAny([
      "starts",
      "start",
      "starttime",
    ]);

  const endIndex =
    indexOfAny([
      "ends",
      "end",
      "endtime",
    ]);

  const detections = [];

  for (
    const line of lines.slice(1)
  ) {
    const values =
      parseCsvLine(line);

    const scientificName =
      scientificNameIndex >= 0
        ? String(
            values[
              scientificNameIndex
            ] || ""
          ).trim()
        : "";

    const commonName =
      commonNameIndex >= 0
        ? String(
            values[
              commonNameIndex
            ] || ""
          ).trim()
        : "";

    const confidence =
      confidenceIndex >= 0
        ? Number(
            values[
              confidenceIndex
            ]
          )
        : NaN;

    const startSeconds =
      startIndex >= 0
        ? Number(
            values[
              startIndex
            ]
          )
        : null;

    const endSeconds =
      endIndex >= 0
        ? Number(
            values[
              endIndex
            ]
          )
        : null;

    if (
      !scientificName &&
      !commonName
    ) {
      continue;
    }

    detections.push({
      scientificName:
        scientificName || null,

      commonName:
        commonName || null,

      confidence:
        Number.isFinite(
          confidence
        )
          ? confidence
          : null,

      startSeconds:
        Number.isFinite(
          startSeconds
        )
          ? startSeconds
          : null,

      endSeconds:
        Number.isFinite(
          endSeconds
        )
          ? endSeconds
          : null,
    });
  }

  return detections;
}

async function findCsvFiles(
  directory
) {
  const entries =
    await fs.promises.readdir(
      directory,
      {
        withFileTypes: true,
      }
    );

  const files = [];

  for (const entry of entries) {
    const fullPath =
      path.join(
        directory,
        entry.name
      );

    if (entry.isDirectory()) {
      files.push(
        ...await findCsvFiles(
          fullPath
        )
      );

      continue;
    }

    if (
      entry.isFile() &&
      entry.name
        .toLowerCase()
        .endsWith(".csv")
    ) {
      files.push(
        fullPath
      );
    }
  }

  return files;
}

function collapseDetections(
  detections
) {
  const bySpecies = new Map();

  for (
    const detection of detections
  ) {
    const key =
      detection.scientificName ||
      detection.commonName;

    const existing =
      bySpecies.get(key);

    if (
      !existing ||
      (
        detection.confidence !== null &&
        (
          existing.confidence === null ||
          detection.confidence >
            existing.confidence
        )
      )
    ) {
      bySpecies.set(
        key,
        detection
      );
    }
  }

  return Array.from(
    bySpecies.values()
  )
    .sort(
      (left, right) =>
        (
          right.confidence ?? -1
        ) -
        (
          left.confidence ?? -1
        )
    )
    .slice(0, 5);
}

router.post(
  "/identify",
  requireAuth,
  audioUpload.single("audio"),
  async (
    request,
    response
  ) => {
    let tempDirectory = null;

    try {
      if (!request.file) {
        return response
          .status(400)
          .json({
            message:
              "A bird-call recording is required for identification.",
          });
      }

      const latitude =
        optionalNumber(
          request.body?.latitude
        );

      const longitude =
        optionalNumber(
          request.body?.longitude
        );

      const projectRoot =
        path.join(
          __dirname,
          "..",
          ".."
        );

      const pythonExecutable =
        path.join(
          projectRoot,
          ".birdnet-venv",
          "Scripts",
          "python.exe"
        );

      if (
        !fs.existsSync(
          pythonExecutable
        )
      ) {
        return response
          .status(503)
          .json({
            message:
              "BirdNET is not configured on the server yet.",
          });
      }

      tempDirectory =
        await fs.promises.mkdtemp(
          path.join(
            os.tmpdir(),
            "altipoop-birdnet-"
          )
        );

      const inputDirectory =
        path.join(
          tempDirectory,
          "input"
        );

      const outputDirectory =
        path.join(
          tempDirectory,
          "output"
        );

      await Promise.all([
        fs.promises.mkdir(
          inputDirectory,
          {
            recursive: true,
          }
        ),

        fs.promises.mkdir(
          outputDirectory,
          {
            recursive: true,
          }
        ),
      ]);

      const originalFilename =
        `${Date.now()}-${crypto.randomUUID()}${extensionForAudio(request.file)}`;

      const originalInputPath =
        path.join(
          inputDirectory,
          originalFilename
        );

      const wavInputPath =
        path.join(
          inputDirectory,
          `${Date.now()}-${crypto.randomUUID()}.wav`
        );

      await fs.promises.writeFile(
        originalInputPath,
        request.file.buffer
      );

      await runProcess(
        "C:\\Users\\ZacharyC\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0-full_build\\bin\\ffmpeg.exe",
        [
          "-y",
          "-i",
          originalInputPath,
          "-vn",
          "-ac",
          "1",
          "-ar",
          "48000",
          "-c:a",
          "pcm_s16le",
          wavInputPath,
        ],
        {
          cwd: projectRoot,
        }
      );

      if (
        !fs.existsSync(
          wavInputPath
        )
      ) {
        throw new Error(
          "FFmpeg did not create the WAV file for BirdNET."
        );
      }

      console.log(
        "Bird Call converted to WAV:",
        wavInputPath
      );

      const args = [
        "-m",
        "birdnet_analyzer.analyze",
        wavInputPath,
        "-o",
        outputDirectory,
        "--rtype",
        "csv",
        "--min_conf",
        "0.15",
        "--top_n",
        "5",
        "--threads",
        "4",
      ];

      if (
        latitude !== null &&
        longitude !== null
      ) {
        args.push(
          "--lat",
          String(latitude),
          "--lon",
          String(longitude),
          "--week",
          String(
            weekOfBirdnetYear()
          )
        );
      }

      const processResult =
        await runProcess(
          pythonExecutable,
          args,
          {
            cwd: projectRoot,
          }
        );

      const csvFiles =
        await findCsvFiles(
          outputDirectory
        );

      if (
        csvFiles.length === 0
      ) {
        console.error(
          "BirdNET produced no CSV result.",
          {
            stdout:
              processResult.stdout,
            stderr:
              processResult.stderr,
          }
        );

        return response
          .status(502)
          .json({
            message:
              "BirdNET did not return an identification result.",
          });
      }

      let resultCsvText = null;
      let resultCsvPath = null;

      for (
        const csvFile of csvFiles
      ) {
        const candidateText =
          await fs.promises.readFile(
            csvFile,
            "utf8"
          );

        const firstLine =
          candidateText
            .split(/\r?\n/, 1)[0] ||
          "";

        const normalizedHeader =
          parseCsvLine(firstLine)
            .map(normalizeHeader);

        const looksLikeResult =
          normalizedHeader.includes(
            "scientificname"
          ) ||
          normalizedHeader.includes(
            "commonname"
          ) ||
          normalizedHeader.includes(
            "confidence"
          );

        if (looksLikeResult) {
          resultCsvText =
            candidateText;

          resultCsvPath =
            csvFile;

          break;
        }
      }

      if (!resultCsvText) {
        console.error(
          "BirdNET CSV files were found, but none looked like a detection result.",
          {
            csvFiles,
            stdout:
              processResult.stdout,
            stderr:
              processResult.stderr,
          }
        );

        return response
          .status(502)
          .json({
            message:
              "BirdNET did not produce a readable species result.",
          });
      }

      console.log(
        "BirdNET result CSV:",
        resultCsvPath
      );

      console.log(
        "BirdNET raw result CSV output:\n" +
          resultCsvText
      );

      const detections =
        collapseDetections(
          parseBirdnetCsv(
            resultCsvText
          )
        );

      response
        .status(200)
        .json({
          result: {
            detections,

            bestMatch:
              detections[0] ||
              null,

            locationFiltered:
              latitude !== null &&
              longitude !== null,
          },
        });
    } catch (error) {
      console.error(
        "Bird Call ID error:",
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
            "Something went wrong while identifying the bird call.",
        });
    } finally {
      if (tempDirectory) {
        await fs.promises.rm(
          tempDirectory,
          {
            recursive: true,
            force: true,
          }
        ).catch(
          (error) => {
            console.error(
              "Could not clean up BirdNET temp files:",
              error
            );
          }
        );
      }
    }
  }
);

router.post(
  "/save",
  requireAuth,
  saveUpload.single("audio"),
  async (
    request,
    response
  ) => {
    let audioUrl = null;

    try {
      if (!request.file) {
        return response
          .status(400)
          .json({
            message:
              "A bird-call recording is required to save the observation.",
          });
      }

      const confidence =
        optionalNumber(
          request.body?.confidence
        );

      const durationMs =
        optionalNumber(
          request.body?.durationMs
        );

      let alternateMatches = [];

      try {
        const parsed =
          JSON.parse(
            request.body?.alternateMatches ||
              "[]"
          );

        if (
          Array.isArray(
            parsed
          )
        ) {
          alternateMatches =
            parsed
              .slice(0, 5)
              .map(
                (item) => ({
                  commonName:
                    optionalText(
                      item?.commonName
                    ),
                  scientificName:
                    optionalText(
                      item?.scientificName
                    ),
                  confidence:
                    optionalNumber(
                      item?.confidence
                    ),
                })
              )
              .filter(
                (item) =>
                  item.commonName ||
                  item.scientificName
              );
        }
      } catch {
        alternateMatches = [];
      }

      audioUrl =
        await uploadAudioToCloudinary(
          request.file
        );

      const entry =
        await BirdObservation.create({
          userId:
            request.user.userId,

          commonName:
            optionalText(
              request.body?.commonName
            ),

          scientificName:
            optionalText(
              request.body?.scientificName
            ),

          confidence,

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

          audioUrl,

          durationMs:
            durationMs !== null
              ? Math.max(
                  0,
                  Math.round(
                    durationMs
                  )
                )
              : null,

          locationFiltered:
            String(
              request.body?.locationFiltered ||
                ""
            )
              .trim()
              .toLowerCase() ===
            "true",

          alternateMatches,
        });

      response
        .status(201)
        .json({
          message:
            "Bird observation saved to the Field Journal.",
          entry,
        });
    } catch (error) {
      await deleteAudioFile(
        audioUrl
      );

      console.error(
        "Could not save bird observation:",
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
            "Something went wrong while saving the bird observation.",
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
        await BirdObservation.findAll({
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
        "Could not load bird observations:",
        error
      );

      response
        .status(500)
        .json({
          message:
            "Something went wrong while loading bird observations.",
        });
    }
  }
);

module.exports = router;