const jwt = require("jsonwebtoken");
const requireAuth = require("../middleware/authMiddleware");

describe("requireAuth middleware", () => {
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET = "test-jwt-secret";
  });

  afterAll(() => {
    process.env.JWT_SECRET = originalJwtSecret;
  });

  function createMockResponse() {
    const response = {};

    response.status = jest.fn(() => response);
    response.json = jest.fn(() => response);

    return response;
  }

  test("allows a valid Bearer token", () => {
    const token = jwt.sign(
      {
        userId: 12,
        email: "test@example.com",
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h",
      }
    );

    const request = {
      headers: {
        authorization: `Bearer ${token}`,
      },
    };

    const response = createMockResponse();
    const next = jest.fn();

    requireAuth(request, response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(request.user).toEqual(
      expect.objectContaining({
        userId: 12,
        email: "test@example.com",
      })
    );
    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).not.toHaveBeenCalled();
  });

  test("rejects a missing Authorization header", () => {
    const request = {
      headers: {},
    };

    const response = createMockResponse();
    const next = jest.fn();

    requireAuth(request, response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({
      message: "Login token required.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("rejects a header without Bearer", () => {
    const request = {
      headers: {
        authorization: "invalid-token",
      },
    };

    const response = createMockResponse();
    const next = jest.fn();

    requireAuth(request, response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({
      message: "Login token required.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("rejects a malformed token", () => {
    const request = {
      headers: {
        authorization: "Bearer definitely-not-a-real-token",
      },
    };

    const response = createMockResponse();
    const next = jest.fn();

    requireAuth(request, response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({
      message: "Invalid or expired login token.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("rejects a token signed with the wrong secret", () => {
    const token = jwt.sign(
      {
        userId: 12,
      },
      "wrong-secret"
    );

    const request = {
      headers: {
        authorization: `Bearer ${token}`,
      },
    };

    const response = createMockResponse();
    const next = jest.fn();

    requireAuth(request, response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({
      message: "Invalid or expired login token.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("rejects an expired token", () => {
    const token = jwt.sign(
      {
        userId: 12,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: -1,
      }
    );

    const request = {
      headers: {
        authorization: `Bearer ${token}`,
      },
    };

    const response = createMockResponse();
    const next = jest.fn();

    requireAuth(request, response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({
      message: "Invalid or expired login token.",
    });
    expect(next).not.toHaveBeenCalled();
  });
});