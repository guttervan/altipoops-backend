const request = require("supertest");
const app = require("../server");
const sequelize = require("../config/database");
const User = require("../models/User");
const CatholeEntry = require("../models/CatholeEntry");
const WaterSourceEntry = require("../models/WaterSourceEntry");

describe("Altipoop statistics", () => {
  let authToken;
  let testUserEmail;
  let testUserId;

  beforeAll(async () => {
    testUserEmail = `stats-test-${Date.now()}@example.com`;

    const registerResponse = await request(app)
      .post("/api/auth/register")
      .send({
        displayName: "Stats Test User",
        email: testUserEmail,
        password: "TestPassword123!",
        homeRegion: "Colorado",
      });

    expect(registerResponse.statusCode).toBe(201);

    const loginResponse = await request(app)
      .post("/api/auth/login")
      .send({
        email: testUserEmail,
        password: "TestPassword123!",
      });

    expect(loginResponse.statusCode).toBe(200);

    authToken = loginResponse.body.token;
    testUserId = loginResponse.body.user.id;

    const firstCatholeResponse = await request(app)
      .post("/api/catholes")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        latitude: 39.5501,
        longitude: -105.7821,
        elevation: 10000,
        terrainType: "alpine",
        method: "cathole",
        distanceFromWater: 250,
        distanceFromTrail: 250,
        distanceFromCamp: 250,
        depthConfirmed: true,
        tpPackedOut: true,
        notes: "Compliant statistics test entry.",
      });

    expect(firstCatholeResponse.statusCode).toBe(201);

    const secondCatholeResponse = await request(app)
      .post("/api/catholes")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        latitude: 39.5601,
        longitude: -105.7921,
        elevation: 11000,
        terrainType: "forest",
        method: "cathole",
        distanceFromWater: 100,
        distanceFromTrail: 100,
        distanceFromCamp: 100,
        depthConfirmed: true,
        tpPackedOut: false,
        notes: "Noncompliant statistics test entry.",
      });

    expect(secondCatholeResponse.statusCode).toBe(201);

    const waterSourceResponse = await request(app)
      .post("/api/water-sources")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        latitude: 39.5701,
        longitude: -105.8021,
        elevation: 12000,
        sourceType: "spring",
        flowRating: "strong",
        lastConfirmedDate: "2026-07-30",
        potabilityNotes: "Filter before drinking.",
        notes: "Statistics test water source.",
      });

    expect(waterSourceResponse.statusCode).toBe(201);
  });

  afterAll(async () => {
    await CatholeEntry.destroy({
      where: {
        userId: testUserId,
      },
    });

    await WaterSourceEntry.destroy({
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

  test("GET /api/stats/me calculates user statistics", async () => {
    const response = await request(app)
      .get("/api/stats/me")
      .set("Authorization", `Bearer ${authToken}`);

    expect(response.statusCode).toBe(200);

    expect(response.body).toEqual({
      stats: {
        catholesLogged: 2,
        waterSourcesLogged: 1,
        totalLogs: 3,
        tpPackOutRate: 50,
        distanceComplianceRate: 50,
        highestElevation: 12000,
      },
    });
  });
});