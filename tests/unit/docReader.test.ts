import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  docToPlainText, docToMarkdown,
} from "../../src/utils/docReader.js";

function makeDoc(
  content: Record<string, unknown>[],
) {
  return { body: { content } } as never;
}

function paragraph(
  text: string,
  style?: Record<string, unknown>,
  textStyle?: Record<string, unknown>,
) {
  return {
    paragraph: {
      elements: [{
        textRun: {
          content: text,
          textStyle: textStyle ?? {},
        },
      }],
      paragraphStyle: style ?? {},
    },
  };
}

describe("docToPlainText", () => {
  it("extracts text from paragraphs", () => {
    const doc = makeDoc([
      paragraph("Hello\n"),
      paragraph("World\n"),
    ]);
    assert.equal(
      docToPlainText(doc), "Hello\nWorld\n",
    );
  });

  it("returns empty for empty body", () => {
    assert.equal(
      docToPlainText({ body: {} } as never),
      "",
    );
  });

  it("returns empty for no body", () => {
    assert.equal(
      docToPlainText({} as never), "",
    );
  });

  it("handles inline images", () => {
    const doc = makeDoc([{
      paragraph: {
        elements: [
          { inlineObjectElement: { inlineObjectId: "x" } },
        ],
        paragraphStyle: {},
      },
    }]);
    assert.equal(
      docToPlainText(doc), "[image]",
    );
  });

  it("handles tables as TSV", () => {
    const doc = makeDoc([{
      table: {
        tableRows: [{
          tableCells: [
            {
              content: [{
                paragraph: {
                  elements: [{
                    textRun: { content: "A" },
                  }],
                },
              }],
            },
            {
              content: [{
                paragraph: {
                  elements: [{
                    textRun: { content: "B" },
                  }],
                },
              }],
            },
          ],
        }],
      },
    }]);
    const text = docToPlainText(doc);
    assert.ok(text.includes("A\tB"));
  });

  it("handles section breaks", () => {
    const doc = makeDoc([
      paragraph("Before\n"),
      { sectionBreak: {} },
      paragraph("After\n"),
    ]);
    assert.ok(
      docToPlainText(doc).includes("\n"),
    );
  });
});

describe("docToMarkdown", () => {
  it("converts headings", () => {
    const doc = makeDoc([
      paragraph("Title\n", {
        namedStyleType: "HEADING_1",
      }),
    ]);
    const md = docToMarkdown(doc);
    assert.ok(md.startsWith("# "));
    assert.ok(md.includes("Title"));
  });

  it("converts bold text", () => {
    const doc = makeDoc([{
      paragraph: {
        elements: [{
          textRun: {
            content: "Bold",
            textStyle: { bold: true },
          },
        }],
        paragraphStyle: {},
      },
    }]);
    const md = docToMarkdown(doc);
    assert.ok(md.includes("**Bold**"));
  });

  it("converts italic text", () => {
    const doc = makeDoc([{
      paragraph: {
        elements: [{
          textRun: {
            content: "Italic",
            textStyle: { italic: true },
          },
        }],
        paragraphStyle: {},
      },
    }]);
    const md = docToMarkdown(doc);
    assert.ok(md.includes("*Italic*"));
  });

  it("converts bold+italic", () => {
    const doc = makeDoc([{
      paragraph: {
        elements: [{
          textRun: {
            content: "Both",
            textStyle: {
              bold: true,
              italic: true,
            },
          },
        }],
        paragraphStyle: {},
      },
    }]);
    const md = docToMarkdown(doc);
    assert.ok(md.includes("***Both***"));
  });

  it("converts code (monospace font)", () => {
    const doc = makeDoc([{
      paragraph: {
        elements: [{
          textRun: {
            content: "code",
            textStyle: {
              weightedFontFamily: {
                fontFamily: "Courier New",
              },
            },
          },
        }],
        paragraphStyle: {},
      },
    }]);
    const md = docToMarkdown(doc);
    assert.ok(md.includes("`code`"));
  });

  it("converts links", () => {
    const doc = makeDoc([{
      paragraph: {
        elements: [{
          textRun: {
            content: "Click",
            textStyle: {
              link: { url: "https://example.com" },
            },
          },
        }],
        paragraphStyle: {},
      },
    }]);
    const md = docToMarkdown(doc);
    assert.ok(
      md.includes(
        "[Click](https://example.com)",
      ),
    );
  });

  it("converts tables to markdown", () => {
    const doc = makeDoc([{
      table: {
        tableRows: [
          {
            tableCells: [
              {
                content: [{
                  paragraph: {
                    elements: [{
                      textRun: { content: "H1" },
                    }],
                  },
                }],
              },
              {
                content: [{
                  paragraph: {
                    elements: [{
                      textRun: { content: "H2" },
                    }],
                  },
                }],
              },
            ],
          },
          {
            tableCells: [
              {
                content: [{
                  paragraph: {
                    elements: [{
                      textRun: { content: "A" },
                    }],
                  },
                }],
              },
              {
                content: [{
                  paragraph: {
                    elements: [{
                      textRun: { content: "B" },
                    }],
                  },
                }],
              },
            ],
          },
        ],
      },
    }]);
    const md = docToMarkdown(doc);
    assert.ok(md.includes("| H1 | H2 |"));
    assert.ok(md.includes("| --- | --- |"));
    assert.ok(md.includes("| A | B |"));
  });

  it("converts section breaks to ---", () => {
    const doc = makeDoc([
      paragraph("Text"),
      { sectionBreak: {} },
    ]);
    const md = docToMarkdown(doc);
    assert.ok(md.includes("---"));
  });

  it("returns empty for empty body", () => {
    assert.equal(
      docToMarkdown({} as never), "",
    );
  });
});
