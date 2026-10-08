import {DatabaseSync} from 'node:sqlite';
export class QuotaLedger {
 constructor(path,userLimit=5,projectLimit=50) {
  this.db=new DatabaseSync(path);this.userLimit=userLimit;this.projectLimit=projectLimit;
  this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS requests (user_id TEXT NOT NULL, request_id TEXT NOT NULL, day TEXT NOT NULL, PRIMARY KEY(user_id,request_id)); CREATE INDEX IF NOT EXISTS requests_day ON requests(day,user_id);');
 }
 reserve(user,id,day=new Date().toISOString().slice(0,10)) {
  this.db.exec('BEGIN IMMEDIATE');
  try {
   if(this.db.prepare('SELECT 1 FROM requests WHERE user_id=? AND request_id=?').get(user,id)){this.db.exec('ROLLBACK');return 'duplicate';}
   const total=this.db.prepare('SELECT count(*) AS n FROM requests WHERE day=?').get(day).n;
   const own=this.db.prepare('SELECT count(*) AS n FROM requests WHERE day=? AND user_id=?').get(day,user).n;
   if(total>=this.projectLimit||own>=this.userLimit){this.db.exec('ROLLBACK');return 'quota';}
   this.db.prepare('INSERT INTO requests VALUES (?,?,?)').run(user,id,day);this.db.exec('COMMIT');return 'ok';
  } catch(error){this.db.exec('ROLLBACK');throw error;}
 }
 close(){this.db.close();}
}
