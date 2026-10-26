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

export function persistMockState(state: MockState): void {
  cachedState = structuredClone(state);
}

export function auditLogEntry(
  state: MockState,
  sellerId: string,
  action: string,
  targetType: string,
  targetId: string,
  before?: Record<string, unknown>,
  after?: Record<string, unknown>,
): void {
  const orgs = state.organizations || [];
  const orgId = orgs.length ? orgs[0].id : "";
  const entry: any = {
    id: crypto.randomUUID(),
    organization_id: orgId,
    seller_id: sellerId,
    user_id: "user-1",
    action,
    target_type: targetType,
    target_id: targetId,
    before,
    after,
    created_at: new Date().toISOString(),
  };
  (state.audit_logs || []).unshift(entry);
  if ((state.audit_logs as any[]).length > 500) {
    (state.audit_logs as any[]).length = 500;
  }
}

