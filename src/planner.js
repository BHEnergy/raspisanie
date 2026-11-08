export const uid = () => globalThis.crypto.randomUUID()
export const validTime = value => value === undefined || value === '' || (typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value))
export function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}
export function weekKey(now = new Date()) {
  const date = new Date(now); date.setHours(12,0,0,0)
  date.setDate(date.getDate() + (date.getDay() === 0 ? 1 : 1-date.getDay()))
  return dateKey(date)
}
export function dayDate(week, index) {
  const date = new Date(`${week}T12:00:00`); date.setDate(date.getDate()+index); return date
}
export function newWeek(key, templates = []) {
  return { key, days: Array.from({length:6}, (_,index) => ({ notes: { yesterday:'', tomorrow:'', remember:'' }, tasks: templates.filter(t=>t.day===index).map(t=>({...t,id:uid(),done:false})) })) }
}
export function initialState() {
  return { version:1, categories:[{id:'work',name:'Работа',color:'#698776'},{id:'home',name:'Дом',color:'#c49257'},{id:'personal',name:'Личные дела',color:'#8c80ab'}], templates:[], current:newWeek(weekKey()), archives:[] }
}
export function rollover(state, now = new Date()) {
  const key = weekKey(now)
  if (key <= state.current.key) return false
  state.archives.unshift(JSON.parse(JSON.stringify(state.current)))
  state.current = newWeek(key,state.templates)
  return true
}
export function validState(s) {
  const task = t => t && typeof t.id==='string' && typeof t.title==='string' && typeof t.category==='string' && typeof t.done==='boolean' && validTime(t.time)
  const week = w => w && /^\d{4}-\d{2}-\d{2}$/.test(w.key) && !isNaN(new Date(w.key)) && Array.isArray(w.days) && w.days.length===6 && w.days.every(d=>Array.isArray(d.tasks)&&d.tasks.every(task)&&d.notes&&['yesterday','tomorrow','remember'].every(k=>typeof d.notes[k]==='string'))
  return s?.version===1 && Array.isArray(s.categories) && s.categories.every(c=>typeof c.id==='string'&&typeof c.name==='string'&&/^#[0-9a-f]{6}$/i.test(c.color)) && Array.isArray(s.templates) && s.templates.every(t=>task(t)&&Number.isInteger(t.day)&&t.day>=0&&t.day<6) && week(s.current) && Array.isArray(s.archives) && s.archives.every(week)
}
