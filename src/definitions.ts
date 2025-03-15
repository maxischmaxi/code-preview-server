export enum SocketEvent {
  JOIN_SESSION = "join-session",
  LEAVE_SESSION = "leave-session",
  TEXT_INPUT = "text-input",
  LANGUAGE_CHANGE = "language-change",
  SET_ADMIN = "set-admin",
  SET_SOLUTION = "set-solution",
  REMOVE_ADMIN = "remove-admin",
  SOLUTION_PRESENTED = "solution-presented",
  JOIN = "join",
  SEND_CURSOR_POSITION = "send-cursor-position",
  SET_NICKNAME = "set-nickname",
  SET_LINTING = "set-linting",
  SET_SELECTION = "set-selection",
  REMOVE_CURSOR = "remove-cursor",
}

export type CursorPosition = {
  sessionId: string;
  userId: string;
  cursor: {
    column: number;
    lineNumber: number;
  };
};

export type Template = {
  id: string;
  title: string;
  code: string;
  language: string;
  solution: string;
};

export type ConnectedClient = {
  socketId: string;
  sessionId: string | null;
  userId: string;
  nickname: string;
};

export type Session = {
  solutionPresented: boolean;
  id: string;
  code: string;
  language: string;
  createdAt: string;
  createdBy: string;
  solution: string;
  admins: string[];
  linting: boolean;
};

export type CursorSelection = {
  sessionId: string;
  userId: string;
  startColumn: number;
  startLineNumber: number;
  endColumn: number;
  endLineNumber: number;
};
