import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeOptionalRuralDecimal,
  normalizeRuralDecimal,
  parseDatabaseDate,
  parseOccurredAt,
  parseOptionalDatabaseDate,
  parseOptionalOccurredAt,
  RuralInputError,
} from "./rural-input-normalization";

test("normaliza formatos decimais brasileiros e canônicos", () => {
  assert.equal(normalizeRuralDecimal("12,5"), "12.5");
  assert.equal(normalizeRuralDecimal("1.234,56"), "1234.56");
  assert.equal(normalizeRuralDecimal("1.234.567"), "1234567");
  assert.equal(normalizeRuralDecimal("1000"), "1000");
  assert.equal(normalizeRuralDecimal("1000.25"), "1000.25");
  assert.equal(normalizeRuralDecimal("0012,5000"), "12.5");
  assert.equal(normalizeRuralDecimal("-0,00"), "0");
});

test("recusa ponto único ambíguo, vazio e agrupamentos inválidos", () => {
  for (const [value, expectedCode] of [
    ["1.234", "AMBIGUOUS_DECIMAL"],
    ["", "EMPTY_VALUE"],
    ["1.23,45", "INVALID_DECIMAL"],
    ["1,234.56", "INVALID_DECIMAL"],
    ["1 234,56", "INVALID_DECIMAL"],
    ["1e3", "INVALID_DECIMAL"],
  ] as const) {
    assert.throws(
      () => normalizeRuralDecimal(value),
      (error: unknown) => {
        assert.ok(error instanceof RuralInputError);
        assert.equal(error.code, expectedCode);
        return true;
      },
    );
  }

  assert.equal(normalizeOptionalRuralDecimal("  "), null);
  assert.equal(normalizeOptionalRuralDecimal(null), null);
});

test("datas de banco usam YYYY-MM-DD em UTC e validam o calendário", () => {
  assert.equal(
    parseDatabaseDate("2028-02-29").toISOString(),
    "2028-02-29T00:00:00.000Z",
  );
  assert.equal(parseOptionalDatabaseDate(""), null);

  for (const value of ["2027-02-29", "2026-13-01", "07/08/2026"]) {
    assert.throws(() => parseDatabaseDate(value), RuralInputError);
  }
});

test("occurredAt ancora data simples ao meio-dia UTC e exige timezone no horário", () => {
  assert.equal(
    parseOccurredAt("2026-08-07").toISOString(),
    "2026-08-07T12:00:00.000Z",
  );
  assert.equal(
    parseOccurredAt("2026-08-07T09:30:15-03:00").toISOString(),
    "2026-08-07T12:30:15.000Z",
  );
  assert.equal(
    parseOccurredAt("2026-08-07T12:30Z").toISOString(),
    "2026-08-07T12:30:00.000Z",
  );
  assert.equal(parseOptionalOccurredAt(undefined), null);

  for (const value of [
    "2026-08-07T09:30",
    "2026-08-07 09:30-03:00",
    "2026-08-07T25:00Z",
  ]) {
    assert.throws(
      () => parseOccurredAt(value),
      (error: unknown) => {
        assert.ok(error instanceof RuralInputError);
        assert.equal(error.code, "INVALID_OCCURRED_AT");
        return true;
      },
    );
  }
});
