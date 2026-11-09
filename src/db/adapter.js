// Native (Android / iOS): real SQLite database file "homemeal.db".
import * as SQLite from 'expo-sqlite';
import { createSqlStore } from './sqlstore';

export async function openStore() {
  const db = await SQLite.openDatabaseAsync('homemeal.db');
  return createSqlStore(db);
}
