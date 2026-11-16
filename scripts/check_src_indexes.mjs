import Database from 'better-sqlite3';
const db = new Database('D:/OpenLyryc DB/Data dump/db.sqlite3', { readonly: true });
const idxs = db.prepare("SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index'").all();
console.log(idxs);
db.close();
