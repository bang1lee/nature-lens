import {expect,it} from 'vitest';
import {rememberIdentification,pendingIdentification,clearIdentificationReturn} from '../src/lib/cloud/identification-return';
it('remembers only a record ID, expires it, and tolerates unavailable storage',()=>{
 const values=new Map<string,string>();const store={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);},removeItem:(k:string)=>{values.delete(k);}};
 rememberIdentification('saved-record',store,1000);expect(pendingIdentification(store,1001)).toBe('saved-record');
 expect([...values.values()][0]).not.toContain('photo');
 expect(pendingIdentification(store,1000+86400001)).toBeNull();expect(values.size).toBe(0);
 rememberIdentification('another-record',store);clearIdentificationReturn(store);expect(values.size).toBe(0);
 expect(pendingIdentification({getItem:()=>{throw new Error('blocked');},removeItem:()=>{}})).toBeNull();
});
