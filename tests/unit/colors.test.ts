import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  hexToRgb, rgb, MD_COLORS,
} from "../../src/utils/colors.js";

describe("hexToRgb", () => {
  it("parses #000000 to zeros", () => {
    const c = hexToRgb("#000000");
    assert.equal(c.red, 0);
    assert.equal(c.green, 0);
    assert.equal(c.blue, 0);
  });

  it("parses #FFFFFF to ones", () => {
    const c = hexToRgb("#FFFFFF");
    assert.equal(c.red, 1);
    assert.equal(c.green, 1);
    assert.equal(c.blue, 1);
  });

  it("parses #FF0000 to red", () => {
    const c = hexToRgb("#FF0000");
    assert.equal(c.red, 1);
    assert.equal(c.green, 0);
    assert.equal(c.blue, 0);
  });

  it("parses without # prefix", () => {
    const c = hexToRgb("4285F4");
    assert.ok(c.red > 0.25 && c.red < 0.27);
    assert.ok(c.green > 0.52 && c.green < 0.53);
    assert.ok(c.blue > 0.95 && c.blue < 0.96);
  });

  it("parses lowercase hex", () => {
    const c = hexToRgb("#ff8800");
    assert.equal(c.red, 1);
    assert.ok(c.green > 0.53 && c.green < 0.54);
    assert.equal(c.blue, 0);
  });

  it("throws on invalid hex", () => {
    assert.throws(
      () => hexToRgb("#GGG"),
      /Invalid hex color/,
    );
  });

  it("throws on too short hex", () => {
    assert.throws(
      () => hexToRgb("#FFF"),
      /Invalid hex color/,
    );
  });

  it("throws on empty string", () => {
    assert.throws(
      () => hexToRgb(""),
      /Invalid hex color/,
    );
  });
});

describe("rgb", () => {
  it("creates RgbColor object", () => {
    const c = rgb(0.5, 0.3, 0.1);
    assert.equal(c.red, 0.5);
    assert.equal(c.green, 0.3);
    assert.equal(c.blue, 0.1);
  });
});

describe("MD_COLORS", () => {
  it("has expected keys", () => {
    assert.ok(MD_COLORS.codeBg);
    assert.ok(MD_COLORS.link);
    assert.ok(MD_COLORS.blockquote);
    assert.ok(MD_COLORS.hrBorder);
  });
});
