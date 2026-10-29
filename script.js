
"use strict";

// ============================================
// 1. IDENTIFIER DFA
// Rule: [A-Za-z_][A-Za-z0-9_]*
// ============================================

function isLetter(char) {
  return /^[A-Za-z_]$/.test(char);
}

function isLetterOrDigitOrUnderscore(char) {
  return /^[A-Za-z0-9_]$/.test(char);
}

function analyzeIdentifier(identifier) {
  if (identifier.length === 0) {
    return {
      accepted: false,
      message: "NOT ACCEPTED: Please enter an identifier."
    };
  }

  let state = "q0";

  for (const char of identifier) {
    if (state === "q0") {
      if (isLetter(char)) {
        state = "q1";
      } else {
        return {
          accepted: false,
          message: `NOT ACCEPTED: '${char}' is not valid as the first character.`
        };
      }
    } else if (state === "q1") {
      if (isLetterOrDigitOrUnderscore(char)) {
        state = "q1";
      } else {
        return {
          accepted: false,
          message: `NOT ACCEPTED: '${char}' is not allowed in an identifier.`
        };
      }
    }
  }

  return {
    accepted: state === "q1",
    message: `ACCEPTED: '${identifier}' is a valid identifier.`
  };
}

// ============================================
// 2. TOKEN DEFINITIONS
// ============================================

const KEYWORDS = new Set([
  "let",
  "if",
  "else",
  "while",
  "print",
  "true",
  "false"
]);

const TWO_CHARACTER_OPERATORS = [
  ">=",
  "<=",
  "==",
  "!=",
  "+=",
  "-="
];

const ONE_CHARACTER_OPERATORS = new Set([
  "+",
  "-",
  "*",
  "/",
  "%",
  ">",
  "<",
  "="
]);

const DELIMITERS = new Set([
  "(",
  ")",
  "{",
  "}",
  ";",
  ","
]);

// ============================================
// 3. TOKENIZER
// Scans source code from left to right.
// ============================================

function tokenize(source) {
  const tokens = [];
  const errors = [];

  let index = 0;
  let line = 1;
  let column = 1;

  function currentChar() {
    return source[index];
  }

  function nextChar() {
    return source[index + 1];
  }

  function advance() {
    if (source[index] === "\n") {
      line++;
      column = 1;
    } else {
      column++;
    }

    index++;
  }

  function addToken(lexeme, type, tokenLine, tokenColumn) {
    tokens.push({
      lexeme,
      type,
      line: tokenLine,
      column: tokenColumn
    });
  }

  while (index < source.length) {
    const char = currentChar();

    // Ignore whitespace.
    if (/\s/.test(char)) {
      advance();
      continue;
    }

    const tokenLine = line;
    const tokenColumn = column;

    // Single-line comments: // comment
    if (char === "/" && nextChar() === "/") {
      while (index < source.length && currentChar() !== "\n") {
        advance();
      }
      continue;
    }

    // Multiline comments: /* comment */
    if (char === "/" && nextChar() === "*") {
      advance();
      advance();

      let closed = false;

      while (index < source.length) {
        if (currentChar() === "*" && nextChar() === "/") {
          advance();
          advance();
          closed = true;
          break;
        }

        advance();
      }

      if (!closed) {
        errors.push({
          message: "Unterminated multiline comment.",
          line: tokenLine,
          column: tokenColumn
        });
      }

      continue;
    }

    // Strings enclosed in double quotes.
    if (char === '"') {
      let lexeme = '"';
      advance();

      let closed = false;

      while (index < source.length) {
        if (currentChar() === "\n") {
          break;
        }

        if (currentChar() === "\\") {
          lexeme += currentChar();
          advance();

          if (index < source.length && currentChar() !== "\n") {
            lexeme += currentChar();
            advance();
          }

          continue;
        }

        if (currentChar() === '"') {
          lexeme += currentChar();
          advance();
          closed = true;
          break;
        }

        lexeme += currentChar();
        advance();
      }

      if (closed) {
        addToken(lexeme, "STRING", tokenLine, tokenColumn);
      } else {
        errors.push({
          message: "Unterminated string literal.",
          line: tokenLine,
          column: tokenColumn
        });
      }

      continue;
    }

    // Identifiers and keywords.
    if (/[A-Za-z_]/.test(char)) {
      let lexeme = "";

      while (
        index < source.length &&
        /[A-Za-z0-9_]/.test(currentChar())
      ) {
        lexeme += currentChar();
        advance();
      }

      const type = KEYWORDS.has(lexeme)
        ? "KEYWORD"
        : "IDENTIFIER";

      addToken(lexeme, type, tokenLine, tokenColumn);
      continue;
    }

    // Numbers: integers and decimal numbers.
    if (/[0-9]/.test(char)) {
      let lexeme = "";

      while (index < source.length && /[0-9]/.test(currentChar())) {
        lexeme += currentChar();
        advance();
      }

      if (
        currentChar() === "." &&
        /[0-9]/.test(nextChar() || "")
      ) {
        lexeme += currentChar();
        advance();

        while (index < source.length && /[0-9]/.test(currentChar())) {
          lexeme += currentChar();
          advance();
        }
      }

      addToken(lexeme, "NUMBER", tokenLine, tokenColumn);
      continue;
    }

    // Prefer two-character operators over one-character operators.
    const twoChars = char + (nextChar() || "");

    if (TWO_CHARACTER_OPERATORS.includes(twoChars)) {
      addToken(twoChars, "OPERATOR", tokenLine, tokenColumn);
      advance();
      advance();
      continue;
    }

    // One-character operators.
    if (ONE_CHARACTER_OPERATORS.has(char)) {
      addToken(char, "OPERATOR", tokenLine, tokenColumn);
      advance();
      continue;
    }

    // Delimiters.
    if (DELIMITERS.has(char)) {
      addToken(char, "DELIMITER", tokenLine, tokenColumn);
      advance();
      continue;
    }

    // Any other character is a lexical error.
    errors.push({
      message: `Unsupported character '${char}'.`,
      line: tokenLine,
      column: tokenColumn
    });

    advance();
  }

  return { tokens, errors };
}

// ============================================
// 4. ACCEPTANCE RULE
// ============================================

function getAnalysisStatus(tokens, errors) {
  if (errors.length > 0) {
    return "NOT ACCEPTED";
  }

  if (tokens.length === 0) {
    return "NOT ACCEPTED";
  }

  return "ACCEPTED";
}

// ============================================
// 5. DISPLAY HELPERS
// ============================================

function createCell(text) {
  const cell = document.createElement("td");
  cell.textContent = text;
  return cell;
}

function displayTokens(tokens) {
  const tableBody = document.getElementById("token-table-body");
  tableBody.replaceChildren();

  if (tokens.length === 0) {
    const row = document.createElement("tr");
    const cell = createCell("No tokens recognized.");
    cell.colSpan = 4;
    row.appendChild(cell);
    tableBody.appendChild(row);
    return;
  }

  for (const token of tokens) {
    const row = document.createElement("tr");

    row.appendChild(createCell(token.lexeme));
    row.appendChild(createCell(token.type));
    row.appendChild(createCell(token.line));
    row.appendChild(createCell(token.column));

    tableBody.appendChild(row);
  }
}

function displayErrors(errors) {
  const errorList = document.getElementById("error-list");
  errorList.replaceChildren();

  if (errors.length === 0) {
    const item = document.createElement("li");
    item.textContent = "No lexical errors found.";
    errorList.appendChild(item);
    return;
  }

  for (const error of errors) {
    const item = document.createElement("li");
    item.className = "error-item";
    item.textContent =
      `Line ${error.line}, column ${error.column}: ${error.message}`;

    errorList.appendChild(item);
  }
}

// ============================================
// 6. TOKEN ANALYSIS BUTTON
// ============================================

function analyzeSourceCode() {
  const source = document.getElementById("source-code").value;
  const result = tokenize(source);
  const status = getAnalysisStatus(result.tokens, result.errors);

  const statusElement = document.getElementById("analysis-status");

  statusElement.textContent = status;
  statusElement.classList.remove("accepted", "rejected");
  statusElement.classList.add(
    status === "ACCEPTED" ? "accepted" : "rejected"
  );

  document.getElementById("token-count").textContent =
    result.tokens.length;

  document.getElementById("error-count").textContent =
    result.errors.length;

  displayTokens(result.tokens);
  displayErrors(result.errors);
}

// ============================================
// 7. CLEAR BUTTON
// ============================================

function clearAnalyzer() {
  document.getElementById("source-code").value = "";

  const statusElement = document.getElementById("analysis-status");
  statusElement.textContent =
    "Enter source code and select Analyze Tokens.";

  statusElement.classList.remove("accepted", "rejected");

  document.getElementById("token-count").textContent = "0";
  document.getElementById("error-count").textContent = "0";

  displayTokens([]);
  displayErrors([]);
}

// ============================================
// 8. CONNECT THE BUTTONS
// ============================================

document
  .getElementById("identifier-form")
  .addEventListener("submit", function (event) {
    event.preventDefault();

    const identifier =
      document.getElementById("identifier-input").value;

    const result = analyzeIdentifier(identifier);
    const resultElement =
      document.getElementById("identifier-result");

    resultElement.textContent = result.message;
    resultElement.classList.remove("accepted", "rejected");
    resultElement.classList.add(
      result.accepted ? "accepted" : "rejected"
    );
  });

document
  .getElementById("analyze-button")
  .addEventListener("click", analyzeSourceCode);

document
  .getElementById("clear-button")
  .addEventListener("click", clearAnalyzer);
