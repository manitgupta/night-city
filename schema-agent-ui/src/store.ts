import { create } from 'zustand';

export interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  thoughts?: string; // Chain of thought logs
  isApplying?: boolean; // If agent is suggesting a fix
  isReport?: boolean; // If this message is a conversion report
  isHelpful?: boolean; // If this message is a helpful tip (pulsates)
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

  // Source Connection State
  sourceSessionId: string | null;
  setSourceSessionId: (id: string | null) => void;

  spannerSessionId: string | null;
  setSpannerSessionId: (id: string | null) => void;

  setSourceCode: (code: string) => void;
  setOutputCode: (code: string) => void;
  setSelection: (selection: AppState['selection']) => void;
  addMessage: (message: Message) => void;
  setAgentTyping: (typing: boolean) => void;

  // Review State (Global)
  reviewState: {
    isActive: boolean;
    originalCode: string;
    modifiedCode: string;
    explanation: string;
  };
  // Chat Context
  chatContext: 'schema' | 'query' | null;
  setChatContext: (context: 'schema' | 'query') => void;
  resetMessages: (initialMessage?: Message) => void;
  setReviewState: (state: AppState['reviewState']) => void;
}

export const useStore = create<AppState>((set) => ({
  sourceCode: "",
  outputCode: "",
  selection: null,
  messages: [], // Initialized by components based on context

  isAgentTyping: false,
  sourceSessionId: null,

  setSourceSessionId: (id) => set({ sourceSessionId: id }),

  spannerSessionId: null,
  setSpannerSessionId: (id: string | null) => set({ spannerSessionId: id }),

  setSourceCode: (code) => set({ sourceCode: code }),
  setOutputCode: (code) => set({ outputCode: code }),
  setSelection: (selection) => set({ selection }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  setAgentTyping: (typing: boolean) => set({ isAgentTyping: typing }),

  reviewState: {
    isActive: false,
    originalCode: "",
    modifiedCode: "",
    explanation: ""
  },
  chatContext: null,
  setChatContext: (context) => set({ chatContext: context }),
  resetMessages: (initialMessage) => set({ messages: initialMessage ? [initialMessage] : [] }),

  setReviewState: (reviewState) => set({ reviewState }),
}));
