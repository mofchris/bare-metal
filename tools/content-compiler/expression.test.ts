import { describe, expect, it } from "vitest";
import { evaluateExpression, ExpressionError } from "./expression.ts";

/** Shorthand: evaluate with no variables bound. */
function evaluate(source: string, vars: Record<string, number> = {}): number {
  return evaluateExpression(source, vars);
}

describe("evaluateExpression", () => {
  it("applies the ordinary precedence of arithmetic", () => {
    expect(evaluate("2 + 3 * 4")).toBe(14);
    expect(evaluate("(2 + 3) * 4")).toBe(20);
    expect(evaluate("10 - 4 - 3")).toBe(3); // left-associative
  });

  it("treats exponentiation as right-associative, as maths notation does", () => {
    expect(evaluate("2 ^ 3 ^ 2")).toBe(512); // 2^9, not (2^3)^2 = 64
  });

  it("reads scientific notation, so a clock speed can be written 3e9", () => {
    expect(evaluate("3e9 / 1e9")).toBe(3);
  });

  it("substitutes named variables", () => {
    expect(evaluate("latency_ns * clock_ghz", { latency_ns: 100, clock_ghz: 3 })).toBe(
      300,
    );
  });

  it("computes the DRAM-latency-in-cycles question the curriculum actually asks", () => {
    // m1/03: 100 ns at 3 GHz is ~300 wasted cycles. The point of the evaluator
    // is that this number is calculated for every variant, never transcribed.
    const cycles = evaluate("round(latency_ns * clock_ghz)", {
      latency_ns: 100,
      clock_ghz: 3.0,
    });
    expect(cycles).toBe(300);
    expect(evaluate("round(1 / clock_ghz, 2)", { clock_ghz: 3.0 })).toBe(0.33);
  });

  it("rounds to a requested number of decimal places", () => {
    expect(evaluate("round(1 / 3, 2)")).toBe(0.33);
    expect(evaluate("round(2.5)")).toBe(3);
  });

  it("supports the small closed list of functions", () => {
    expect(evaluate("floor(2.9)")).toBe(2);
    expect(evaluate("ceil(2.1)")).toBe(3);
    expect(evaluate("abs(0 - 5)")).toBe(5);
    expect(evaluate("sqrt(16)")).toBe(4);
    expect(evaluate("min(3, 7)")).toBe(3);
    expect(evaluate("max(3, 7)")).toBe(7);
  });

  it("applies unary minus, including in front of a variable", () => {
    expect(evaluate("-x + 10", { x: 4 })).toBe(6);
  });

  it("names the unknown variable rather than quietly producing NaN", () => {
    expect(() => evaluate("clock * 2", { clk: 3 })).toThrow(ExpressionError);
    expect(() => evaluate("clock * 2", { clk: 3 })).toThrow(/unknown variable "clock"/);
  });

  it("names an unknown function and lists the ones that exist", () => {
    expect(() => evaluate("log2(8)")).toThrow(/unknown function "log2"/);
  });

  it("rejects a wrong argument count instead of silently ignoring extras", () => {
    expect(() => evaluate("sqrt(4, 2)")).toThrow(/takes 1 argument/);
  });

  it("refuses division by zero rather than returning Infinity", () => {
    expect(() => evaluate("5 / 0")).toThrow(/division by zero/);
  });

  it("rejects unbalanced parentheses and stray input", () => {
    expect(() => evaluate("(2 + 3")).toThrow(ExpressionError);
    expect(() => evaluate("2 + 3)")).toThrow(/trailing input/);
  });

  it("rejects characters that are not part of the grammar", () => {
    // The evaluator must never be a way to run authored content as code.
    expect(() => evaluate("process.exit(1)")).toThrow(ExpressionError);
    expect(() => evaluate("1; 2")).toThrow(/unexpected character/);
  });
});
