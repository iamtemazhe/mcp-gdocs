import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  findTab, getBodyContent,
} from "../../src/utils/tabs.js";

const DOC = {
  tabs: [
    {
      tabProperties: { tabId: "tab-1" },
      documentTab: {
        body: {
          content: [
            { startIndex: 0, endIndex: 10 },
          ],
        },
      },
      childTabs: [
        {
          tabProperties: { tabId: "child-1" },
          documentTab: {
            body: {
              content: [
                { startIndex: 0, endIndex: 5 },
              ],
            },
          },
        },
      ],
    },
    {
      tabProperties: { tabId: "tab-2" },
      documentTab: {
        body: { content: [] },
      },
    },
  ],
  body: {
    content: [
      { startIndex: 0, endIndex: 20 },
    ],
  },
};

describe("findTab", () => {
  it("finds top-level tab", () => {
    const tab = findTab(DOC as never, "tab-1");
    assert.ok(tab);
    assert.equal(
      tab?.tabProperties?.tabId, "tab-1",
    );
  });

  it("finds child tab", () => {
    const tab = findTab(DOC as never, "child-1");
    assert.ok(tab);
    assert.equal(
      tab?.tabProperties?.tabId, "child-1",
    );
  });

  it("returns null for missing tab", () => {
    const tab = findTab(DOC as never, "missing");
    assert.equal(tab, null);
  });

  it("returns null for empty doc", () => {
    const tab = findTab({} as never, "any");
    assert.equal(tab, null);
  });
});

describe("getBodyContent", () => {
  it("returns main body without tabId", () => {
    const content = getBodyContent(DOC as never);
    assert.equal(content.length, 1);
    assert.equal(content[0].endIndex, 20);
  });

  it("returns tab body with tabId", () => {
    const content = getBodyContent(
      DOC as never, "tab-1",
    );
    assert.equal(content.length, 1);
    assert.equal(content[0].endIndex, 10);
  });

  it("returns child tab body", () => {
    const content = getBodyContent(
      DOC as never, "child-1",
    );
    assert.equal(content.length, 1);
    assert.equal(content[0].endIndex, 5);
  });

  it("throws for missing tab", () => {
    assert.throws(
      () => getBodyContent(
        DOC as never, "nonexistent",
      ),
      /Tab "nonexistent" not found/,
    );
  });

  it("returns empty array for empty body", () => {
    const content = getBodyContent(
      DOC as never, "tab-2",
    );
    assert.equal(content.length, 0);
  });
});
