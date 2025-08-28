import { writable, derived } from 'svelte/store';

// Placeholder SSE store - SSE functionality disabled in v2
interface SSEState {
	isConnected: boolean;
	notifications: any[];
	unreadCount: number;
}

const initialState: SSEState = {
	isConnected: false,
	notifications: [],
	unreadCount: 0
};

function createSSEStore() {
	const { subscribe, set, update } = writable<SSEState>(initialState);

	return {
		subscribe,
		set,
		update,

		connect: () => {
			// SSE disabled in v2 - placeholder
			console.log('[SSE] SSE functionality disabled in trackivity-v2');
		},

		disconnect: () => {
			// SSE disabled in v2 - placeholder
		}
	};
}

export const sseStore = createSSEStore();
export const sseService = sseStore;

// Derived stores
export const isConnected = derived(sseStore, ($sse) => $sse.isConnected);
export const notifications = derived(sseStore, ($sse) => $sse.notifications);
export const unreadCount = derived(sseStore, ($sse) => $sse.unreadCount);

export default sseStore;
