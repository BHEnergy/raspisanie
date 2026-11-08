import { test } from 'node:test'
import assert from 'node:assert/strict'
import { initialState, newWeek, validState, validTime } from '../src/planner.js'
import { transferTask } from '../src/moveTask.js'
test('optional task time accepts old data and rejects invalid hours', () => {
  for (const time of [undefined, '', '00:00', '09:05', '23:59']) assert.equal(validTime(time), true)
  for (const time of [null, '24:00', '09:60', '9:00', '12:30:00', 900]) assert.equal(validTime(time), false)
  const state = initialState()
  const task = { id:'task', title:'Встреча', category:'work', done:false }
  state.current.days[0].tasks.push(task)
  assert.equal(validState(state), true)
  task.time = '14:30'
  assert.equal(validState(JSON.parse(JSON.stringify(state))), true)
  task.time = '25:30'
  assert.equal(validState(state), false)
})
test('recurring time survives a new week and moving to another day', () => {
  const state = initialState()
  state.templates.push({id:'repeat',templateId:'repeat',title:'Встреча',category:'work',day:0,time:'10:15',done:true})
  state.current = newWeek('2026-11-09',state.templates)
  const task = state.current.days[0].tasks[0]
  assert.equal(task.time,'10:15')
  assert.equal(task.done,false)
  transferTask(state,0,3,task.id)
  assert.equal(state.current.days[3].tasks[0].time,'10:15')
  assert.equal(newWeek('2026-11-16',state.templates).days[3].tasks[0].time,'10:15')
})
