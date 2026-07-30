const User = require("../models/User");

describe("User model validation", () => {
  const validUser = {
    displayName: "Test User",
    email: "test@example.com",
    passwordHash: "hashed-password-value",
    homeRegion: "Colorado",
    privacySetting: "private",
  };

  test("accepts a valid user", async () => {
    const user = User.build(validUser);

    await expect(user.validate()).resolves.toBeDefined();
  });

  test("normalizes email to lowercase", () => {
    const user = User.build({
      ...validUser,
      email: "  TEST@EXAMPLE.COM  ",
    });

    expect(user.email).toBe("test@example.com");
  });

  test("rejects an invalid email", async () => {
    const user = User.build({
      ...validUser,
      email: "not-an-email",
    });

    await expect(user.validate()).rejects.toThrow();
  });

  test("rejects a missing display name", async () => {
    const user = User.build({
      ...validUser,
      displayName: null,
    });

    await expect(user.validate()).rejects.toThrow();
  });

  test("rejects a display name that is too short", async () => {
    const user = User.build({
      ...validUser,
      displayName: "A",
    });

    await expect(user.validate()).rejects.toThrow();
  });

  test("rejects an empty password hash", async () => {
    const user = User.build({
      ...validUser,
      passwordHash: "",
    });

    await expect(user.validate()).rejects.toThrow();
  });

  test("rejects an invalid privacy setting", async () => {
    const user = User.build({
      ...validUser,
      privacySetting: "everyone",
    });

    await expect(user.validate()).rejects.toThrow();
  });

  test("rejects a home region longer than 100 characters", async () => {
    const user = User.build({
      ...validUser,
      homeRegion: "a".repeat(101),
    });

    await expect(user.validate()).rejects.toThrow();
  });
});