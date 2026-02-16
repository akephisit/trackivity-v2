import * as schema from './schema';

// Mock DB to prevent usage and guide migration to Backend API
export const db: any = new Proxy({}, {
    get: (_target, prop) => {
        throw new Error(`Database access prevented in updated frontend. Property '${String(prop)}' accessed. Please use backend API.`);
    }
});

export * from './schema';
