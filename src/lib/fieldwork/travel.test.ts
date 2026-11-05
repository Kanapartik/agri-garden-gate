import {describe,it,expect} from 'vitest';import {readFileSync} from 'node:fs';import vm from 'node:vm';
const context=vm.createContext({});vm.runInContext(readFileSync('public/fieldwork/travel.js','utf8'),context);const travel=context.FieldworkTravel;
const point=(id:string,lng:number,minute:number,extra={})=>({id,lat:12.15,lng,accuracy:5,userId:'collector-a',sessionId:'shift-a',at:new Date(Date.UTC(2026,10,5,8,minute)).toISOString(),kind:'track',...extra});
describe('fieldwork travel evidence',()=>{
 it('never converts missing coordinates into a real location',()=>{expect(travel.valid({lat:null,lng:null,accuracy:0,at:new Date().toISOString()})).toBe(false);expect(travel.valid(point('a',0,0,{lat:0}))).toBe(false);});
 it('ignores stationary GPS jitter',()=>{const s=travel.analyse([point('a',9.3,0),point('b',9.30001,1)]);expect(s.trackKm).toBe(0);});
 it('rejects inaccurate and mock fixes',()=>{const s=travel.analyse([point('a',9.3,0,{accuracy:80}),point('b',9.31,1,{mock:true})]);expect(s.rejected).toBe(2);expect(s.trackKm).toBe(0);});
 it('does not join different users, sessions or dates',()=>{for(const extra of [{userId:'other'},{sessionId:'other'},{at:'2026-11-06T08:01:00Z'}])expect(travel.analyse([point('a',9.3,0),point('b',9.31,1,extra)]).trackKm).toBe(0);});
 it('keeps GPS gaps separate from reported straight-line legs',()=>{const s=travel.analyse([point('a',9.3,0,{kind:'login'}),point('b',9.32,30,{kind:'report'})]);expect(s.trackKm).toBe(0);expect(s.gaps).toBe(1);expect(s.reportedKm).toBeGreaterThan(2);expect(s.legs[0].fromLoginKm).toBeGreaterThan(2);});
 it('filters implausible jumps rather than inflating distance',()=>{const s=travel.analyse([point('a',9.3,0),point('b',10.3,1)]);expect(s.trackKm).toBe(0);expect(s.rejected).toBe(1);});
 it('deduplicates retries and orders delayed offline points',()=>{const a=point('a',9.3,0),b=point('b',9.301,1);const s=travel.analyse([b,a,b]);expect(s.points).toHaveLength(2);expect(s.trackKm).toBeGreaterThan(.1);expect(s.trackKm).toBeLessThan(.12);});
 it('keeps interleaved team journeys independent',()=>{const s=travel.analyse([point('a',9.3,0,{kind:'login'}),point('x',9.4,0,{kind:'login',userId:'other'}),point('b',9.301,1,{kind:'report'}),point('y',9.401,1,{kind:'report',userId:'other'})]);expect(s.legs).toHaveLength(2);expect(s.legs.every((l:any)=>l.from.userId===l.to.userId)).toBe(true);expect(s.trackKm).toBeGreaterThan(.2);});
 it('marks a report with no login as missing-origin evidence',()=>{const s=travel.analyse([point('a',9.3,0,{kind:'report'})]);expect(s.legs[0].km).toBeNull();expect(s.legs[0].fromLoginKm).toBeNull();});
});
