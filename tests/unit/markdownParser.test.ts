import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  markdownToGoogleDocsRequests,
  markdownToRequestBatches,
} from "../../src/utils/markdownParser.js";

describe("markdownToGoogleDocsRequests", () => {
  it("converts plain paragraph", () => {
    const reqs = markdownToGoogleDocsRequests(
      "Hello world",
    );
    assert.ok(reqs.length > 0);
    const insert = reqs.find(
      (r) => r.insertText,
    );
    assert.ok(insert);
    assert.ok(
      insert?.insertText?.text?.includes(
        "Hello world",
      ),
    );
  });

  it("converts heading", () => {
    const reqs = markdownToGoogleDocsRequests(
      "# Title",
    );
    const heading = reqs.find(
      (r) => r.updateParagraphStyle,
    );
    assert.ok(heading);
    assert.equal(
      heading?.updateParagraphStyle
        ?.paragraphStyle?.namedStyleType,
      "HEADING_1",
    );
  });

  it("converts bold text", () => {
    const reqs = markdownToGoogleDocsRequests(
      "**bold**",
    );
    const bold = reqs.find(
      (r) => r.updateTextStyle
        ?.textStyle?.bold === true,
    );
    assert.ok(bold);
  });

  it("converts italic text", () => {
    const reqs = markdownToGoogleDocsRequests(
      "*italic*",
    );
    const italic = reqs.find(
      (r) => r.updateTextStyle
        ?.textStyle?.italic === true,
    );
    assert.ok(italic);
  });

  it("converts strikethrough", () => {
    const reqs = markdownToGoogleDocsRequests(
      "~~deleted~~",
    );
    const strike = reqs.find(
      (r) => r.updateTextStyle
        ?.textStyle?.strikethrough === true,
    );
    assert.ok(strike);
  });

  it("converts code span", () => {
    const reqs = markdownToGoogleDocsRequests(
      "`code`",
    );
    const code = reqs.find(
      (r) => r.updateTextStyle
        ?.textStyle?.weightedFontFamily
        ?.fontFamily === "Courier New",
    );
    assert.ok(code);
  });

  it("converts link", () => {
    const reqs = markdownToGoogleDocsRequests(
      "[text](https://example.com)",
    );
    const link = reqs.find(
      (r) => r.updateTextStyle
        ?.textStyle?.link?.url
        === "https://example.com",
    );
    assert.ok(link);
  });

  it("converts unordered list", () => {
    const reqs = markdownToGoogleDocsRequests(
      "- Item 1\n- Item 2",
    );
    const bullet = reqs.find(
      (r) => r.createParagraphBullets,
    );
    assert.ok(bullet);
    assert.equal(
      bullet?.createParagraphBullets
        ?.bulletPreset,
      "BULLET_DISC_CIRCLE_SQUARE",
    );
  });

  it("converts ordered list", () => {
    const reqs = markdownToGoogleDocsRequests(
      "1. First\n2. Second",
    );
    const bullet = reqs.find(
      (r) => r.createParagraphBullets,
    );
    assert.ok(bullet);
    assert.equal(
      bullet?.createParagraphBullets
        ?.bulletPreset,
      "NUMBERED_DECIMAL_ALPHA_ROMAN",
    );
  });

  it("converts code block", () => {
    const reqs = markdownToGoogleDocsRequests(
      "```\ncode line\n```",
    );
    const codeStyle = reqs.find(
      (r) => r.updateTextStyle?.fields
        ?.includes("weightedFontFamily"),
    );
    assert.ok(codeStyle);
  });

  it("converts blockquote", () => {
    const reqs = markdownToGoogleDocsRequests(
      "> Quote text",
    );
    const italic = reqs.find(
      (r) => r.updateTextStyle?.fields
        ?.includes("italic"),
    );
    assert.ok(italic);
  });

  it("converts horizontal rule", () => {
    const reqs = markdownToGoogleDocsRequests(
      "---",
    );
    const hr = reqs.find(
      (r) => r.updateParagraphStyle?.fields
        ?.includes("borderBottom"),
    );
    assert.ok(hr);
  });

  it("uses custom startIndex", () => {
    const reqs = markdownToGoogleDocsRequests(
      "Hello", 50,
    );
    const insert = reqs.find(
      (r) => r.insertText,
    );
    assert.equal(
      insert?.insertText?.location?.index, 50,
    );
  });
});

describe("markdownToRequestBatches", () => {
  it("returns single batch without tables",
    () => {
      const batches = markdownToRequestBatches(
        "# Title\n\nParagraph",
      );
      assert.equal(batches.length, 1);
      assert.ok(batches[0].length > 0);
    },
  );

  it("splits into batches around tables", () => {
    const md =
      "Before\n\n"
      + "| A | B |\n|---|---|\n| 1 | 2 |\n\n"
      + "After";
    const batches = markdownToRequestBatches(md);
    assert.ok(batches.length >= 2);
    const hasInsertTable = batches.some(
      (b) => b.some((r) => r.insertTable),
    );
    assert.ok(hasInsertTable);
  });

  it("fills table cells in separate batch",
    () => {
      const md =
        "| H1 | H2 |\n|---|---|\n| A | B |";
      const batches = markdownToRequestBatches(md);
      assert.ok(batches.length >= 2);
      const fillBatch = batches[batches.length - 1];
      const hasInsert = fillBatch.some(
        (r) => r.insertText,
      );
      assert.ok(hasInsert);
    },
  );
});
