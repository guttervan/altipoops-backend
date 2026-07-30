const request = require("supertest");
const app = require("../server");
const sequelize = require("../config/database");
const User = require("../models/User");

describe("Altipoop authentication and profile", () => {
  let testUserEmail;
  let authToken;
  let testUserId;

  beforeAll(() => {
    testUserEmail = `auth-test-${Date.now()}@example.com`;
  });

  afterAll(async () => {
    if (testUserId) {
      await User.destroy({
        where: {
          id: testUserId,
        },
      });
    }

    await sequelize.close();
  });

  test("POST /api/auth/register rejects missing fields", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        email: testUserEmail,
      });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message: "Display name, email, and password are required.",
    });
  });

  test("POST /api/auth/register creates a user", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        displayName: "Auth Test User",
        email: testUserEmail,
        password: "TestPassword123!",
        homeRegion: "Colorado",
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.message).toBe(
      "User registered successfully!"
    );

    expect(response.body.user).toEqual(
      expect.objectContaining({
        displayName: "Auth Test User",
        email: testUserEmail,
        homeRegion: "Colorado",
      })
    );

    expect(response.body.user.passwordHash).toBeUndefined();

    testUserId = response.body.user.id;
  });

  test("POST /api/auth/register rejects duplicate email", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        displayName: "Duplicate User",
        email: testUserEmail,
        password: "TestPassword123!",
      });

    expect(response.statusCode).toBe(409);
    expect(response.body).toEqual({
      message: "An account with that email already exists.",
    });
  });

  test("POST /api/auth/login rejects incorrect password", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: testUserEmail,
        password: "WrongPassword123!",
      });

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({
      message: "Invalid email or password.",
    });
  });

  test("POST /api/auth/login returns a token", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: testUserEmail,
        password: "TestPassword123!",
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe("Login successful!");
    expect(response.body.token).toBeDefined();
    expect(response.body.user.email).toBe(testUserEmail);
    expect(response.body.user.passwordHash).toBeUndefined();

    authToken = response.body.token;
  });

  test("GET /api/auth/me returns the logged-in user", async () => {
    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${authToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.user).toEqual(
      expect.objectContaining({
        id: testUserId,
        displayName: "Auth Test User",
        email: testUserEmail,
        homeRegion: "Colorado",
      })
    );

    expect(response.body.user.passwordHash).toBeUndefined();
  });

  test("PUT /api/auth/me rejects invalid privacy setting", async () => {
    const response = await request(app)
      .put("/api/auth/me")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        privacySetting: "everyone",
      });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message:
        "Privacy setting must be private, friends, or public.",
    });
  });

  test("PUT /api/auth/me updates the profile", async () => {
    const response = await request(app)
      .put("/api/auth/me")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        displayName: "Updated Auth Test User",
        homeRegion: "Colorado Springs",
        privacySetting: "private",
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe(
      "Profile updated successfully!"
    );

    expect(response.body.user).toEqual(
      expect.objectContaining({
        id: testUserId,
        displayName: "Updated Auth Test User",
        email: testUserEmail,
        homeRegion: "Colorado Springs",
        privacySetting: "private",
      })
    );
  });
});