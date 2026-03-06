export interface QuizQuestion {
  question: string;
  options: string[];
  correct: number; // 0-indexed
  hint: string;
}

export interface ProblemSolution {
  explanation: string;
  pseudocode: string;
  java: string;
  javascript?: string;
}

export interface Problem {
  id: number;
  leetcode_id: number;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  companies: string[];
  topics: string[];
  statement: string;
  quiz: QuizQuestion[];
  solution: ProblemSolution;
}

export interface UserSettings {
  difficulties?: ("easy" | "medium" | "hard")[];
  companies?: string[];
  topics?: string[];
  exclude_solved?: boolean;
  language?: "java" | "javascript";
}

export interface UserSession {
  problem_id: number;
  quiz_index: number; // which quiz question user is on
}
