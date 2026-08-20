require("dotenv").config();

const express = require("express");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const trailPhotoAiRoutes = require("./routes/trailPhotoAiRoutes");

const sequelize = require("./config/database");

require("./models/User");
require("./models/Trip");
require("./models/CatholeEntry");
require("./models/WaterSourceEntry");
require("./models/BeerSpotEntry");
require("./models/FinishedHike");
require("./models/PublicTrack");

const authRoutes = require("./routes/authRoutes");
const catholeRoutes = require("./routes/catholeRoutes");
const waterSourceRoutes = require("./routes/waterSourceRoutes");
const beerSpotRoutes = require("./routes/beerSpotRoutes");
const natureIdRoutes = require("./routes/natureIdRoutes");
const birdIdRoutes = require("./routes/birdIdRoutes");
const statsRoutes = require("./routes/statsRoutes");
const tripRoutes = require("./routes/tripRoutes");
const hikingRouteRoutes = require("./routes/hikingRouteRoutes");
const trailheadRoutes = require("./routes/trailheadRoutes");
const publicFeedRoutes = require("./routes/publicFeedRoutes");
const finishedHikeRoutes = require("./routes/finishedHikeRoutes");

const app = express();

const PORT = process.env.PORT || 3000;

const allowedOrigins = [
  "https://altipoop.com",
  "https://www.altipoop.com",
  "http://localhost:3000",
  "http://localhost:8081",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:8081",
];

function isAllowedOrigin(origin) {
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  try {
    const url = new URL(origin);

    if (
      url.protocol === "https:" &&
      (
        url.hostname.endsWith(".framer.website") ||
        url.hostname.endsWith(".framer.app")
      )
    ) {
      return true;
    }
  } catch (error) {
    return false;
  }

  return false;
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }

      console.error(
        `CORS rejected origin: ${origin}`
      );

      return callback(
        new Error("Origin not allowed by CORS.")
      );
    },
  })
);

app.use(
  "/api/ai",
  trailPhotoAiRoutes
);

app.use(
  express.json({
    limit: "5mb",
  })
);

const uploadsDirectory = path.join(
  __dirname,
  "..",
  "uploads"
);

app.use(
  "/uploads",
  express.static(uploadsDirectory)
);

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/catholes",
  catholeRoutes
);

app.use(
  "/api/water-sources",
  waterSourceRoutes
);

app.use(
  "/api/beer-spots",
  beerSpotRoutes
);

app.use(
  "/api/nature-id",
  natureIdRoutes
);

app.use(
  "/api/bird-id",
  birdIdRoutes
);

app.use(
  "/api/stats",
  statsRoutes
);

app.use(
  "/api/trips",
  tripRoutes
);

app.use(
  "/api/finished-hikes",
  finishedHikeRoutes
);

app.use(
  "/api/routes",
  hikingRouteRoutes
);

app.use(
  "/api/trailheads",
  trailheadRoutes
);

app.use(
  "/api/public",
  publicFeedRoutes
);

app.get(
  "/",
  (request, response) => {
    response.status(200).json({
      message: "Altipoop API Running!",
    });
  }
);

app.get(
  "/api/health",
  async (request, response) => {
    try {
      await sequelize.authenticate();

      response.status(200).json({
        status: "healthy",
        server: "running",
        database: "connected",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(error);

      response.status(503).json({
        status: "unhealthy",
        server: "running",
        database: "disconnected",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

app.use(
  (request, response) => {
    response.status(404).json({
      message: "Route not found.",
    });
  }
);

app.use(
  (
    error,
    request,
    response,
    next
  ) => {
    console.error(error);

    if (
      error instanceof
      multer.MulterError
    ) {
      if (
        error.code ===
        "LIMIT_FILE_SIZE"
      ) {
        return response
          .status(413)
          .json({
            message:
              "The photo must be smaller than 5 MB.",
          });
      }

      return response
        .status(400)
        .json({
          message:
            error.message ||
            "Photo upload failed.",
        });
    }

    if (error.statusCode) {
      return response
        .status(error.statusCode)
        .json({
          message: error.message,
        });
    }

    if (
      error instanceof SyntaxError &&
      error.status === 400 &&
      "body" in error
    ) {
      return response
        .status(400)
        .json({
          message:
            "Request body contains invalid JSON.",
        });
    }

    if (
      error.type ===
      "entity.too.large"
    ) {
      return response
        .status(413)
        .json({
          message:
            "Request body is too large.",
        });
    }

    response.status(500).json({
      message:
        "An unexpected server error occurred.",
    });
  }
);

async function startServer() {
  try {
    await sequelize.authenticate();

    console.log(
      "Connected to PostgreSQL!"
    );

    await sequelize.sync();

    console.log(
      "Database tables synchronized!"
    );

    await sequelize.query(`
      ALTER TABLE finished_hikes
      ADD COLUMN IF NOT EXISTS
      "photos" JSONB NOT NULL DEFAULT '[]'::jsonb;
    `);

    await sequelize.query(`
      ALTER TABLE water_source_entries
      ADD COLUMN IF NOT EXISTS
      "photoUrl" VARCHAR(255);
    `);

    await sequelize.query(`
      ALTER TABLE cathole_entries
      ADD COLUMN IF NOT EXISTS
      "photoUrl" VARCHAR(255);
    `);

    await sequelize.query(`
      ALTER TABLE water_source_entries
      ADD COLUMN IF NOT EXISTS
      "tripId" INTEGER;
    `);

    await sequelize.query(`
      ALTER TABLE cathole_entries
      ADD COLUMN IF NOT EXISTS
      "tripId" INTEGER;
    `);

    await sequelize.query(`
      ALTER TABLE water_source_entries
      ADD COLUMN IF NOT EXISTS
      "isPublic" BOOLEAN NOT NULL DEFAULT FALSE;
    `);

    app.listen(
      PORT,
      () => {
        console.log(
          `Server running on port ${PORT}`
        );
      }
    );
  } catch (error) {
    console.error(
      "Could not connect to PostgreSQL:"
    );

    console.error(
      error.message
    );
  }
}

if (
  require.main === module
) {
  startServer();
}

module.exports = app;
