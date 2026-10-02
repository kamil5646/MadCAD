const NUMBER = /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i;
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*/;
const PRECEDENCE = { '+': 1, '-': 1, '*': 2, '/': 2, 'u+': 3, 'u-': 3 };

function tokenize(source) {
  const tokens = [];
  let rest = String(source ?? '').trim();

  while (rest) {
    const whitespace = rest.match(/^\s+/);
    if (whitespace) {
      rest = rest.slice(whitespace[0].length);
      continue;
    }

    const number = rest.match(NUMBER);
    if (number) {
      tokens.push({ type: 'number', value: Number(number[0]) });
      rest = rest.slice(number[0].length);
      continue;
    }

    const identifier = rest.match(IDENTIFIER);
    if (identifier) {
      tokens.push({ type: 'identifier', value: identifier[0] });
      rest = rest.slice(identifier[0].length);
      continue;
    }

    const symbol = rest[0];
    if ('+-*/()'.includes(symbol)) {
      tokens.push({ type: symbol, value: symbol });
      rest = rest.slice(1);
      continue;
    }

    throw new Error(`Niedozwolony znak: ${symbol}`);
  }
  return tokens;
}

function toRpn(tokens) {
  const output = [];
  const operators = [];
  let previous = null;

  for (const token of tokens) {
    if (token.type === 'number' || token.type === 'identifier') {
      output.push(token);
    } else if (token.type in PRECEDENCE) {
      const unary = (token.type === '-' || token.type === '+') && (!previous || previous.type in PRECEDENCE || previous.type === '(');
      const operator = unary ? { type: `u${token.type}` } : token;
      while (
        operators.length
        && operators.at(-1).type in PRECEDENCE
        && (PRECEDENCE[operators.at(-1).type] > PRECEDENCE[operator.type]
          || (!unary && PRECEDENCE[operators.at(-1).type] === PRECEDENCE[operator.type]))
      ) {
        output.push(operators.pop());
      }
      operators.push(operator);
    } else if (token.type === '(') {
      operators.push(token);
    } else if (token.type === ')') {
      while (operators.length && operators.at(-1).type !== '(') output.push(operators.pop());
      if (!operators.length) throw new Error('Brakujący nawias otwierający.');
      operators.pop();
    }
    previous = token;
  }

  while (operators.length) {
    const operator = operators.pop();
    if (operator.type === '(') throw new Error('Brakujący nawias zamykający.');
    output.push(operator);
  }
  return output;
}

export function evaluateExpression(expression, parameters = {}) {
  if (typeof expression === 'number') return expression;
  const source = String(expression ?? '').trim();
  if (!source) throw new Error('Wartość nie może być pusta.');
  const stack = [];

  for (const token of toRpn(tokenize(source))) {
    if (token.type === 'number') stack.push(token.value);
    else if (token.type === 'identifier') {
      if (!(token.value in parameters)) throw new Error(`Nieznany parametr: ${token.value}`);
      stack.push(Number(parameters[token.value]));
    } else {
      if (token.type === 'u-' || token.type === 'u+') {
        if (!stack.length) throw new Error('Niepełne wyrażenie.');
        stack.push((token.type === 'u-' ? -1 : 1) * stack.pop());
        continue;
      }
      if (stack.length < 2) throw new Error('Niepełne wyrażenie.');
      const right = stack.pop();
      const left = stack.pop();
      if (token.type === '+') stack.push(left + right);
      if (token.type === '-') stack.push(left - right);
      if (token.type === '*') stack.push(left * right);
      if (token.type === '/') {
        if (Math.abs(right) < Number.EPSILON) throw new Error('Dzielenie przez zero.');
        stack.push(left / right);
      }
    }
  }

  if (stack.length !== 1 || !Number.isFinite(stack[0])) throw new Error('Nieprawidłowe wyrażenie.');
  return stack[0];
}

export function listExpressionIdentifiers(expression) {
  const source = String(expression ?? '').trim();
  if (!source) return [];
  return [...new Set(tokenize(source)
    .filter((token) => token.type === 'identifier')
    .map((token) => token.value))];
}

export function resolveParameters(parameters) {
  const resolved = {};
  const pending = new Map(parameters.map((parameter) => [parameter.name, parameter]));
  const errors = {};

  for (let pass = 0; pass <= parameters.length && pending.size; pass += 1) {
    let progress = false;
    for (const [name, parameter] of [...pending]) {
      try {
        resolved[name] = evaluateExpression(parameter.expression, resolved);
        pending.delete(name);
        delete errors[name];
        progress = true;
      } catch (error) {
        errors[name] = error.message;
      }
    }
    if (!progress) break;
  }

  for (const name of pending.keys()) {
    errors[name] = errors[name] || 'Zależność cykliczna lub brakujący parametr.';
  }
  return { values: resolved, errors, valid: pending.size === 0 };
}
