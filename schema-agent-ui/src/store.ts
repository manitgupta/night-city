import { create } from 'zustand';

export interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  isApplying?: boolean; // If agent is suggesting a fix
  suggestedFix?: {
    description: string;
    newCode: string;
    target: 'source' | 'output';
  };
}

interface AppState {
  sourceCode: string;
  outputCode: string;
  selection: {
    code: string;
    startLine: number;
    endLine: number;
    source: 'source' | 'output';
  } | null;
  messages: Message[];
  isAgentTyping: boolean;

  setSourceCode: (code: string) => void;
  setOutputCode: (code: string) => void;
  setSelection: (selection: AppState['selection']) => void;
  addMessage: (message: Message) => void;
  setAgentTyping: (typing: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  sourceCode: `CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`,
  outputCode: `CREATE TABLE Users (
  Id STRING(36) NOT NULL,
  Username STRING(50) NOT NULL,
  CreatedAt TIMESTAMP NOT NULL OPTIONS (allow_commit_timestamp=true),
) PRIMARY KEY (Id);`,
  selection: null,
  messages: [
    {
      id: '1',
      role: 'agent',
      content: "Hello! I'm your Schema Agent. Highlight any code to ask specific questions, or just ask me to convert the whole schema."
    }
  ],
  isAgentTyping: false,

  setSourceCode: (code) => set({ sourceCode: code }),
  setOutputCode: (code) => set({ outputCode: code }),
  setSelection: (selection) => set({ selection }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  setAgentTyping: (typing) => set({ isAgentTyping: typing }),
}));
