import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reactive } from 'vue'
import { weekKey, dayDate, dateKey, initialState, newWeek, rollover, validState } from '../src/planner.js'
test('Sunday starts the coming Monday; Saturday retains its week',()=>{
  assert.equal(weekKey(new Date('2026-11-07T23:59:59')),'2026-11-02')
  assert.equal(weekKey(new Date('2026-11-08T00:00:00')),'2026-11-09')
  assert.equal(weekKey(new Date('2026-11-09T12:00:00')),'2026-11-09')
  assert.equal(dateKey(dayDate('2026-12-28',5)),'2027-01-02')
})
test('reactive state rolls over once, archives notes, and resets recurring tasks',()=>{
  const s=reactive(initialState());s.current=newWeek('2026-11-02')
  s.current.days[0].notes.remember='Важно'
  s.current.days[0].tasks.push({id:'old',title:'Разовое',category:'work',done:true})
  s.templates.push({id:'template',title:'Повтор',category:'work',done:true,day:2,templateId:'template'})
  assert.equal(rollover(s,new Date('2026-11-08T00:00:00')),true)
  assert.equal(s.archives[0].days[0].notes.remember,'Важно')
  assert.equal(s.current.days[0].tasks.length,0)
  assert.equal(s.current.days[2].tasks[0].done,false)
  assert.notEqual(s.current.days[2].tasks[0].id,'template')
  assert.equal(rollover(s,new Date('2026-11-08T15:00:00')),false)
  assert.equal(s.archives.length,1)
  assert.equal(validState(s),true)
})
test('invalid backups are rejected',()=>{
  assert.equal(validState(initialState()),true)
  assert.equal(validState({version:1}),false)
  const state=initialState();state.current.days[0].notes=null
  assert.equal(validState(state),false)
})
