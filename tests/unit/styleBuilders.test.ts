import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildTextStyle,
  buildTextStyleRequest,
  buildParagraphStyle,
  buildParagraphStyleRequest,
  buildHeadingStyleRequest,
  buildImageRequest,
  buildTableCellStyleRequest,
} from "../../src/utils/styleBuilders.js";

describe("buildTextStyle", () => {
  it("builds bold style", () => {
    const { style, fields } = buildTextStyle({
      startIndex: 1, endIndex: 5, bold: true,
    });
    assert.equal(style.bold, true);
    assert.ok(fields.includes("bold"));
  });

  it("builds multiple styles", () => {
    const { style, fields } = buildTextStyle({
      startIndex: 1,
      endIndex: 10,
      bold: true,
      italic: true,
      strikethrough: true,
    });
    assert.equal(style.bold, true);
    assert.equal(style.italic, true);
    assert.equal(style.strikethrough, true);
    assert.equal(fields.length, 3);
  });

  it("builds font size", () => {
    const { style, fields } = buildTextStyle({
      startIndex: 1, endIndex: 5, fontSize: 14,
    });
    assert.equal(
      style.fontSize?.magnitude, 14,
    );
    assert.equal(style.fontSize?.unit, "PT");
    assert.ok(fields.includes("fontSize"));
  });

  it("builds font family", () => {
    const { style, fields } = buildTextStyle({
      startIndex: 1,
      endIndex: 5,
      fontFamily: "Arial",
    });
    assert.equal(
      style.weightedFontFamily?.fontFamily,
      "Arial",
    );
    assert.ok(
      fields.includes("weightedFontFamily"),
    );
  });

  it("builds foreground color", () => {
    const { style, fields } = buildTextStyle({
      startIndex: 1,
      endIndex: 5,
      foregroundColor: "#FF0000",
    });
    assert.equal(
      style.foregroundColor?.color?.rgbColor?.red,
      1,
    );
    assert.ok(
      fields.includes("foregroundColor"),
    );
  });

  it("returns empty for no styles", () => {
    const { fields } = buildTextStyle({
      startIndex: 1, endIndex: 5,
    });
    assert.equal(fields.length, 0);
  });
});

describe("buildTextStyleRequest", () => {
  it("wraps in updateTextStyle", () => {
    const req = buildTextStyleRequest({
      startIndex: 5, endIndex: 10, bold: true,
    });
    assert.ok(req.updateTextStyle);
    assert.equal(
      req.updateTextStyle?.range?.startIndex, 5,
    );
    assert.equal(
      req.updateTextStyle?.range?.endIndex, 10,
    );
  });
});

describe("buildParagraphStyle", () => {
  it("builds alignment", () => {
    const { style, fields } = buildParagraphStyle({
      startIndex: 1,
      endIndex: 10,
      alignment: "CENTER",
    });
    assert.equal(style.alignment, "CENTER");
    assert.ok(fields.includes("alignment"));
  });

  it("builds line spacing", () => {
    const { style, fields } = buildParagraphStyle({
      startIndex: 1,
      endIndex: 10,
      lineSpacing: 150,
    });
    assert.equal(style.lineSpacing, 150);
    assert.ok(fields.includes("lineSpacing"));
  });

  it("builds space before/after", () => {
    const { style, fields } = buildParagraphStyle({
      startIndex: 1,
      endIndex: 10,
      spaceBefore: 12,
      spaceAfter: 6,
    });
    assert.equal(
      style.spaceAbove?.magnitude, 12,
    );
    assert.equal(
      style.spaceBelow?.magnitude, 6,
    );
    assert.ok(fields.includes("spaceAbove"));
    assert.ok(fields.includes("spaceBelow"));
  });

  it("builds indents", () => {
    const { style, fields } = buildParagraphStyle({
      startIndex: 1,
      endIndex: 10,
      indentFirstLine: 35,
      indentStart: 20,
    });
    assert.equal(
      style.indentFirstLine?.magnitude, 35,
    );
    assert.equal(
      style.indentStart?.magnitude, 20,
    );
    assert.equal(fields.length, 2);
  });
});

describe("buildParagraphStyleRequest", () => {
  it("applies safeStart (+1 for index > 1)",
    () => {
      const req = buildParagraphStyleRequest({
        startIndex: 5,
        endIndex: 10,
        alignment: "CENTER",
      });
      const range =
        req.updateParagraphStyle?.range;
      assert.equal(range?.startIndex, 6);
      assert.equal(range?.endIndex, 10);
    },
  );

  it("keeps startIndex=1 unchanged", () => {
    const req = buildParagraphStyleRequest({
      startIndex: 1,
      endIndex: 10,
      alignment: "START",
    });
    assert.equal(
      req.updateParagraphStyle?.range
        ?.startIndex,
      1,
    );
  });
});

describe("buildHeadingStyleRequest", () => {
  it("sets namedStyleType", () => {
    const req = buildHeadingStyleRequest({
      startIndex: 5,
      endIndex: 15,
      headingStyle: "HEADING_2",
    });
    assert.equal(
      req.updateParagraphStyle?.paragraphStyle
        ?.namedStyleType,
      "HEADING_2",
    );
    assert.equal(
      req.updateParagraphStyle?.fields,
      "namedStyleType",
    );
  });

  it("applies safeStart", () => {
    const req = buildHeadingStyleRequest({
      startIndex: 10,
      endIndex: 20,
      headingStyle: "HEADING_1",
    });
    assert.equal(
      req.updateParagraphStyle?.range
        ?.startIndex,
      11,
    );
  });
});

describe("buildImageRequest", () => {
  it("builds without size", () => {
    const req = buildImageRequest({
      imageUrl: "https://example.com/img.png",
      index: 5,
    });
    assert.ok(req.insertInlineImage);
    assert.equal(
      req.insertInlineImage?.uri,
      "https://example.com/img.png",
    );
    assert.equal(
      req.insertInlineImage?.location?.index,
      5,
    );
    assert.equal(
      req.insertInlineImage?.objectSize,
      undefined,
    );
  });

  it("builds with size", () => {
    const req = buildImageRequest({
      imageUrl: "https://example.com/img.png",
      index: 1,
      width: 200,
      height: 100,
    });
    assert.equal(
      req.insertInlineImage?.objectSize?.width
        ?.magnitude,
      200,
    );
    assert.equal(
      req.insertInlineImage?.objectSize?.height
        ?.magnitude,
      100,
    );
  });
});

describe("buildTableCellStyleRequest", () => {
  it("builds background color", () => {
    const req = buildTableCellStyleRequest(5, {
      rowIndex: 0,
      columnIndex: 1,
      backgroundColor: "#4285F4",
    });
    assert.ok(req.updateTableCellStyle);
    const tc = req.updateTableCellStyle;
    assert.equal(
      tc?.tableRange?.tableCellLocation
        ?.tableStartLocation?.index,
      5,
    );
    assert.equal(
      tc?.tableRange?.tableCellLocation
        ?.rowIndex,
      0,
    );
    assert.equal(
      tc?.tableRange?.tableCellLocation
        ?.columnIndex,
      1,
    );
    assert.equal(
      tc?.fields, "backgroundColor",
    );
  });
});
