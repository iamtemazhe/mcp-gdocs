import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  bulkResult, formatApiError,
} from "../../src/utils/errors.js";

describe("bulkResult", () => {
  it("reports all successful", () => {
    const settled: PromiseSettledResult<unknown>[] = [
      { status: "fulfilled", value: { id: 1 } },
      { status: "fulfilled", value: { id: 2 } },
    ];
    const r = bulkResult(settled);
    assert.ok(
      r.content[0].text.includes("2/2"),
    );
    assert.equal(r.isError, false);
  });

  it("reports partial failure", () => {
    const settled: PromiseSettledResult<unknown>[] = [
      { status: "fulfilled", value: { id: 1 } },
      {
        status: "rejected",
        reason: new Error("fail"),
      },
    ];
    const r = bulkResult(settled);
    assert.ok(
      r.content[0].text.includes("1/2"),
    );
    assert.ok(
      r.content[0].text.includes("ошибок: 1"),
    );
    assert.equal(r.isError, false);
  });

  it("reports all failed", () => {
    const settled: PromiseSettledResult<unknown>[] = [
      {
        status: "rejected",
        reason: new Error("a"),
      },
      {
        status: "rejected",
        reason: new Error("b"),
      },
    ];
    const r = bulkResult(settled);
    assert.equal(r.isError, true);
    assert.ok(
      r.content[0].text.includes("0/2"),
    );
  });

  it("handles non-Error rejection", () => {
    const settled: PromiseSettledResult<unknown>[] = [
      { status: "rejected", reason: "string err" },
    ];
    const r = bulkResult(settled);
    assert.ok(
      r.content[0].text.includes("string err"),
    );
  });
});

describe("formatApiError", () => {
  it("formats Gaxios-like error", () => {
    const err = Object.assign(
      new Error("API fail"),
      {
        response: {
          status: 403,
          data: {
            error: { message: "Forbidden" },
          },
        },
      },
    );
    const r = formatApiError(err);
    assert.ok(
      r.content[0].text.includes("403"),
    );
    assert.ok(
      r.content[0].text.includes("Forbidden"),
    );
    assert.ok(
      r.content[0].text.includes("права"),
    );
    assert.equal(r.isError, true);
  });

  it("formats 404 with hint", () => {
    const err = Object.assign(
      new Error("Not found"),
      {
        response: {
          status: 404,
          data: {
            error: { message: "Not found" },
          },
        },
      },
    );
    const r = formatApiError(err);
    assert.ok(
      r.content[0].text.includes("не найден"),
    );
  });

  it("formats 429 with hint", () => {
    const err = Object.assign(
      new Error("Rate limited"),
      {
        response: {
          status: 429,
          data: {
            error: { message: "Rate limited" },
          },
        },
      },
    );
    const r = formatApiError(err);
    assert.ok(
      r.content[0].text.includes("лимит"),
    );
  });

  it("formats plain Error", () => {
    const r = formatApiError(
      new Error("Something broke"),
    );
    assert.ok(
      r.content[0].text.includes("Something broke"),
    );
    assert.equal(r.isError, true);
  });

  it("formats non-Error value", () => {
    const r = formatApiError("raw string");
    assert.ok(
      r.content[0].text.includes("raw string"),
    );
    assert.equal(r.isError, true);
  });
});
