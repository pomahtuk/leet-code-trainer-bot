export function generatorPrompt(
  leetcodeId: number,
  title: string,
  difficulty: string,
  statement: string,
  topics: string[],
  companies: string[],
): string {
  return `You are creating quiz content for a LeetCode training bot. Given the problem below, generate a YAML entry following the exact schema.

PROBLEM:
- LeetCode #${leetcodeId}: ${title}
- Difficulty: ${difficulty}
- Topics: ${topics.join(", ")}
- Companies: ${companies.join(", ")}
- Statement: ${statement}

REQUIREMENTS:
1. Create 2-3 quiz questions. The first should ask about the best algorithm/pattern. Others can cover time complexity, space complexity, or key edge cases.
2. Each question has exactly 4 options. One is correct (0-indexed). Wrong options must be plausible but clearly incorrect to someone who knows the topic.
3. Each question has a hint that guides toward the answer without giving it away.
4. The solution section has: a short explanation (2-3 sentences), pseudocode, and Java code.
5. Java code should be concise — the key method only, no class wrapper, no imports unless essential.
6. Keep everything concise. The entire YAML for one problem should be under 80 lines.

OUTPUT FORMAT — return ONLY valid YAML, no markdown fences, no extra text:

id: PLACEHOLDER
leetcode_id: ${leetcodeId}
title: "${title}"
difficulty: ${difficulty}
companies: [${companies.join(", ")}]
topics: [${topics.join(", ")}]
statement: >
  ${statement}
quiz:
  - question: "..."
    options:
      - "..."
      - "..."
      - "..."
      - "..."
    correct: 0
    hint: "..."
solution:
  explanation: >
    ...
  pseudocode: |
    ...
  java: |
    ...`;
}

export function judgePrompt(yamlContent: string): string {
  return `You are a senior engineer reviewing quiz content for a LeetCode training bot. Evaluate the YAML below for correctness and quality.

YAML TO REVIEW:
${yamlContent}

CHECK EACH OF THESE:
1. CORRECTNESS — Is the marked correct answer actually correct? Is the code correct and optimal?
2. DISTRACTORS — Are wrong options plausible but clearly wrong? Not trick questions, not obviously absurd.
3. HINTS — Do hints guide without giving away the answer?
4. CONSISTENCY — Does explanation match the code? Do complexity claims match the algorithm?
5. COMPLETENESS — Are all required fields present? At least 2 quiz questions?

RESPOND WITH EXACTLY ONE LINE:
- If everything is good: PASS
- If there are issues: FLAG: <brief comma-separated list of issues>

Do not include any other text.`;
}
