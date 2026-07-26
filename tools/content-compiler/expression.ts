// A deliberately tiny arithmetic evaluator, used by the question-template
// expansion in compile.ts (D-030).
// Depends on: nothing. Depended on by: compile.ts, expression.test.ts.
//
// WHY THIS EXISTS AT ALL. A template says "DRAM latency is one of 80/100/120/150
// ns, the clock is one of 2.4/3.0/3.6 GHz" and needs the answer for each of the
// twelve combinations. If the author writes those twelve answers by hand, the
// bank grows by copying arithmetic — and a single slip ships a question whose
// "correct" answer is wrong, with a confident explanation attached. Writing the
// formula ONCE and having the build compute every case removes that whole class
// of error: the numbers in the finished question are calculated, not asserted.
//
// WHY NOT A LIBRARY, AND WHY NOT eval(). A dependency needs justifying
// (CLAUDE.md) and every expression parser on npm is far larger than the handful
// of operators this needs. `eval` would run authored content as code at build
// time, which turns a typo in a YAML file into arbitrary execution. This is
// ~150 lines of recursive descent over a fixed grammar: numbers, the four
// operators, `^`, parentheses, named variables, and a closed list of functions.
// It cannot call anything, reach any global, or produce anything but a number.

const FUNCTIONS: Record<string, { arity: number[]; apply: (args: number[]) => number }> =
  {
    round: {
      arity: [1, 2],
      apply: ([x, places]) => {
        const factor = 10 ** (places ?? 0);
        return Math.round(x! * factor) / factor;
      },
    },
    floor: { arity: [1], apply: ([x]) => Math.floor(x!) },
    ceil: { arity: [1], apply: ([x]) => Math.ceil(x!) },
    abs: { arity: [1], apply: ([x]) => Math.abs(x!) },
    sqrt: { arity: [1], apply: ([x]) => Math.sqrt(x!) },
    min: { arity: [2], apply: ([a, b]) => Math.min(a!, b!) },
    max: { arity: [2], apply: ([a, b]) => Math.max(a!, b!) },
  };

export class ExpressionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpressionError";
  }
}

type Token =
  | { kind: "number"; value: number }
  | { kind: "ident"; value: string }
  | { kind: "op"; value: string };

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const c = source[i]!;
    if (/\s/.test(c)) {
      i += 1;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      // Scientific notation is allowed (3e9 reads better than 3000000000 in a
      // formula about clock speed), so the exponent is consumed here too.
      const match = /^[0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?/.exec(source.slice(i));
      if (!match) throw new ExpressionError(`malformed number at position ${i}`);
      tokens.push({ kind: "number", value: Number(match[0]) });
      i += match[0].length;
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      const match = /^[a-zA-Z_][a-zA-Z0-9_]*/.exec(source.slice(i))!;
      tokens.push({ kind: "ident", value: match[0] });
      i += match[0].length;
      continue;
    }
    if ("+-*/^(),".includes(c)) {
      tokens.push({ kind: "op", value: c });
      i += 1;
      continue;
    }
    throw new ExpressionError(`unexpected character "${c}" at position ${i}`);
  }
  return tokens;
}

/**
 * Evaluate `source` with `vars` bound as named values.
 * Throws ExpressionError with a message naming the problem — an unknown
 * variable is a content bug the build must stop on, never a silent NaN.
 */
export function evaluateExpression(
  source: string,
  vars: Readonly<Record<string, number>>,
): number {
  const tokens = tokenize(source);
  let pos = 0;

  const peek = (): Token | undefined => tokens[pos];
  const eat = (value: string): boolean => {
    const t = peek();
    if (t?.kind === "op" && t.value === value) {
      pos += 1;
      return true;
    }
    return false;
  };
  const expect = (value: string): void => {
    if (!eat(value)) throw new ExpressionError(`expected "${value}" in "${source}"`);
  };

  function parseExpression(): number {
    let left = parseTerm();
    for (;;) {
      if (eat("+")) left += parseTerm();
      else if (eat("-")) left -= parseTerm();
      else return left;
    }
  }

  function parseTerm(): number {
    let left = parsePower();
    for (;;) {
      if (eat("*")) left *= parsePower();
      else if (eat("/")) {
        const right = parsePower();
        if (right === 0) throw new ExpressionError(`division by zero in "${source}"`);
        left /= right;
      } else return left;
    }
  }

  function parsePower(): number {
    const base = parseUnary();
    // Right-associative, so 2^3^2 is 2^9 as in ordinary maths notation.
    return eat("^") ? base ** parsePower() : base;
  }

  function parseUnary(): number {
    if (eat("-")) return -parseUnary();
    if (eat("+")) return parseUnary();
    return parsePrimary();
  }

  function parsePrimary(): number {
    const token = peek();
    if (token === undefined) throw new ExpressionError(`unexpected end of "${source}"`);

    if (token.kind === "number") {
      pos += 1;
      return token.value;
    }
    if (token.kind === "ident") {
      pos += 1;
      const fn = FUNCTIONS[token.value];
      if (eat("(")) {
        if (fn === undefined) {
          throw new ExpressionError(
            `unknown function "${token.value}" in "${source}" ` +
              `(available: ${Object.keys(FUNCTIONS).join(", ")})`,
          );
        }
        const args: number[] = [];
        if (!eat(")")) {
          do {
            args.push(parseExpression());
          } while (eat(","));
          expect(")");
        }
        if (!fn.arity.includes(args.length)) {
          throw new ExpressionError(
            `${token.value}() takes ${fn.arity.join(" or ")} argument(s), ` +
              `got ${args.length} in "${source}"`,
          );
        }
        return fn.apply(args);
      }
      if (!(token.value in vars)) {
        const known = Object.keys(vars).sort().join(", ");
        throw new ExpressionError(
          `unknown variable "${token.value}" in "${source}" (defined: ${known || "none"})`,
        );
      }
      return vars[token.value]!;
    }
    if (eat("(")) {
      const value = parseExpression();
      expect(")");
      return value;
    }
    throw new ExpressionError(`unexpected "${token.value}" in "${source}"`);
  }

  const result = parseExpression();
  if (pos !== tokens.length) {
    throw new ExpressionError(
      `trailing input after a complete expression in "${source}"`,
    );
  }
  if (!Number.isFinite(result)) {
    throw new ExpressionError(
      `"${source}" evaluated to ${result}, which is not a number`,
    );
  }
  return result;
}
