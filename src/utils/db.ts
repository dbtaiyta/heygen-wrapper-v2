import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';
import { Database } from '../types/index.js';

const DATA_DIR = process.env.DATA_DIR || './data';
const dbFile = path.join(DATA_DIR, 'db.json');

const defaultData: Database = {
  jobs: [],
  api_keys: [],
  settings: {}
};

const adapter = new JSONFile<Database>(dbFile);
const db = new Low<Database>(adapter, defaultData);

export async function initDatabase() {
  await db.read();
  db.data ||= defaultData;
  await db.write();
}

export default db;
