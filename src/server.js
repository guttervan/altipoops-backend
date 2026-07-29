require("dotenv").config();

const express = require("express");
const sequelize = require("./config/database");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (request, response) => {
  response.send("Altipoop API Running!");
});

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log("Connected to PostgreSQL!");

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Could not connect to PostgreSQL:");
    console.error(error.message);
  }
}

startServer();