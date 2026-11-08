import {test} from 'node:test'
import assert from 'node:assert/strict'
import {initialState} from '../src/planner.js'
import {transferTask} from '../src/moveTask.js'
test('move between days preserves completion and updates repeat day',()=>{
 const s=initialState();s.current.days[0].tasks=[{id:'a',done:true,templateId:'repeat'}];s.templates=[{id:'repeat',day:0}]
 assert.equal(transferTask(s,0,4,'a'),true)
 assert.equal(s.current.days[0].tasks.length,0)
 assert.equal(s.current.days[4].tasks[0].done,true)
 assert.equal(s.templates[0].day,4)
})
test('reorder, append and invalid drops preserve tasks',()=>{
 const s=initialState();s.current.days[0].tasks=[{id:'a'},{id:'b'},{id:'c'}]
 transferTask(s,0,0,'c','a');assert.deepEqual(s.current.days[0].tasks.map(t=>t.id),['c','a','b'])
 transferTask(s,0,0,'c');assert.deepEqual(s.current.days[0].tasks.map(t=>t.id),['a','b','c'])
 assert.equal(transferTask(s,0,0,'a','a'),false)
 assert.equal(transferTask(s,0,7,'a'),false)
 assert.equal(transferTask(s,0,1,'missing'),false)
 assert.equal(s.current.days[0].tasks.length,3)
})
