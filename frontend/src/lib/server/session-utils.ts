export async function updateSessionLastAccessed(sessionId: string): Promise<void> {
	// No-op: Session management moved to backend
	return;
}

export async function createSessionWithRetry(...args: any[]): Promise<any> {
	// No-op
	return { sessionId: 'dummy', created: false };
}
