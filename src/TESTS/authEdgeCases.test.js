const request = require("supertest");
const app = require("../server");
const sequelize = require("../config/database");

describe("Authentication edge cases", () => {
  afterAll(async () => {
    await sequelize.close();
  });

  test("POST /api/auth/login rejects missing fields", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: "missing-password@example.com",
      });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message: "Email and password are required.",
    });
  });

  test("POST /api/auth/login rejects an unknown email", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: `unknown-${Date.now()}@example.com`,
        password: "TestPassword123!",
      });

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({
      message: "Invalid email or password.",
    });
  });

  test("GET /api/auth/me without a token returns 401", async () => {
    const response = await request(app).get("/api/auth/me");

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({
      message: "Login token required.",
    });
  });

  test("PUT /api/auth/me without a token returns 401", async () => {
    const response = await request(app)
      .put("/api/auth/me")
      .send({
        displayName: "Should Not Update",
      });

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({
      message: "Login token required.",
    });
  });

  test("GET /api/auth/me rejects an invalid token", async () => {
    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer invalid-token");

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({
      message: "Invalid or expired login token.",
    });
  });

  test("PUT /api/auth/me rejects an invalid token", async () => {
    const response = await request(app)
      .put("/api/auth/me")
      .set("Authorization", "Bearer invalid-token")
      .send({
        privacySetting: "private",
      });

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({
      message: "Invalid or expired login token.",
    });
  });
});