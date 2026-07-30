const request = require("supertest");
const app = require("../server");
const sequelize = require("../config/database");
const User = require("../models/User");

describe("Authentication validation and normalization", () => {
  let testUserId;
  let authToken;

  const originalEmail = `NORMALIZED-${Date.now()}@EXAMPLE.COM`;
  const normalizedEmail = originalEmail.toLowerCase();

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

  test("registration rejects an invalid email address", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        displayName: "Invalid Email User",
        email: "not-an-email",
        password: "TestPassword123!",
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBeDefined();
  });

  test("registration rejects a display name that is too short", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        displayName: "A",
        email: `short-name-${Date.now()}@example.com`,
        password: "TestPassword123!",
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBeDefined();
  });

  test("registration normalizes an uppercase email", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        displayName: "Normalized Email User",
        email: `  ${originalEmail}  `,
        password: "TestPassword123!",
        homeRegion: "Colorado",
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.user.email).toBe(normalizedEmail);

    testUserId = response.body.user.id;
  });

  test("registration rejects the same email with different casing", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        displayName: "Duplicate Case User",
        email: normalizedEmail,
        password: "TestPassword123!",
      });

    expect(response.statusCode).toBe(409);
    expect(response.body).toEqual({
      message: "An account with that email already exists.",
    });
  });

  test("login accepts an email with different casing and spaces", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: `  ${originalEmail}  `,
        password: "TestPassword123!",
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.token).toBeDefined();
    expect(response.body.user.email).toBe(normalizedEmail);

    authToken = response.body.token;
  });

  test("profile update rejects an excessively long home region", async () => {
    const response = await request(app)
      .put("/api/auth/me")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        homeRegion: "a".repeat(101),
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBeDefined();
  });
});