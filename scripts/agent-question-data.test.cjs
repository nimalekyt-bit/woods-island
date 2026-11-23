const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { agentQuestions } =
  require("./load-runtime-typescript.cjs").loadTypeScript(
    "runtime/agents/question-data.ts",
  );
test("Agent questions retain exact Unicode/comma labels and selection modes", () => {
  const value = [
    {
      question: "Что добавить?",
      header: "Выбор",
      multiSelect: true,
      options: [
        { label: "Музыка, текст", description: "Вместе" },
        { label: "Буфер" },
      ],
    },
  ];
  assert.deepEqual(agentQuestions(value), [
    {
      question: "Что добавить?",
      header: "Выбор",
      multiSelect: true,
      options: [
        { label: "Музыка, текст", description: "Вместе" },
        { label: "Буфер", description: "" },
      ],
    },
  ]);
});
test("Unsupported question shape fails to terminal fallback without partial choices", () => {
  const valid = {
    question: "Режим?",
    options: [{ label: "Быстро" }, { label: "Качественно" }],
  };
  for (const value of [
    null,
    {},
    [],
    [null],
    [valid, valid],
    [{ ...valid, options: [] }],
    [{ ...valid, multiSelect: "true" }],
    [{ ...valid, options: [{ label: "A" }, { label: "A" }] }],
    [{ ...valid, options: [{ label: 17 }] }],
    [{ ...valid, options: [{ label: "A", description: [] }] }],
    [{ ...valid, question: "x".repeat(4097) }],
    [{ ...valid, options: [{ label: "x".repeat(513) }] }],
    Array(5).fill(valid),
  ])
    assert.deepEqual(agentQuestions(value), []);
});
test("Prototype-like question keys remain ordinary visible data", () => {
  const normalized = agentQuestions([
    { question: "__proto__", options: [{ label: "constructor" }] },
  ]);
  assert.equal(normalized[0].question, "__proto__");
  assert.equal(normalized[0].options[0].label, "constructor");
});
