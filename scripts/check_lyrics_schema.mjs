import Database from 'better-sqlite3';
const db = new Database('D:/OpenLyryc DB/Data dump/db.sqlite3', { readonly: true });
const schema = db.prepare("SELECT sql FROM sqlite_master WHERE name='lyrics'").get();
console.log(schema.sql);
db.close();
