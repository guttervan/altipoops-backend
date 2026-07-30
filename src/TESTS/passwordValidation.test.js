const request = require("supertest");
const app = require("../server");
const sequelize = require("../config/database");
const User = require("../models/User");

describe("Registration password validation", () => {
  const createdEmails = [];

  afterAll(async () => {
    await User.destroy({
      where: {
        email: createdEmails,
      },
    });

    await sequelize.close();
  });

  test("rejects a password shorter than 8 characters", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        displayName: "Password Test",
        email: `short-${Date.now()}@example.com`,
        password: "Test1",
      });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message: "Password must be at least 8 characters long.",
    });
  });

  test("rejects a password without an uppercase letter", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        displayName: "Password Test",
        email: `uppercase-${Date.now()}@example.com`,
        password: "password123",
      });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message: "Password must include at least one uppercase letter.",
    });
  });

  test("rejects a password without a lowercase letter", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        displayName: "Password Test",
        email: `lowercase-${Date.now()}@example.com`,
        password: "PASSWORD123",
      });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message: "Password must include at least one lowercase letter.",
    });
  });

  test("rejects a password without a number", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        displayName: "Password Test",
        email: `number-${Date.now()}@example.com`,
        password: "PasswordOnly",
      });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message: "Password must include at least one number.",
    });
  });

  test("accepts a password that meets all requirements", async () => {
    const email = `valid-password-${Date.now()}@example.com`;
    createdEmails.push(email);

    const response = await request(app)
      .post("/api/auth/register")
      .send({
        displayName: "Password Test",
        email,
        password: "Password123",
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.user.email).toBe(email);
  });
});