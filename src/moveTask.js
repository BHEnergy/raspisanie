// Keep recurring templates attached to their task when changing days.
export function transferTask(state, source, target, id, beforeId = null) {
  if (!state.current.days[source] || !state.current.days[target] || id === beforeId) return false
  const from = state.current.days[source].tasks
  const index = from.findIndex(task => task.id === id)
  if (index < 0) return false
  const [task] = from.splice(index, 1)
  const to = state.current.days[target].tasks
  const before = to.findIndex(item => item.id === beforeId)
  to.splice(before < 0 ? to.length : before, 0, task)
  const template = state.templates.find(item => item.id === task.templateId)
  if (template) template.day = target
  return true
}
