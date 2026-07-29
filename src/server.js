const express = require("express");

const app = express();
const PORT = 3000;

app.use(express.json());

app.get("/", (request, response) => {
  response.send("Altipoop API Running!");
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});