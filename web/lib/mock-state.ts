import mockDb from "../../mock_db.json";

export type MockState = typeof mockDb;

let cachedState: MockState;

export function readMockState(): MockState {
  if (!cachedState) {
    cachedState = structuredClone(mockDb);
  }
  return structuredClone(cachedState);
}

export function writeMockState(state: MockState): void {
  cachedState = structuredClone(state);
}

export function resetMockState(): void {
  cachedState = undefined as unknown as MockState;
}
