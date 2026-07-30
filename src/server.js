require("dotenv").config();

const express = require("express");
const sequelize = require("./config/database");

require("./models/User");
require("./models/CatholeEntry");
require("./models/WaterSourceEntry");

const authRoutes = require("./routes/authRoutes");
const catholeRoutes = require("./routes/catholeRoutes");
const waterSourceRoutes = require("./routes/waterSourceRoutes");
const statsRoutes = require("./routes/statsRoutes");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  express.json({
    limit: "100kb",
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/catholes", catholeRoutes);
app.use("/api/water-sources", waterSourceRoutes);
app.use("/api/stats", statsRoutes);

app.get("/", (request, response) => {
  response.status(200).json({
    message: "Altipoop API Running!",
  });
});

app.use((request, response) => {
  response.status(404).json({
    message: "Route not found.",
  });
});

app.use((error, request, response, next) => {
  console.error(error);

  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return response.status(400).json({
      message: "Request body contains invalid JSON.",
    });
  }

  if (error.type === "entity.too.large") {
    return response.status(413).json({
      message: "Request body is too large.",
    });
  }

  response.status(500).json({
    message: "An unexpected server error occurred.",
  });
});
async function startServer() {
  try {
    await sequelize.authenticate();
    console.log("Connected to PostgreSQL!");

    await sequelize.sync();
    console.log("Database tables synchronized!");

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Could not connect to PostgreSQL:");
    console.error(error.message);
  }
}

startServer();