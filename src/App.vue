<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { dateKey, dayDate, initialState, rollover, uid, validState, validTime } from './planner.js'
import { transferTask } from './moveTask.js'
const storageKey='ritm-planner-v1'
const notice=ref(''), storageFailed=ref(false)
let loaded=initialState()
try { const raw=localStorage.getItem(storageKey); if(raw) { const parsed=JSON.parse(raw); if(!validState(parsed)) throw Error(); loaded=parsed } } catch { storageFailed.value=true; notice.value='Не удалось прочитать сохранение. Экспортируйте данные перед дальнейшей работой.' }
const state=reactive(loaded)
const selected=ref('current'), filter=ref('all'), search=ref(''), onlyImportant=ref(false), modal=ref(null), form=reactive({}), importInput=ref(null)
const names=['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота']
const drag=ref(null), drop=ref(null), movingId=ref(null)
let dragOrigin, moveTimer
function beginDrag(event, day, task) {
  if(archived.value || event.button !== 0) return
  event.preventDefault()
  event.currentTarget.setPointerCapture(event.pointerId)
  dragOrigin={x:event.clientX,y:event.clientY,day,id:task.id,title:task.title}
}
function trackDrag(event) {
  if(!dragOrigin) return
  if(!drag.value && Math.hypot(event.clientX-dragOrigin.x,event.clientY-dragOrigin.y)<6) return
  drag.value={...dragOrigin,x:event.clientX,y:event.clientY}
  const card=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-day]')
  if(!card){drop.value=null;return}
  const target=Number(card.dataset.day)
  const rows=[...card.querySelectorAll('[data-task]')].filter(row=>row.dataset.task!==dragOrigin.id)
  const before=rows.find(row=>event.clientY<row.getBoundingClientRect().top+row.getBoundingClientRect().height/2)
  drop.value={day:target,beforeId:before?.dataset.task||null}
  if(event.clientY>window.innerHeight-70)window.scrollBy(0,12)
  else if(event.clientY<70)window.scrollBy(0,-12)
}
async function animateTransfer(source,target,id,beforeId=null){
  const positions=new Map([...document.querySelectorAll('[data-task]')].map(el=>[el.dataset.task,el.getBoundingClientRect()]))
  if(!transferTask(state,source,target,id,beforeId))return
  movingId.value=id;clearTimeout(moveTimer);moveTimer=setTimeout(()=>movingId.value=null,900)
  await nextTick()
  if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    document.querySelectorAll('[data-task]').forEach(el=>{const old=positions.get(el.dataset.task);if(!old)return;const box=el.getBoundingClientRect();if(old.x!==box.x||old.y!==box.y)el.animate([{transform:`translate(${old.x-box.x}px,${old.y-box.y}px)`},{transform:'translate(0,0)'}],{duration:320,easing:'cubic-bezier(.2,.75,.25,1)'})})
  }
}
function endDrag(){
  if(drag.value&&drop.value&&!archived.value){animateTransfer(dragOrigin.day,drop.value.day,dragOrigin.id,drop.value.beforeId);notice.value=`«${dragOrigin.title}» → ${names[drop.value.day]}`}
  cancelDrag()
}
function cancelDrag(){dragOrigin=null;drag.value=null;drop.value=null}
function keyboardTransfer(day,task,offset){const target=day+offset;if(target<0||target>5)return;animateTransfer(day,target,task.id);notice.value=`«${task.title}» → ${names[target]}`;nextTick(()=>document.querySelector(`[data-task="${task.id}"] .drag-handle`)?.focus())}
function reorderTask(day,task,offset){const list=state.current.days[day].tasks;const index=list.findIndex(t=>t.id===task.id);const target=index+offset;if(target<0||target>=list.length)return;animateTransfer(day,day,task.id,offset<0?list[target].id:list[target+1]?.id);notice.value='Порядок задач изменён.'}
let previousFocus
watch(modal,async value=>{if(value){previousFocus=document.activeElement;await nextTick();document.querySelector('.modal input:not([type=checkbox]):not([type=color]), .modal button')?.focus()}else previousFocus?.focus()})
const short=['ПН','ВТ','СР','ЧТ','ПТ','СБ']
const viewing=computed(()=>selected.value==='current'?state.current:state.archives.find(w=>w.key===selected.value)||state.current)
const archived=computed(()=>viewing.value!==state.current)
const tasks=computed(()=>viewing.value.days.flatMap(d=>d.tasks))
const done=computed(()=>tasks.value.filter(t=>t.done).length)
const percent=computed(()=>tasks.value.length?Math.round(done.value/tasks.value.length*100):0)
const fmt=(date,options)=>date.toLocaleDateString('ru-RU',options)
const range=computed(()=>`${fmt(dayDate(viewing.value.key,0),{day:'numeric'})} — ${fmt(dayDate(viewing.value.key,5),{day:'numeric',month:'long',year:'numeric'})}`)
const category=id=>state.categories.find(c=>c.id===id)||{name:'Без категории',color:'#888888'}
const visible=day=>day.tasks.filter(t=>(filter.value==='all'||t.category===filter.value)&&(!onlyImportant.value||t.important)&&t.title.toLocaleLowerCase().includes(search.value.toLocaleLowerCase()))
watch(state,()=>{if(storageFailed.value)return;try{localStorage.setItem(storageKey,JSON.stringify(state))}catch{notice.value='Не удалось сохранить: память браузера недоступна или заполнена. Скачайте резервную копию.'}},{deep:true,flush:'sync'})
function checkWeek(){if(rollover(state)){selected.value='current';notice.value='Началась новая неделя. Предыдущая сохранена в архиве.'}}
let timer
onMounted(()=>{checkWeek();timer=setInterval(checkWeek,30000);window.addEventListener('focus',checkWeek)})
onUnmounted(()=>{clearInterval(timer);clearTimeout(moveTimer);window.removeEventListener('focus',checkWeek)})
function openTask(day,task){Object.assign(form,{id:task?.id||null,day,title:task?.title||'',time:task?.time||'',category:task?.category||state.categories[0]?.id||'',important:!!task?.important,repeat:!!task?.templateId});modal.value='task'}
function saveTask(){
  if(!form.title.trim()||!validTime(form.time))return
  checkWeek();const day=state.current.days[form.day];let task=day.tasks.find(t=>t.id===form.id)
  if(!task){task={id:uid(),done:false};day.tasks.push(task)}
  Object.assign(task,{title:form.title.trim(),time:form.time,category:form.category,important:form.important})
  state.templates=state.templates.filter(t=>t.id!==task.templateId)
  if(form.repeat){task.templateId=task.templateId||uid();state.templates.push({...task,id:task.templateId,day:form.day})}else delete task.templateId
  modal.value=null
}
function removeTask(day,task){state.current.days[day].tasks=state.current.days[day].tasks.filter(t=>t.id!==task.id);state.templates=state.templates.filter(t=>t.id!==task.templateId)}
function moveTask(day,task){
  const target=day===5?0:day+1
  if(day===5){notice.value='Суббота — последний день. Для следующей недели включите повтор в редакторе задачи.';return}
  animateTransfer(day,target,task.id)
  notice.value=`Задача перенесена: ${names[target].toLowerCase()}.`
}
function addCategory(){const name=form.name?.trim();if(!name)return;if(state.categories.some(c=>c.name.toLocaleLowerCase()===name.toLocaleLowerCase()))return;state.categories.push({id:uid(),name,color:form.color||'#698776'});form.name=''}
function deleteCategory(c){state.categories=state.categories.filter(x=>x.id!==c.id);if(filter.value===c.id)filter.value='all';for(const week of [state.current,...state.archives])for(const day of week.days)for(const task of day.tasks)if(task.category===c.id)task.category='';for(const task of state.templates)if(task.category===c.id)task.category=''}
function exportData(){const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`ritm-${dateKey(new Date())}.json`;a.click();URL.revokeObjectURL(url)}
async function importData(event){try{const file=event.target.files[0];if(!file)return;if(file.size>5e6)throw Error();const data=JSON.parse(await file.text());if(!validState(data))throw Error();Object.assign(form,{importData:data});modal.value='import'}catch{notice.value='Файл не подходит. Выберите резервную копию Ритма в формате JSON.'}finally{event.target.value=''}}
function confirmImport(){storageFailed.value=false;Object.assign(state,form.importData);selected.value='current';checkWeek();modal.value=null;notice.value='Резервная копия восстановлена.'}
function openCategories(){form.name='';form.color='#698776';modal.value='categories'}
function toggleImportant(task){task.important=!task.important;const template=state.templates.find(t=>t.id===task.templateId);if(template)template.important=task.important}
function pressFeedback(event){
  if(event.type==='keydown'&&!['Enter',' '].includes(event.key))return
  const button=event.target.closest('button')
  if(!button||button.disabled||button.classList.contains('drag-handle')||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return
  button.animate([{scale:'1'},{scale:'.94',offset:.3},{scale:'1'}],{duration:280,easing:'cubic-bezier(.2,.7,.3,1)'})
}
function keyboard(event){
  if(event.key==='Escape'){modal.value=null;cancelDrag()}
  if(event.key==='Tab'&&modal.value){const items=[...document.querySelectorAll('.modal button:not(:disabled),.modal input:not(:disabled),.modal select:not(:disabled)')];const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}}
}
</script>

<template>
  <div class="app-shell" @keydown="keyboard" @pointerdown.capture="pressFeedback" @keydown.capture="pressFeedback">
    <aside class="sidebar">
      <a class="brand" href="./" aria-label="Ритм, главная">ритм<span class="brand-index">/ 01</span></a>
      <p class="sidebar-caption">Недельный планировщик</p>
      <nav aria-label="Разделы"><button class="nav-item" :class="{active:!archived}" @click="selected='current'"><span>▦</span> Моя неделя <span class="nav-count">6</span></button><button class="nav-item" :class="{active:archived}" @click="modal='archive'"><span>▤</span> Архив недель <span class="nav-count">{{state.archives.length}}</span></button></nav>
      <div class="category-heading"><span>КАТЕГОРИИ</span><button aria-label="Управление категориями" @click="openCategories">+</button></div>
      <button class="category-filter" :class="{chosen:filter==='all'}" @click="filter='all'"><span class="category-dot all-dot"></span> Все задачи <span>{{tasks.length}}</span></button>
      <button v-for="c in state.categories" :key="c.id" class="category-filter" :class="{chosen:filter===c.id}" @click="filter=c.id"><span class="category-dot" :style="{background:c.color}"></span>{{c.name}}<span>{{tasks.filter(t=>t.category===c.id).length}}</span></button>
      <button class="mobile-categories" @click="openCategories" aria-label="Управление категориями">+ Категория</button>
      <div class="sidebar-bottom"><div class="sidebar-motto"><span class="small-flower">✳</span><h3>У каждого дела<br>своё время.</h3><p>Оставьте в неделе место<br>и для себя.</p></div><div class="backup-actions"><button @click="exportData">↓ Экспорт</button><button @click="importInput.click()">↑ Импорт</button></div><input ref="importInput" type="file" accept="application/json" hidden @change="importData"><span class="local-label">Данные хранятся в браузере</span></div>
    </aside>
    <main>
      <header class="topbar"><span>Личный планировщик <span class="topbar-slash">/</span> {{archived?'Архив':'Моя неделя'}}</span><span class="today-label">{{fmt(new Date(),{day:'numeric',month:'long',weekday:'short'})}}</span></header>
      <section class="page-heading"><div><div class="eyebrow">МЕНЬШЕ СУЕТЫ. БОЛЬШЕ СМЫСЛА.</div><h1 v-if="!archived">Всё идёт своим <em>ритмом.</em></h1><h1 v-else>Архив недели.</h1><p>{{archived?'Задачи и заметки сохранены для просмотра.':'Шесть дней для дел, идей и маленьких побед.'}}</p></div><button class="primary add-main" :disabled="archived" @click="openTask(0)"><span>+</span> Новая задача</button></section>
      <section class="week-overview"><div class="week-title"><span class="calendar-icon">▦</span><div><h2>{{range}}</h2><span>{{archived?'Сохранённая неделя':'Ваша неделя'}} <b>·</b> понедельник — суббота</span></div></div><div class="progress-info"><div><span>Недельный прогресс</span><strong>{{done}} <small>/ {{tasks.length}}</small></strong></div><div class="progress-track"><span :style="{width:percent+'%'}"></span></div></div><span class="progress-percent">{{percent}}%</span></section>
      <div class="toolbar"><div class="view-label">План на неделю <span>{{tasks.length}} задач</span></div><div class="toolbar-controls"><button class="important-filter" :class="{selected:onlyImportant}" @click="onlyImportant=!onlyImportant">☆ <span>Важное</span></button><label class="search"><span>⌕</span><input v-model="search" placeholder="Найти задачу" aria-label="Найти задачу"><button v-if="search" @click="search=''" aria-label="Очистить поиск">×</button></label></div></div>
      <p v-if="!archived" class="drag-help">Перетаскивайте за ⋮⋮, чтобы менять порядок и день. Стрелка → переносит на завтра.</p>
      <div class="week-grid" :class="{'is-dragging':drag}"><article v-for="(day,index) in viewing.days" :key="viewing.key+index" :data-day="index" class="day-card" :class="{today:dateKey(dayDate(viewing.key,index))===dateKey(new Date()),'drop-active':drop?.day===index}">
        <div class="day-header"><div class="day-name"><span class="day-short">{{short[index]}}</span><h2>{{names[index]}}</h2><span v-if="dateKey(dayDate(viewing.key,index))===dateKey(new Date())" class="today-pill">сегодня</span></div><span class="day-number">{{fmt(dayDate(viewing.key,index),{day:'2-digit'})}}</span></div>
        <div class="day-meta"><span>{{day.tasks.filter(t=>t.done).length}} / {{day.tasks.length}} выполнено</span></div>
        <div class="task-list"><TransitionGroup name="task-row" tag="div" class="task-rows"><div v-for="task in visible(day)" :key="task.id" class="task" :data-task="task.id" :class="{completed:task.done, dragging:drag?.id===task.id, landed:movingId===task.id, 'drop-before':drop?.day===index&&drop?.beforeId===task.id}"><button v-if="!archived" class="drag-handle" aria-label="Перетащить задачу; Alt и стрелки меняют день или порядок" title="Перетащить · Alt + стрелки" @pointerdown="beginDrag($event,index,task)" @pointermove="trackDrag" @pointerup="endDrag" @pointercancel="cancelDrag" @lostpointercapture="cancelDrag" @keydown.alt.up.prevent="reorderTask(index,task,-1)" @keydown.alt.down.prevent="reorderTask(index,task,1)" @keydown.alt.left.prevent="keyboardTransfer(index,task,-1)" @keydown.alt.right.prevent="keyboardTransfer(index,task,1)">⋮⋮</button><input v-model="task.done" type="checkbox" :disabled="archived" :aria-label="'Выполнено: '+task.title"><div class="task-content"><button class="task-title" :disabled="archived" @click="openTask(index,task)">{{task.title}}</button><div class="task-tags"><time v-if="task.time" class="task-time" :datetime="task.time" :aria-label="'Время задачи: '+task.time">{{task.time}}</time><span class="task-category" :style="{'--category-color':category(task.category).color}">{{category(task.category).name}}</span><span v-if="task.templateId" title="Повторяется каждую неделю">↻</span></div></div><div class="task-actions"><button class="importance-button" :disabled="archived" :class="{starred:task.important}" :aria-pressed="!!task.important" @click="toggleImportant(task)" :aria-label="task.important?'Снять важность':'Отметить важным'"><span class="star-outline" aria-hidden="true">☆</span><span class="star-fill" aria-hidden="true">★</span></button><button v-if="!archived&&index<5" @click="moveTask(index,task)" aria-label="Перенести на следующий день" title="На следующий день">→</button><button v-if="!archived" @click="removeTask(index,task)" aria-label="Удалить задачу" title="Удалить">×</button></div></div></TransitionGroup><div v-if="!visible(day).length" class="empty-day"><span>○</span><p>{{day.tasks.length?'Ничего не найдено':'Нет задач'}}<small>{{day.tasks.length?'Попробуйте изменить фильтры':'Добавьте задачу на этот день'}}</small></p></div><div v-if="drop?.day===index&&!drop.beforeId" class="drop-end">Переместить сюда</div><button v-if="!archived" class="add-task" @click="openTask(index)">+ <span>Добавить задачу</span></button></div>
        <div class="day-notes"><div class="notes-heading">Заметки</div><label v-for="(label,key) in {yesterday:'Со вчера',tomorrow:'На завтра',remember:'Не забыть'}" :key="key"><span>{{label}}</span><textarea v-model="day.notes[key]" :readonly="archived" rows="1" :aria-label="names[index]+': '+label" placeholder="Оставить заметку…" maxlength="2000"></textarea></label></div>
      </article></div>
      <footer><span>Обновление недели — в воскресенье. Предыдущая сохраняется в архив.</span><span>Планируйте с заботой о себе ✳</span></footer>
    </main>
    <Transition name="toast"><div v-if="notice" class="toast" role="status">{{notice}}<button @click="notice=''" aria-label="Закрыть уведомление">×</button></div></Transition>
    <div v-if="drag" class="drag-preview" :style="{left:drag.x+16+'px',top:drag.y+14+'px'}">{{drag.title}}<small>{{drop?'→ '+names[drop.day]:'Выберите день'}}</small></div>
    <Transition name="dialog"><div v-if="modal" class="modal-backdrop" @click.self="modal=null"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button class="modal-close" @click="modal=null" aria-label="Закрыть">×</button>
      <template v-if="modal==='task'"><h2 id="modal-title">{{form.id?'Редактировать задачу':'Новая задача'}}</h2><form @submit.prevent="saveTask"><label>Название<input v-model="form.title" required maxlength="200" autofocus placeholder="Например, закончить проект"></label><div class="form-row"><label>День<select v-model="form.day" :disabled="!!form.id"><option v-for="(name,i) in names" :value="i">{{name}}</option></select></label><label>Категория<select v-model="form.category"><option value="">Без категории</option><option v-for="c in state.categories" :value="c.id">{{c.name}}</option></select></label></div><label>Время <span class="field-optional">необязательно</span><div class="time-field"><input v-model="form.time" type="time" aria-label="Время задачи"><button v-if="form.time" type="button" class="clear-time" @click="form.time=''" aria-label="Убрать время">Убрать</button></div></label><label class="check-label"><input type="checkbox" v-model="form.important"> Важная задача</label><label class="check-label"><input type="checkbox" v-model="form.repeat"> Повторять каждую неделю в этот день</label><button class="primary" :disabled="!form.title.trim()">Сохранить задачу</button></form></template>
      <template v-else-if="modal==='categories'"><h2 id="modal-title">Ваши категории</h2><p>Название и цвет категории можно изменить.</p><div v-for="c in state.categories" class="category-edit"><input type="color" v-model="c.color" :aria-label="'Цвет: '+c.name"><input v-model="c.name" maxlength="40" :aria-label="'Название категории'"><button @click="deleteCategory(c)" aria-label="Удалить категорию">×</button></div><form @submit.prevent="addCategory"><label>Новая категория<input v-model="form.name" maxlength="40" required placeholder="Например, здоровье"></label><div class="form-row"><input type="color" v-model="form.color" aria-label="Цвет новой категории"><button class="primary" :disabled="!form.name?.trim()">Добавить</button></div></form></template>
      <template v-else-if="modal==='archive'"><h2 id="modal-title">Архив недель</h2><p>Завершённые недели. Только просмотр.</p><p v-if="!state.archives.length" class="archive-empty">Первая неделя появится здесь в воскресенье.</p><button v-for="week in state.archives" class="archive-item" @click="selected=week.key;modal=null">{{fmt(dayDate(week.key,0),{day:'numeric',month:'long',year:'numeric'})}} <span>Открыть →</span></button></template>
      <template v-else><h2 id="modal-title">Восстановить копию?</h2><p>Текущие задачи, категории и архив будут заменены данными из файла. Сохраните текущую копию перед восстановлением.</p><div class="form-row"><button class="secondary" @click="exportData">Скачать текущую</button><button class="primary" @click="confirmImport">Восстановить</button></div></template>
    </section></div></Transition>
  </div>
</template>
