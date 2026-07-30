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

  test("GET /api/health reports a healthy server and database", async () => {
    const response = await request(app).get("/api/health");

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("healthy");
    expect(response.body.server).toBe("running");
    expect(response.body.database).toBe("connected");
    expect(response.body.timestamp).toBeDefined();
  });

  test("Malformed JSON returns a 400 response", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email":"test@example.com","password":"secret123"');

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message: "Request body contains invalid JSON.",
    });
  });

test("GET /api/catholes without a token returns 401", async () => {
  const response = await request(app).get("/api/catholes");

  expect(response.statusCode).toBe(401);
  expect(response.body.message).toBeDefined();
});

  test("GET /api/water-sources without a token returns 401", async () => {
    const response = await request(app).get("/api/water-sources");

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBeDefined();
  });

  test("GET /api/stats/me without a token returns 401", async () => {
    const response = await request(app).get("/api/stats/me");

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBeDefined();
  });
});