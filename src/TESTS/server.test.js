const request = require("supertest");
const app = require("../server");
const sequelize = require("../config/database");

describe("Altipoop API", () => {
  afterAll(async () => {
    await sequelize.close();
  });

  test("GET / returns the API running message", async () => {
    const response = await request(app).get("/");

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      message: "Altipoop API Running!",
    });
  });

  test("GET /api/banana returns a JSON 404 response", async () => {
    const response = await request(app).get("/api/banana");

    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({
      message: "Route not found.",
    });
  });
});