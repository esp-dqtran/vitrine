type Container =
  | { type: "object"; expectingKey: boolean }
  | { type: "array" };

function nextNonWhitespace(value: string, start: number): { char: string; index: number } | undefined {
  for (let index = start; index < value.length; index += 1) {
    if (!/\s/.test(value[index])) return { char: value[index], index };
  }
  return undefined;
}

function isValidArrayValueStart(char: string): boolean {
  return char === "\""
    || char === "{"
    || char === "["
    || char === "]"
    || char === "-"
    || /[0-9tfn]/.test(char);
}

function isClosingQuote(
  value: string,
  index: number,
  role: "key" | "value",
  container: Container | undefined,
): boolean {
  const next = nextNonWhitespace(value, index + 1);
  if (!next) return true;
  if (role === "key") return next.char === ":";
  if (next.char === "}" || next.char === "]") return true;
  if (next.char !== ",") return false;

  const afterComma = nextNonWhitespace(value, next.index + 1);
  if (!afterComma) return true;
  if (container?.type === "object") {
    return afterComma.char === "\"" || afterComma.char === "}";
  }
  if (container?.type === "array") return isValidArrayValueStart(afterComma.char);
  return true;
}

export function repairJsonStringQuotes(value: string): string {
  const output: string[] = [];
  const stack: Container[] = [];
  let inString = false;
  let escaped = false;
  let stringRole: "key" | "value" = "value";

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if (inString) {
      if (escaped) {
        output.push(char);
        escaped = false;
        continue;
      }
      if (char === "\\") {
        output.push(char);
        escaped = true;
        continue;
      }
      if (char === "\"") {
        const container = stack.at(-1);
        if (isClosingQuote(value, index, stringRole, container)) {
          output.push(char);
          inString = false;
          if (stringRole === "key" && container?.type === "object") {
            container.expectingKey = false;
          }
        } else {
          output.push("\\\"");
        }
        continue;
      }
      output.push(char);
      continue;
    }

    if (char === "{") {
      stack.push({ type: "object", expectingKey: true });
    } else if (char === "[") {
      stack.push({ type: "array" });
    } else if (char === "}" || char === "]") {
      stack.pop();
    } else if (char === ",") {
      const container = stack.at(-1);
      if (container?.type === "object") container.expectingKey = true;
    } else if (char === "\"") {
      const container = stack.at(-1);
      stringRole = container?.type === "object" && container.expectingKey ? "key" : "value";
      inString = true;
    }
    output.push(char);
  }

  return output.join("");
}
