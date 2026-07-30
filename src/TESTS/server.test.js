const request = require("supertest");
const app = require("../server");
const sequelize = require("../config/database");
const User = require("../models/User");
const CatholeEntry = require("../models/CatholeEntry");

describe("Altipoop API", () => {
  let authToken;
  let testUserEmail;
  let testUserId;
  let catholeEntryId;

  beforeAll(async () => {
    testUserEmail = `test-${Date.now()}@example.com`;

    await request(app)
      .post("/api/auth/register")
      .send({
        displayName: "Automated Test User",
        email: testUserEmail,
        password: "TestPassword123!",
        homeRegion: "Colorado",
      });

    const loginResponse = await request(app)
      .post("/api/auth/login")
      .send({
        email: testUserEmail,
        password: "TestPassword123!",
      });

    authToken = loginResponse.body.token;
    testUserId = loginResponse.body.user.id;
  });

  afterAll(async () => {
    await CatholeEntry.destroy({
      where: {
        userId: testUserId,
      },
    });

    await User.destroy({
      where: {
        email: testUserEmail,
      },
    });

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

  test("Cathole route rejects a bad entry ID after authentication", async () => {
    const response = await request(app)
      .get("/api/catholes/YOUR_ID")
      .set("Authorization", `Bearer ${authToken}`);

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message: "Entry ID must be a positive whole number.",
    });
  });

  test("Water source route rejects a bad entry ID after authentication", async () => {
    const response = await request(app)
      .get("/api/water-sources/YOUR_ID")
      .set("Authorization", `Bearer ${authToken}`);

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message: "Entry ID must be a positive whole number.",
    });
  });

  test("POST /api/catholes creates a cathole entry", async () => {
    const response = await request(app)
      .post("/api/catholes")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        latitude: 39.5501,
        longitude: -105.7821,
        elevation: 10500,
        terrainType: "alpine",
        method: "cathole",
        distanceFromWater: 250,
        distanceFromTrail: 100,
        distanceFromCamp: 300,
        depthConfirmed: true,
        tpPackedOut: true,
        notes: "Automated cathole test entry.",
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.message).toBe(
      "Cathole entry created successfully!"
    );
    expect(response.body.entry).toBeDefined();
    expect(response.body.entry.terrainType).toBe("alpine");
    expect(response.body.entry.method).toBe("cathole");

    catholeEntryId = response.body.entry.id;
  });

  test("GET /api/catholes returns the created cathole entry", async () => {
    const response = await request(app)
      .get("/api/catholes")
      .set("Authorization", `Bearer ${authToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.count).toBeGreaterThanOrEqual(1);
    expect(response.body.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: catholeEntryId,
          terrainType: "alpine",
          method: "cathole",
          notes: "Automated cathole test entry.",
        }),
      ])
    );
  });

  test("GET /api/catholes/:id returns one cathole entry", async () => {
    const response = await request(app)
      .get(`/api/catholes/${catholeEntryId}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.entry.id).toBe(catholeEntryId);
    expect(response.body.entry.terrainType).toBe("alpine");
    expect(response.body.entry.method).toBe("cathole");
  });
});