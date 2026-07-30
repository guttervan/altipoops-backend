require("dotenv").config();

const express = require("express");
const sequelize = require("./config/database");
const User = require("./models/User");
const authRoutes = require("./routes/authRoutes");
const CatholeEntry = require("./models/CatholeEntry");
const app = express();
const PORT = process.env.PORT || 3000;
const catholeRoutes = require("./routes/catholeRoutes");
const WaterSourceEntry = require("./models/WaterSourceEntry");
const waterSourceRoutes = require("./routes/waterSourceRoutes");
const statsRoutes = require("./routes/statsRoutes");

app.use(express.json());


app.use("/api/catholes", catholeRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/water-sources", waterSourceRoutes);
app.use("/api/stats", statsRoutes); 

app.get("/", (request, response) => {
  response.send("Altipoop API Running!");
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