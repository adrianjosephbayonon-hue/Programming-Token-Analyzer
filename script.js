
"use strict";

// ==========================================
// 1. LEXICAL RULES
// ==========================================

const KEYWORDS = new Set([
  "let", "print", "if", "true", "false"
]);

const TWO_CHARACTER_OPERATORS = new Set([
  ">=", "<=", "==", "!=", "+=", "-="
]);

const ONE_CHARACTER_OPERATORS = new Set([
  "+", "-", "*", "/", "%", ">", "<", "="
]);

const COMPARATORS = new Set([
  "==", "!=", ">", "<", ">=", "<="
]);

const DELIMITERS = new Set([
  "(", ")", "{", "}", ";", ","
]);

// ==========================================
// 2. LEXICAL ANALYSIS
// ==========================================

function tokenize(source) {
  const tokens = [];
  const errors = [];
  const trace = [];

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
    if (currentChar() === "\n") {
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

    trace.push({
      input: lexeme,
      recognizedAs: type,
      result: "ACCEPTED"
    });
  }

  function addError(message, errorLine, errorColumn, input) {
    errors.push({
      phase: "Lexical",
      message,
      line: errorLine,
      column: errorColumn
    });

    trace.push({
      input,
      recognizedAs: "LEXICAL ERROR",
      result: "NOT ACCEPTED"
    });
  }

  while (index < source.length) {
    const char = currentChar();

    if (/\s/.test(char)) {
      advance();
      continue;
    }

    const tokenLine = line;
    const tokenColumn = column;

    // Single-line comments.
    if (char === "/" && nextChar() === "/") {
      let comment = "";

      while (index < source.length && currentChar() !== "\n") {
        comment += currentChar();
        advance();
      }

      trace.push({
        input: comment,
        recognizedAs: "COMMENT",
        result: "ACCEPTED"
      });

      continue;
    }

    // Multiline comments.
    if (char === "/" && nextChar() === "*") {
      let comment = "/*";
      advance();
      advance();

      let closed = false;

      while (index < source.length) {
        if (currentChar() === "*" && nextChar() === "/") {
          comment += "*/";
          advance();
          advance();
          closed = true;
          break;
        }

        comment += currentChar();
        advance();
      }

      if (closed) {
        trace.push({
          input: comment,
          recognizedAs: "COMMENT",
          result: "ACCEPTED"
        });
      } else {
        addError(
          "Unterminated multiline comment.",
          tokenLine,
          tokenColumn,
          comment
        );
      }

      continue;
    }

    // Double-quoted strings.
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
          lexeme += '"';
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
        addError(
          "Unterminated string literal.",
          tokenLine,
          tokenColumn,
          lexeme
        );
      }

      continue;
    }

    // Keywords and identifiers.
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

    // Numbers.
    if (/[0-9]/.test(char)) {
      let lexeme = "";

      while (
        index < source.length &&
        /[0-9]/.test(currentChar())
      ) {
        lexeme += currentChar();
        advance();
      }

      if (
        currentChar() === "." &&
        /[0-9]/.test(nextChar() || "")
      ) {
        lexeme += ".";
        advance();

        while (
          index < source.length &&
          /[0-9]/.test(currentChar())
        ) {
          lexeme += currentChar();
          advance();
        }
      }

      addToken(lexeme, "NUMBER", tokenLine, tokenColumn);
      continue;
    }

    // Two-character operators must be checked first.
    const twoChars = char + (nextChar() || "");

    if (TWO_CHARACTER_OPERATORS.has(twoChars)) {
      addToken(twoChars, "OPERATOR", tokenLine, tokenColumn);
      advance();
      advance();
      continue;
    }

    if (ONE_CHARACTER_OPERATORS.has(char)) {
      addToken(char, "OPERATOR", tokenLine, tokenColumn);
      advance();
      continue;
    }

    if (DELIMITERS.has(char)) {
      addToken(char, "DELIMITER", tokenLine, tokenColumn);
      advance();
      continue;
    }

    addError(
      `Unsupported character '${char}'.`,
      tokenLine,
      tokenColumn,
      char
    );

    advance();
  }

  return { tokens, errors, trace };
}

// ==========================================
// 3. SYNTAX ANALYSIS AND AST CONSTRUCTION
// ==========================================

class SyntaxParser {
  constructor(tokens) {
    this.tokens = tokens;
    this.position = 0;
  }

  current() {
    return this.tokens[this.position] || null;
  }

  check(lexeme) {
    return this.current()?.lexeme === lexeme;
  }

  match(lexeme) {
    if (this.check(lexeme)) {
      this.position++;
      return true;
    }

    return false;
  }

  matchType(type) {
    if (this.current()?.type === type) {
      this.position++;
      return true;
    }

    return false;
  }

  fail(message) {
    const token = this.current();
    const previous = this.tokens[this.position - 1];

    const error = new Error(message);

    error.line = token?.line ?? previous?.line ?? 1;
    error.column = token?.column ??
      (previous
        ? previous.column + previous.lexeme.length
        : 1);

    throw error;
  }

  expect(lexeme) {
    if (!this.match(lexeme)) {
      this.fail(
        `Expected '${lexeme}', but found ${this.current()?.lexeme ?? "end of input"}.`
      );
    }
  }

  expectIdentifier() {
    const token = this.current();

    if (!token || token.type !== "IDENTIFIER") {
      this.fail(
        `Expected an identifier, but found ${token?.lexeme ?? "end of input"}.`
      );
    }

    this.position++;
    return token;
  }

  parseProgram() {
    const statements = [];

    if (this.tokens.length === 0) {
      this.fail("The program must contain at least one statement.");
    }

    while (this.current() !== null) {
      statements.push(this.parseStatement());
    }

    return {
      kind: "Program",
      statements
    };
  }

  parseStatement() {
    if (this.check("let")) {
      return this.parseDeclaration();
    }

    if (this.check("print")) {
      return this.parsePrint();
    }

    if (this.check("if")) {
      return this.parseIf();
    }

    if (this.current()?.type === "IDENTIFIER") {
      return this.parseAssignment();
    }

    this.fail(
      `Expected a declaration, assignment, print, or if statement; found ${this.current()?.lexeme ?? "end of input"}.`
    );
  }

  // Declaration -> let IDENTIFIER = Expression ;
  parseDeclaration() {
    const keyword = this.current();
    this.expect("let");

    const name = this.expectIdentifier();

    this.expect("=");

    const initializer = this.parseExpression();

    this.expect(";");

    return {
      kind: "Declaration",
      name: name.lexeme,
      nameToken: name,
      initializer,
      token: keyword
    };
  }

  // Assignment -> IDENTIFIER = Expression ;
  parseAssignment() {
    const name = this.expectIdentifier();

    this.expect("=");

    const value = this.parseExpression();

    this.expect(";");

    return {
      kind: "Assignment",
      name: name.lexeme,
      nameToken: name,
      value,
      token: name
    };
  }

  // Print -> print ( Expression ) ;
  parsePrint() {
    const keyword = this.current();
    this.expect("print");
    this.expect("(");

    const expression = this.parseExpression();

    this.expect(")");
    this.expect(";");

    return {
      kind: "Print",
      expression,
      token: keyword
    };
  }

  // If -> if ( Condition ) Block
  parseIf() {
    const keyword = this.current();

    this.expect("if");
    this.expect("(");

    const condition = this.parseCondition();

    this.expect(")");
    const body = this.parseBlock();

    return {
      kind: "If",
      condition,
      body,
      token: keyword
    };
  }

  // Block -> { Statement* }
  parseBlock() {
    this.expect("{");

    const statements = [];

    while (
      this.current() !== null &&
      !this.check("}")
    ) {
      statements.push(this.parseStatement());
    }

    this.expect("}");

    return {
      kind: "Block",
      statements
    };
  }

  // Condition -> Expression Comparator Expression
  parseCondition() {
    const left = this.parseExpression();
    const operator = this.current();

    if (
      !operator ||
      operator.type !== "OPERATOR" ||
      !COMPARATORS.has(operator.lexeme)
    ) {
      this.fail(
        "Expected a comparison operator such as >=, ==, or <."
      );
    }

    this.position++;

    const right = this.parseExpression();

    return {
      kind: "Comparison",
      operator: operator.lexeme,
      left,
      right,
      token: operator
    };
  }

  // Expression -> Term ( (+ | -) Term )*
  parseExpression() {
    let expression = this.parseTerm();

    while (this.check("+") || this.check("-")) {
      const operator = this.current();
      this.position++;

      const right = this.parseTerm();

      expression = {
        kind: "BinaryExpression",
        operator: operator.lexeme,
        left: expression,
        right,
        token: operator
      };
    }

    return expression;
  }

  // Term -> Factor ( (* | / | %) Factor )*
  parseTerm() {
    let expression = this.parseFactor();

    while (
      this.check("*") ||
      this.check("/") ||
      this.check("%")
    ) {
      const operator = this.current();
      this.position++;

      const right = this.parseFactor();

      expression = {
        kind: "BinaryExpression",
        operator: operator.lexeme,
        left: expression,
        right,
        token: operator
      };
    }

    return expression;
  }

  // Factor -> NUMBER | IDENTIFIER | STRING
  //         | true | false | ( Expression )
  parseFactor() {
    const token = this.current();

    if (!token) {
      this.fail("Expected a value, but reached the end of input.");
    }

    if (token.type === "NUMBER") {
      this.position++;

      return {
        kind: "NumberLiteral",
        value: Number(token.lexeme),
        token
      };
    }

    if (token.type === "STRING") {
      this.position++;

      return {
        kind: "StringLiteral",
        value: token.lexeme.slice(1, -1),
        token
      };
    }

    if (token.type === "IDENTIFIER") {
      this.position++;

      return {
        kind: "Identifier",
        name: token.lexeme,
        token
      };
    }

    if (token.lexeme === "true" || token.lexeme === "false") {
      this.position++;

      return {
        kind: "BooleanLiteral",
        value: token.lexeme === "true",
        token
      };
    }

    if (this.match("(")) {
      const expression = this.parseExpression();
      this.expect(")");
      return expression;
    }

    this.fail(`Expected a value, but found '${token.lexeme}'.`);
  }
}

// ==========================================
// 4. SEMANTIC ANALYSIS
// ==========================================

class SemanticAnalyzer {
  constructor() {
    // The first scope is the global scope.
    this.scopes = [new Map()];
    this.errors = [];
    this.trace = [];
  }

  currentScope() {
    return this.scopes[this.scopes.length - 1];
  }

  enterScope() {
    this.scopes.push(new Map());
  }

  leaveScope() {
    this.scopes.pop();
  }

  findVariable(name) {
    // Search from the innermost scope outward.
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      if (this.scopes[i].has(name)) {
        return this.scopes[i].get(name);
      }
    }

    return null;
  }

  addError(message, token) {
    this.errors.push({
      phase: "Semantic",
      message,
      line: token?.line ?? 1,
      column: token?.column ?? 1
    });
  }

  analyze(program) {
    this.checkStatements(program.statements);
    return {
      errors: this.errors,
      trace: this.trace
    };
  }

  checkStatements(statements) {
    for (const statement of statements) {
      this.checkStatement(statement);
    }
  }

  checkStatement(statement) {
    switch (statement.kind) {
      case "Declaration": {
        const scope = this.currentScope();

        if (scope.has(statement.name)) {
          this.addError(
            `Variable '${statement.name}' is already declared in this scope.`,
            statement.nameToken
          );
          return;
        }

        // Check the initializer before declaring the variable.
        this.checkExpression(statement.initializer);

        scope.set(statement.name, {
          name: statement.name,
          token: statement.nameToken
        });

        this.trace.push({
          input: statement.name,
          recognizedAs: "VARIABLE DECLARATION",
          result: "ACCEPTED"
        });

        return;
      }

      case "Assignment": {
        const variable = this.findVariable(statement.name);

        if (!variable) {
          this.addError(
            `Cannot assign to '${statement.name}' because it has not been declared.`,
            statement.nameToken
          );
        }

        this.checkExpression(statement.value);

        if (variable) {
          this.trace.push({
            input: statement.name,
            recognizedAs: "VARIABLE ASSIGNMENT",
            result: "ACCEPTED"
          });
        }

        return;
      }

      case "Print":
        this.checkExpression(statement.expression);
        return;

      case "If":
        this.checkExpression(statement.condition);

        // Variables declared inside this block are local to it.
        this.enterScope();
        this.checkStatements(statement.body.statements);
        this.leaveScope();
        return;

      default:
        this.addError(
          `Unknown statement type '${statement.kind}'.`,
          statement.token
        );
    }
  }

  checkExpression(expression) {
    if (!expression) {
      return;
    }

    switch (expression.kind) {
      case "Identifier": {
        const variable = this.findVariable(expression.name);

        if (!variable) {
          this.addError(
            `Variable '${expression.name}' is used before it is declared.`,
            expression.token
          );
        }

        return;
      }

      case "BinaryExpression":
        this.checkExpression(expression.left);
        this.checkExpression(expression.right);
        return;

      case "Comparison":
        this.checkExpression(expression.left);
        this.checkExpression(expression.right);
        return;

      case "NumberLiteral":
      case "StringLiteral":
      case "BooleanLiteral":
        return;

      default:
        this.addError(
          `Unknown expression type '${expression.kind}'.`,
          expression.token
        );
    }
  }
}

// ==========================================
// 5. DISPLAY HELPERS
// ==========================================

function createCell(value) {
  const cell = document.createElement("td");
  cell.textContent = String(value);
  return cell;
}

function displayTokens(tokens) {
  const body = document.getElementById("token-table-body");
  body.replaceChildren();

  if (tokens.length === 0) {
    const row = document.createElement("tr");
    const cell = createCell("No tokens recognized.");
    cell.colSpan = 5;
    row.appendChild(cell);
    body.appendChild(row);
    return;
  }

  tokens.forEach((token, index) => {
    const row = document.createElement("tr");

    row.appendChild(createCell(index + 1));
    row.appendChild(createCell(token.lexeme));
    row.appendChild(createCell(token.type));
    row.appendChild(createCell(token.line));
    row.appendChild(createCell(token.column));

    body.appendChild(row);
  });
}

function displayTrace(trace) {
  const body = document.getElementById("trace-table-body");
  body.replaceChildren();

  if (trace.length === 0) {
    const row = document.createElement("tr");
    const cell = createCell("No scanning steps available.");
    cell.colSpan = 4;
    row.appendChild(cell);
    body.appendChild(row);
    return;
  }

  trace.forEach((item, index) => {
    const row = document.createElement("tr");

    row.appendChild(createCell(index + 1));
    row.appendChild(createCell(item.input));
    row.appendChild(createCell(item.recognizedAs));
    row.appendChild(createCell(item.result));

    body.appendChild(row);
  });
}

function displayErrors(errors) {
  const list = document.getElementById("error-list");
  list.replaceChildren();

  if (errors.length === 0) {
    const item = document.createElement("li");
    item.textContent = "No lexical, syntax, or semantic errors found.";
    list.appendChild(item);
    return;
  }

  errors.forEach((error) => {
    const item = document.createElement("li");
    item.className = "error-item";

    item.textContent =
      `${error.phase} error — Line ${error.line}, column ${error.column}: ${error.message}`;

    list.appendChild(item);
  });
}

// ==========================================
// 6. RUN ALL THREE ANALYSIS STAGES
// ==========================================

function analyzeInput(event) {
  event.preventDefault();

  const source = document.getElementById("source-code").value;

  // Stage 1: Lexical analysis.
  const lexical = tokenize(source);
  const errors = [...lexical.errors];
  const trace = [...lexical.trace];

  let syntaxPassed = false;
  let semanticPassed = false;

  // Stage 2: Syntax analysis and AST construction.
  if (lexical.errors.length === 0) {
    try {
      const parser = new SyntaxParser(lexical.tokens);
      const ast = parser.parseProgram();

      syntaxPassed = true;

      trace.push({
        input: "Source code",
        recognizedAs: "SYNTAX ANALYSIS",
        result: "ACCEPTED"
      });

      // Stage 3: Semantic analysis.
      const semantic = new SemanticAnalyzer();
      const semanticResult = semantic.analyze(ast);

      errors.push(...semanticResult.errors);
      trace.push(...semanticResult.trace);

      semanticPassed = semanticResult.errors.length === 0;

      trace.push({
        input: "Source code",
        recognizedAs: "SEMANTIC ANALYSIS",
        result: semanticPassed ? "ACCEPTED" : "NOT ACCEPTED"
      });
    } catch (error) {
      errors.push({
        phase: "Syntax",
        message: error.message,
        line: error.line ?? 1,
        column: error.column ?? 1
      });

      trace.push({
        input: "Source code",
        recognizedAs: "SYNTAX ERROR",
        result: "NOT ACCEPTED"
      });
    }
  } else {
    trace.push({
      input: "Source code",
      recognizedAs: "SYNTAX AND SEMANTIC ANALYSIS SKIPPED",
      result: "NOT ACCEPTED"
    });
  }

  const accepted =
    lexical.errors.length === 0 &&
    syntaxPassed &&
    semanticPassed &&
    lexical.tokens.length > 0;

  const status = accepted ? "ACCEPTED" : "NOT ACCEPTED";

  const resultPanel = document.getElementById("analysis-result");

  resultPanel.classList.remove("accepted", "rejected");
  resultPanel.classList.add(accepted ? "accepted" : "rejected");
  resultPanel.replaceChildren();

  const heading = document.createElement("h3");
  heading.textContent = "Analysis Result";

  const message = document.createElement("p");
  message.textContent = status;

  const details = document.createElement("p");

  if (lexical.errors.length > 0) {
    details.textContent =
      `Lexical analysis failed with ${lexical.errors.length} lexical error(s).`;
  } else if (!syntaxPassed) {
    details.textContent =
      "Lexical analysis passed, but syntax analysis failed.";
  } else if (!semanticPassed) {
    details.textContent =
      "Lexical and syntax analysis passed, but semantic analysis found errors.";
  } else {
    details.textContent =
      `All three stages passed. Recognized ${lexical.tokens.length} token(s).`;
  }

  resultPanel.append(heading, message, details);

  document.getElementById("token-count").textContent =
    lexical.tokens.length;

  document.getElementById("error-count").textContent =
    errors.length;

  displayTokens(lexical.tokens);
  displayTrace(trace);
  displayErrors(errors);
}

// ==========================================
// 7. CLEAR RESULTS
// ==========================================

function clearAnalyzer() {
  document.getElementById("source-code").value = "";

  const resultPanel = document.getElementById("analysis-result");

  resultPanel.classList.remove("accepted", "rejected");
  resultPanel.replaceChildren();

  const heading = document.createElement("h3");
  heading.textContent = "Analysis Result";

  const message = document.createElement("p");
  message.textContent = "Enter source code and click Analyze Input.";

  resultPanel.append(heading, message);

  document.getElementById("token-count").textContent = "0";
  document.getElementById("error-count").textContent = "0";

  displayTokens([]);
  displayTrace([]);
  displayErrors([]);
}

// ==========================================
// 8. CONNECT THE FORM AND BUTTONS
// ==========================================

document
  .getElementById("analyzer-form")
  .addEventListener("submit", analyzeInput);

document
  .getElementById("clear-button")
  .addEventListener("click", clearAnalyzer);
