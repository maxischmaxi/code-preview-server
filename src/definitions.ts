export type CursorPosition = {
  lineNumber: number;
  column: number;
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
};

export type Session = {
  id: string;
  code: string;
  language: string;
  createdAt: string;
  lintingEnabled: boolean;
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
