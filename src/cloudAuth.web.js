// Web: Firebase's default browser persistence.
import { initializeAuth, browserLocalPersistence, inMemoryPersistence } from 'firebase/auth';

export const makeAuth = (app) => {
  let ok = true;
  try { window.localStorage.setItem('hm:probe', '1'); window.localStorage.removeItem('hm:probe'); } catch (e) { ok = false; }
  return initializeAuth(app, { persistence: ok ? browserLocalPersistence : inMemoryPersistence });
};
