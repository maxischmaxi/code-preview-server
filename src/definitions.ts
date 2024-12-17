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

export type ConnectedClient = {
  id: string;
  cursorPosition: CursorPosition;
  cursorSelection: CursorSelection | null;
};

export type Session = {
  id: string;
  name: string;
};
