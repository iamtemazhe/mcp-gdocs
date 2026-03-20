import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { injectTabId } from "../../src/utils/batch.js";

describe("injectTabId", () => {
  it("returns requests unchanged without tabId",
    () => {
      const reqs = [
        {
          insertText: {
            location: { index: 1 },
            text: "hello",
          },
        },
      ];
      const result = injectTabId(reqs);
      assert.equal(
        result[0].insertText?.location?.index,
        1,
      );
      assert.equal(
        (result[0].insertText?.location as
          Record<string, unknown>)?.tabId,
        undefined,
      );
    },
  );

  it("adds tabId to location objects", () => {
    const reqs = [
      {
        insertText: {
          location: { index: 5 },
          text: "test",
        },
      },
    ];
    injectTabId(reqs, "tab-42");
    assert.equal(
      (reqs[0].insertText?.location as
        Record<string, unknown>)?.tabId,
      "tab-42",
    );
  });

  it("adds tabId to range objects", () => {
    const reqs = [
      {
        updateTextStyle: {
          range: {
            startIndex: 1,
            endIndex: 10,
          },
          textStyle: { bold: true },
          fields: "bold",
        },
      },
    ];
    injectTabId(reqs, "tab-7");
    assert.equal(
      (reqs[0].updateTextStyle?.range as
        Record<string, unknown>)?.tabId,
      "tab-7",
    );
  });

  it("handles nested structures", () => {
    const reqs = [
      {
        updateParagraphStyle: {
          range: {
            startIndex: 1,
            endIndex: 20,
          },
          paragraphStyle: {
            namedStyleType: "HEADING_1",
          },
          fields: "namedStyleType",
        },
      },
    ];
    injectTabId(reqs, "nested-tab");
    assert.equal(
      (reqs[0].updateParagraphStyle?.range as
        Record<string, unknown>)?.tabId,
      "nested-tab",
    );
  });

  it("handles multiple requests", () => {
    const reqs = [
      {
        insertText: {
          location: { index: 1 },
          text: "a",
        },
      },
      {
        updateTextStyle: {
          range: {
            startIndex: 1,
            endIndex: 2,
          },
          textStyle: { bold: true },
          fields: "bold",
        },
      },
    ];
    injectTabId(reqs, "multi");
    assert.equal(
      (reqs[0].insertText?.location as
        Record<string, unknown>)?.tabId,
      "multi",
    );
    assert.equal(
      (reqs[1].updateTextStyle?.range as
        Record<string, unknown>)?.tabId,
      "multi",
    );
  });
});
