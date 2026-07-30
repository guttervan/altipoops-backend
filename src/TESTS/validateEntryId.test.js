const validateEntryId = require("../middleware/validateEntryId");

describe("validateEntryId middleware", () => {
  function createMockResponse() {
    const response = {};

    response.status = jest.fn(() => response);
    response.json = jest.fn(() => response);

    return response;
  }

  test("allows a valid positive whole number ID", () => {
    const request = {
      params: {
        id: "12",
      },
    };

    const response = createMockResponse();
    const next = jest.fn();

    validateEntryId(request, response, next);

    expect(request.params.id).toBe(12);
    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).not.toHaveBeenCalled();
  });

  test("rejects a non-numeric ID", () => {
    const request = {
      params: {
        id: "YOUR_ID",
      },
    };

    const response = createMockResponse();
    const next = jest.fn();

    validateEntryId(request, response, next);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      message: "Entry ID must be a positive whole number.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("rejects zero", () => {
    const request = {
      params: {
        id: "0",
      },
    };

    const response = createMockResponse();
    const next = jest.fn();

    validateEntryId(request, response, next);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      message: "Entry ID must be a positive whole number.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("rejects a negative number", () => {
    const request = {
      params: {
        id: "-4",
      },
    };

    const response = createMockResponse();
    const next = jest.fn();

    validateEntryId(request, response, next);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      message: "Entry ID must be a positive whole number.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("rejects a decimal number", () => {
    const request = {
      params: {
        id: "2.5",
      },
    };

    const response = createMockResponse();
    const next = jest.fn();

    validateEntryId(request, response, next);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      message: "Entry ID must be a positive whole number.",
    });
    expect(next).not.toHaveBeenCalled();
  });
});