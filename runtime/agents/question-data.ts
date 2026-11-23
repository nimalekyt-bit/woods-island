import type { AgentQuestionData } from "../ipc/client";

export function agentQuestions(value: unknown): AgentQuestionData[] {
  if (!Array.isArray(value) || !value.length || value.length > 4) return [];
  const names = new Set<string>(),
    result: AgentQuestionData[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const question = item as Record<string, unknown>;
    if (
      typeof question.question !== "string" ||
      !question.question.trim() ||
      question.question.length > 4096 ||
      names.has(question.question)
    )
      return [];
    if (
      !Array.isArray(question.options) ||
      !question.options.length ||
      question.options.length > 8 ||
      (question.multiSelect !== undefined &&
        typeof question.multiSelect !== "boolean")
    )
      return [];
    const labels = new Set<string>(),
      options: AgentQuestionData["options"] = [];
    for (const item of question.options) {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const option = item as Record<string, unknown>;
      if (
        typeof option.label !== "string" ||
        !option.label.trim() ||
        option.label.length > 512 ||
        labels.has(option.label)
      )
        return [];
      if (
        option.description !== undefined &&
        (typeof option.description !== "string" ||
          option.description.length > 2048)
      )
        return [];
      labels.add(option.label);
      options.push({
        label: option.label,
        description:
          typeof option.description === "string" ? option.description : "",
      });
    }
    if (
      question.header !== undefined &&
      (typeof question.header !== "string" || question.header.length > 128)
    )
      return [];
    names.add(question.question);
    result.push({
      question: question.question,
      header: typeof question.header === "string" ? question.header : "",
      multiSelect: question.multiSelect === true,
      options,
    });
  }
  return result;
}
