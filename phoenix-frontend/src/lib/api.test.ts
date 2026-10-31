import { describe, it, expect } from "vitest";
import { TOKEN_KEY, ApiError, describeError } from "./api";

describe("api helpers", () => {
  it("TOKEN_KEY is correct", () => {
    expect(TOKEN_KEY).toBe("phoenix.token");
  });

  it("ApiError stores status and message", () => {
    const err = new ApiError(404, "not found");
    expect(err.status).toBe(404);
    expect(err.message).toBe("not found");
  });

  it("describeError: 401 returns session expired message", () => {
    const msg = describeError(new ApiError(401, "Unauthorized"));
    expect(msg).toContain("session");
  });

  it("describeError: 402 returns not enough credits message", () => {
    const msg = describeError(new ApiError(402, "Payment Required"));
    expect(msg).toContain("credits");
  });

  it("describeError: 403 returns permission message", () => {
    const msg = describeError(new ApiError(403, "Forbidden"));
    expect(msg).toContain("permission");
  });

  it("describeError: 404 returns not found message", () => {
    const msg = describeError(new ApiError(404, "Not Found"));
    expect(msg).toContain("Not found");
  });

  it("describeError: 500 returns server error message", () => {
    const msg = describeError(new ApiError(500, "Internal Server Error"));
    expect(msg).toContain("Server error");
  });

  it("describeError: non-ApiError returns unexpected error message", () => {
    const msg = describeError(new Error("something random"));
    expect(msg).toBe("Unexpected error.");
  });
});
