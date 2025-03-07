export enum SocketEvent {
  JOIN_SESSION = "join-session",
  LEAVE_SESSION = "leave-session",
  TEXT_INPUT = "text-input",
  LANGUAGE_CHANGE = "language-change",
  SET_ADMIN = "set-admin",
  SET_SOLUTION = "set-solution",
  REMOVE_ADMIN = "remove-admin",
  SOLITION_PRESENTED = "solution-presented",
  JOIN = "join",
  SEND_CURSOR_POSITION = "send-cursor-position",
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

export type File = {
  name: string;
  language: string;
  value: string;
};

export type Change = {
  range: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  };
  rangeLength: number;
  text: string;
  rangeOffset: number;
  forceMoveMarkers: boolean;
};

export type CursorSelection = {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  selectionStartLineNumber: number;
  selectionStartColumn: number;
  positionLineNumber: number;
  positionColumn: number;
};

export type User = {
  id: string;
};

export type ConnectedClient = {
  socketId: string;
  sessionId: string | null;
  userId: string;
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
};

export type OnTextInputData = {
  changes: Array<Change>;
  sessionId: string;
};

export type OnReplaceTextData = {
  text: string;
  sessionId: string;
};

export type ClientJoinedSessionMessage = {
  socketId: string;
  sessionId: string;
};

export type ClientLeftSessionMessage = {
  socketId: string;
  sessionId: string;
};
