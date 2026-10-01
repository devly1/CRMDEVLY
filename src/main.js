import './style.css'
import devlyLogo from './assets/devly-logo.png'
import devlyLogoLight from './assets/devly-logo-light.png'
import { supabase } from './lib/supabase.js'

const workspaceContext = JSON.parse(sessionStorage.getItem('devly-workspace-context') || 'null')
const { user, membership, team } = workspaceContext
const THEME_KEY = 'devly-theme'
const statuses = ['pendiente', 'contactado', 'respondio', 'negociacion', 'cerrado']
const statusLabels = {
  pendiente: 'Pendiente',
  contactado: 'Contactado',
  respondio: 'Respondió',
  negociacion: 'En negociación',
  cerrado: 'Cerrado',
}
const icons = {
  arrow: '<path d="M7 17 17 7M7 7h10v10"/>',
  briefcase: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  close: '<path d="m18 6-12 12M6 6l12 12"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z"/>',
  moon: '<path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.4 2.7a2 2 0 0 1-.6 1.7L7.6 9.4a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 1.7-.6l2.7.4a2 2 0 0 1 1.7 2Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM20 8v6m3-3h-6"/>',
  logout: '<path d="M10 17l5-5-5-5M15 12H3M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5m4-1v5l3 2"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
}

const icon = (name, className = '') => `<svg class="icon ${className}" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</svg>`
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
const fromDatabase = (row) => ({
  id: row.id,
  name: row.name,
  niche: row.niche,
  status: row.status,
  website: row.website,
  phone: row.phone,
  notes: row.notes,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  contactedAt: row.contacted_at,
  respondedAt: row.responded_at,
})
const toDatabase = (prospect) => ({
  id: prospect.id,
  team_id: team.id,
  name: prospect.name,
  niche: prospect.niche,
  status: prospect.status,
  website: prospect.website,
  phone: prospect.phone,
  notes: prospect.notes,
  created_by: prospect.createdBy || user.id,
  created_at: prospect.createdAt,
  updated_at: prospect.updatedAt,
  contacted_at: prospect.contactedAt,
  responded_at: prospect.respondedAt,
})

let prospects = []
let activeFilter = 'todos'
let searchTerm = ''
let editingId = null
let theme = localStorage.getItem(THEME_KEY) || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

document.documentElement.dataset.theme = theme
document.querySelector('#app').innerHTML = `
  <div class="app-shell">
    <aside class="sidebar" aria-label="Navegación principal">
      <a class="brand" href="#inicio" aria-label="Devly, inicio">
        <img class="brand-logo" src="${theme === 'dark' ? devlyLogo : devlyLogoLight}" alt="Devly Web Studio" width="486" height="384">
      </a>
      <div class="workspace-label">ESPACIO DE TRABAJO</div>
      <div class="workspace-team-name">${escapeHtml(team.name)}</div>
      <nav class="side-nav">
        <a class="nav-link is-active" href="#prospectos">${icon('briefcase')}<span>Prospección</span><span class="nav-count" id="nav-count">0</span></a>
      </nav>
      <div class="sidebar-foot">
        <div class="local-status"><span class="status-light"></span><span>Sincronizado con el equipo</span></div>
        <div class="workspace-user"><span class="avatar">${escapeHtml((user.email || 'U').slice(0, 1).toUpperCase())}</span><span class="user-details"><strong>${escapeHtml(user.email || 'Usuario')}</strong><small>${membership.role === 'owner' ? 'Administrador' : 'Miembro'}</small></span><button class="icon-button user-menu" type="button" data-action="logout" aria-label="Cerrar sesión" title="Cerrar sesión">${icon('logout')}</button></div>
      </div>
    </aside>

    <main class="main-panel" id="prospectos">
      <header class="topbar">
        <div class="crumb"><span>VENTAS</span>${icon('chevron')}<strong>Prospección</strong></div>
        <div class="top-actions">
          <button class="icon-button theme-toggle" id="theme-toggle" type="button" aria-label="Cambiar tema" title="Cambiar tema"></button>
          <button class="button button-quiet activity-toolbar-button" type="button" data-action="team-activity" title="Ver actividad del equipo">${icon('history')}<span class="activity-toolbar-label">Actividad</span></button>
          <button class="button button-quiet invite-button" type="button" data-action="invite" title="Copiar código de invitación">${icon('users')}<span class="invite-label">Invitar equipo</span></button>
          <button class="button button-primary" type="button" data-action="new">${icon('plus')}<span>Nuevo negocio</span></button>
        </div>
      </header>

      <div class="page-content">
        <section class="page-heading">
          <div>
            <div class="eyebrow"><span class="eyebrow-dot"></span> TABLERO DE VENTAS</div>
            <h1>Prospección<span class="heading-period">.</span></h1>
            <p>Una buena conversación empieza por saber a quién escribir.</p>
          </div>
          <div class="today-label" id="today-label"></div>
        </section>

        <section class="metrics" aria-label="Resumen de prospectos">
          <article class="metric metric-total"><div class="metric-top"><span>Total de prospectos</span><span class="metric-icon">${icon('briefcase')}</span></div><strong id="metric-total">0</strong><small>En tu tablero</small></article>
          <article class="metric metric-pending"><div class="metric-top"><span>Pendientes</span><span class="metric-icon">${icon('send')}</span></div><strong id="metric-pending">0</strong><small>Esperando primer contacto</small></article>
          <article class="metric metric-sent"><div class="metric-top"><span>Mensajes enviados hoy</span><span class="metric-icon">${icon('check')}</span></div><strong id="metric-sent">0</strong><small>Contactos registrados hoy</small></article>
          <article class="metric metric-response"><div class="metric-top"><span>Tasa de respuesta</span><span class="metric-icon">${icon('arrow')}</span></div><strong id="metric-response">0%</strong><small id="metric-response-note">Sin contactos todavía</small></article>
        </section>

        <section class="prospects-section" aria-label="Lista de negocios">
          <div class="list-heading">
            <div><h2>Mis negocios</h2><span class="results-count" id="results-count">0 resultados</span></div>
            <div class="list-heading-actions">
              <button class="button button-quiet export-button" type="button" data-action="export">${icon('download')}<span>Exportar CSV</span></button>
              <button class="button button-quiet button-add-mobile" type="button" data-action="new">${icon('plus')}<span>Agregar</span></button>
            </div>
          </div>
          <div class="list-controls">
            <label class="search-box">${icon('search')}<input id="search-input" type="search" placeholder="Buscar negocio o nicho..." autocomplete="off"><kbd>/</kbd></label>
            <div class="filter-list" role="group" aria-label="Filtrar por estatus">
              <button class="filter-button is-selected" type="button" data-filter="todos">Todos <span id="count-todos">0</span></button>
              <button class="filter-button" type="button" data-filter="pendiente">Pendientes <span id="count-pendiente">0</span></button>
              <button class="filter-button" type="button" data-filter="contactado">Contactados <span id="count-contactado">0</span></button>
              <button class="filter-button" type="button" data-filter="respondio">Respondieron <span id="count-respondio">0</span></button>
              <button class="filter-button" type="button" data-filter="cerrado">Cerrados <span id="count-cerrado">0</span></button>
            </div>
          </div>
          <div class="prospect-grid" id="prospect-grid"></div>
        </section>

        <footer class="page-footer"><span>${escapeHtml(team.name)} <span class="footer-separator">/</span> CRM de prospección</span><span>Los datos se sincronizan con tu equipo</span></footer>
      </div>
    </main>
  </div>

  <dialog class="prospect-dialog" id="prospect-dialog" aria-labelledby="dialog-title">
    <form class="prospect-form" id="prospect-form" novalidate>
      <div class="dialog-heading"><div><span class="eyebrow">FICHA DE NEGOCIO</span><h2 id="dialog-title">Nuevo prospecto</h2></div><button class="icon-button" type="button" data-action="close" aria-label="Cerrar">${icon('close')}</button></div>
      <div class="form-grid">
        <label class="field field-wide"><span>Nombre del negocio <b>*</b></span><input name="name" required maxlength="100" placeholder="Ej. Café del Parque"></label>
        <label class="field"><span>Nicho / giro <b>*</b></span><input name="niche" required maxlength="70" placeholder="Ej. Cafetería"></label>
        <label class="field"><span>Estatus</span><select name="status"><option value="pendiente">Pendiente</option><option value="contactado">Contactado</option><option value="respondio">Respondió</option><option value="negociacion">En negociación</option><option value="cerrado">Cerrado</option></select></label>
        <label class="field"><span>Sitio web</span><input name="website" inputmode="url" maxlength="200" placeholder="ejemplo.com"></label>
        <label class="field"><span>Teléfono / WhatsApp</span><input name="phone" type="tel" maxlength="30" placeholder="+52 55 1234 5678"></label>
        <label class="field field-wide"><span>Notas rápidas</span><textarea name="notes" rows="3" maxlength="500" placeholder="Oportunidades, detalles de contacto..."></textarea></label>
      </div>
      <p class="form-error" id="form-error" role="alert"></p>
      <div class="dialog-actions"><button class="button button-quiet" type="button" data-action="close">Cancelar</button><button class="button button-primary" type="submit">Guardar negocio</button></div>
    </form>
  </dialog>
  <dialog class="activity-dialog" id="activity-dialog" aria-labelledby="activity-title">
    <section class="activity-panel">
      <div class="dialog-heading"><div><span class="eyebrow">HISTORIAL COMPARTIDO</span><h2 id="activity-title">Actividad</h2></div><button class="icon-button" type="button" data-action="close-activity" aria-label="Cerrar historial">${icon('close')}</button></div>
      <div class="activity-list" id="activity-list" aria-live="polite"></div>
    </section>
  </dialog>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>
`

const grid = document.querySelector('#prospect-grid')
const dialog = document.querySelector('#prospect-dialog')
const activityDialog = document.querySelector('#activity-dialog')
const form = document.querySelector('#prospect-form')
let toastTimer

const formatDate = (date, options = { day: 'numeric', month: 'short' }) => new Intl.DateTimeFormat('es-MX', options).format(date)
const formatDateTime = (value) => value ? new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : ''
const todayKey = (value) => {
  const date = new Date(value)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}
async function loadProspects() {
  const { data, error } = await supabase
    .from('prospects')
    .select('*')
    .eq('team_id', team.id)
    .order('updated_at', { ascending: false })

  if (error) {
    showToast('No se pudieron cargar los prospectos del equipo.')
    return false
  }

  let records = data || []
  const migrationKey = `devly-prospects-migrated-${user.id}`
  if (!localStorage.getItem(migrationKey)) {
    try {
      const previous = JSON.parse(localStorage.getItem('devly-prospects-v1') || '[]')
      const legacyRecords = Array.isArray(previous)
        ? previous.filter((prospect) => prospect?.id && statuses.includes(prospect.status)).map((prospect) => toDatabase({
            ...prospect,
            createdBy: user.id,
            createdAt: prospect.createdAt || new Date().toISOString(),
            updatedAt: prospect.updatedAt || new Date().toISOString(),
          }))
        : []

      if (legacyRecords.length) {
        const { error: migrationError } = await supabase
          .from('prospects')
          .upsert(legacyRecords, { onConflict: 'id', ignoreDuplicates: true })
        if (migrationError) {
          showToast('No se pudieron importar los prospectos guardados en este navegador.')
          return false
        }
        localStorage.removeItem('devly-prospects-v1')
        const { data: refreshed, error: refreshError } = await supabase
          .from('prospects')
          .select('*')
          .eq('team_id', team.id)
          .order('updated_at', { ascending: false })
        if (refreshError) return false
        records = refreshed || []
      }
      localStorage.setItem(migrationKey, 'done')
    } catch {
      showToast('No se pudieron leer los prospectos guardados en este navegador.')
      return false
    }
  }

  prospects = records.map(fromDatabase)
  return true
}

async function saveProspect(prospect) {
  const { error } = await supabase.from('prospects').upsert(toDatabase(prospect))
  if (error) {
    showToast('No se pudo guardar el cambio en la base de datos.')
    return false
  }
  return true
}
const showToast = (message) => {
  const toast = document.querySelector('#toast')
  toast.textContent = message
  toast.classList.add('is-visible')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2800)
}
const exportProspects = () => {
  if (!prospects.length) {
    showToast('Aún no hay prospectos para exportar.')
    return
  }

  const csvCell = (value) => {
    const text = String(value ?? '')
    const safeText = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
    return `"${safeText.replace(/"/g, '""')}"`
  }
  const headers = ['Negocio', 'Nicho', 'Estatus', 'Sitio web', 'Teléfono', 'Notas', 'Creado', 'Última actualización', 'Contactado', 'Respondió']
  const rows = prospects.map((prospect) => [
    prospect.name,
    prospect.niche,
    statusLabels[prospect.status],
    prospect.website,
    prospect.phone,
    prospect.notes,
    prospect.createdAt,
    prospect.updatedAt,
    prospect.contactedAt,
    prospect.respondedAt,
  ])
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
  const downloadUrl = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = downloadUrl
  link.download = `devly-prospectos-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(downloadUrl)
  showToast(`${prospects.length} prospectos exportados.`)
}
const activityDescription = (entry) => {
  if (entry.action === 'status_changed') {
    return `Cambió el estatus de ${statusLabels[entry.details?.from] || entry.details?.from} a ${statusLabels[entry.details?.to] || entry.details?.to}.`
  }
  return {
    created: 'Agregó este negocio al equipo.',
    updated: 'Editó los datos del negocio.',
    contacted: 'Registró un contacto.',
    responded: 'Registró una respuesta.',
    deleted: 'Eliminó este negocio.',
  }[entry.action] || 'Actualizó el negocio.'
}
const openActivity = async (prospect = null) => {
  document.querySelector('#activity-title').textContent = prospect ? `Actividad · ${prospect.name}` : 'Actividad del equipo'
  const list = document.querySelector('#activity-list')
  list.innerHTML = '<p class="activity-empty">Cargando historial...</p>'
  activityDialog.showModal()
  let activityQuery = supabase
    .from('activity_log')
    .select('id, prospect_name, actor_email, action, details, created_at')
    .eq('team_id', team.id)
    .order('created_at', { ascending: false })
    .limit(50)
  if (prospect) activityQuery = activityQuery.eq('prospect_id', prospect.id)
  const { data, error } = await activityQuery

  if (error) {
    list.innerHTML = '<p class="activity-empty">No se pudo cargar la actividad del equipo.</p>'
    return
  }
  if (!data.length) {
    list.innerHTML = '<p class="activity-empty">Todavía no hay actividad registrada.</p>'
    return
  }
  list.innerHTML = data.map((entry) => `<article class="activity-entry"><span class="activity-marker"></span><div><strong>${escapeHtml(entry.actor_email)}</strong>${prospect ? '' : `<span class="activity-prospect">${escapeHtml(entry.prospect_name)}</span>`}<p>${escapeHtml(activityDescription(entry))}</p><time>${escapeHtml(formatDateTime(entry.created_at))}</time></div></article>`).join('')
}
const normalizeWebsite = (value) => {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Escribe una dirección web válida.')
  return url.href
}
const websiteLabel = (value) => {
  try { return new URL(value).hostname.replace(/^www\./, '') } catch { return value }
}
const whatsappUrl = (phone, name) => {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return ''
  const message = `Hola, ${name}. Soy de Devly Studio y quería platicar contigo sobre la presencia web de tu negocio. ¿Tienes un momento?`
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}
const isContacted = (prospect) => Boolean(prospect.contactedAt)
const filteredProspects = () => {
  const normalizedSearch = searchTerm.trim().toLocaleLowerCase('es-MX')
  return prospects
    .filter((prospect) => {
      const matchesFilter = activeFilter === 'todos'
        || (activeFilter === 'contactado' && ['contactado', 'negociacion'].includes(prospect.status))
        || prospect.status === activeFilter
      const matchesSearch = !normalizedSearch || `${prospect.name} ${prospect.niche}`.toLocaleLowerCase('es-MX').includes(normalizedSearch)
      return matchesFilter && matchesSearch
    })
    .sort((first, second) => new Date(second.updatedAt) - new Date(first.updatedAt))
}

const renderCard = (prospect) => {
  const website = prospect.website
    ? `<a class="detail-link" href="${escapeHtml(prospect.website)}" target="_blank" rel="noopener noreferrer">${icon('globe')}<span>${escapeHtml(websiteLabel(prospect.website))}</span>${icon('arrow', 'link-arrow')}</a>`
    : `<span class="detail-muted">${icon('globe')}<span>Sin sitio web registrado</span></span>`
  const whatsApp = whatsappUrl(prospect.phone, prospect.name)
  const contactMeta = prospect.contactedAt ? `Último contacto ${formatDateTime(prospect.contactedAt)}` : 'Aún no contactado'

  return `<article class="prospect-card" data-status="${prospect.status}">
    <div class="card-topline"><span class="niche-label">${escapeHtml(prospect.niche)}</span><div class="card-menu">
      <button class="icon-button card-icon-button" type="button" data-action="edit" data-id="${prospect.id}" aria-label="Editar ${escapeHtml(prospect.name)}" title="Editar">${icon('edit')}</button>
      <button class="icon-button card-icon-button" type="button" data-action="activity" data-id="${prospect.id}" aria-label="Ver actividad de ${escapeHtml(prospect.name)}" title="Ver actividad">${icon('history')}</button>
      <button class="icon-button card-icon-button delete-button" type="button" data-action="delete" data-id="${prospect.id}" aria-label="Eliminar ${escapeHtml(prospect.name)}" title="Eliminar">${icon('trash')}</button>
    </div></div>
    <h3>${escapeHtml(prospect.name)}</h3>
    <label class="status-control"><span class="status-dot"></span><select aria-label="Estatus de ${escapeHtml(prospect.name)}" data-action="status" data-id="${prospect.id}">${statuses.map((status) => `<option value="${status}" ${prospect.status === status ? 'selected' : ''}>${statusLabels[status]}</option>`).join('')}</select>${icon('chevron', 'status-chevron')}</label>
    <div class="card-details">${website}${prospect.phone ? `<span class="detail-muted">${icon('phone')}<span>${escapeHtml(prospect.phone)}</span></span>` : '<span class="detail-muted">Sin teléfono registrado</span>'}</div>
    ${prospect.notes ? `<p class="card-notes">${escapeHtml(prospect.notes)}</p>` : '<p class="card-notes is-empty">Sin notas por ahora</p>'}
    <div class="card-footer"><div class="contact-meta"><span class="contact-dot ${isContacted(prospect) ? 'is-contacted' : ''}"></span><span>${contactMeta}</span></div>
      ${whatsApp ? `<a class="whatsapp-button" href="${escapeHtml(whatsApp)}" target="_blank" rel="noopener noreferrer" aria-label="Abrir WhatsApp para ${escapeHtml(prospect.name)}">${icon('send')}<span>WhatsApp</span></a>` : `<button class="whatsapp-button is-disabled" type="button" disabled title="Agrega un teléfono para habilitar WhatsApp">${icon('send')}<span>WhatsApp</span></button>`}
    </div>
    <button class="contact-action ${isContacted(prospect) ? 'is-done' : ''}" type="button" data-action="contact" data-id="${prospect.id}">${icon(isContacted(prospect) ? 'check' : 'send')}<span>${isContacted(prospect) ? 'Registrar nuevo contacto' : 'Marcar como contactado'}</span></button>
  </article>`
}

const render = () => {
  const visible = filteredProspects()
  const today = todayKey(Date.now())
  const contacted = prospects.filter((prospect) => isContacted(prospect))
  const responded = prospects.filter((prospect) => prospect.respondedAt)
  const sentToday = prospects.filter((prospect) => prospect.contactedAt && todayKey(prospect.contactedAt) === today).length
  const responseRate = contacted.length ? Math.round((responded.length / contacted.length) * 100) : 0
  const counts = {
    todos: prospects.length,
    pendiente: prospects.filter((prospect) => prospect.status === 'pendiente').length,
    contactado: prospects.filter((prospect) => ['contactado', 'negociacion'].includes(prospect.status)).length,
    respondio: prospects.filter((prospect) => prospect.status === 'respondio').length,
    cerrado: prospects.filter((prospect) => prospect.status === 'cerrado').length,
  }

  document.querySelector('#metric-total').textContent = prospects.length
  document.querySelector('#metric-pending').textContent = counts.pendiente
  document.querySelector('#metric-sent').textContent = sentToday
  document.querySelector('#metric-response').textContent = `${responseRate}%`
  document.querySelector('#metric-response-note').textContent = contacted.length ? `${responded.length} de ${contacted.length} prospectos contactados` : 'Sin contactos todavía'
  document.querySelector('#nav-count').textContent = prospects.length
  document.querySelector('#results-count').textContent = `${visible.length} ${visible.length === 1 ? 'resultado' : 'resultados'}`
  document.querySelector('#today-label').textContent = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
  Object.entries(counts).forEach(([key, count]) => {
    const target = document.querySelector(`#count-${key}`)
    if (target) target.textContent = count
  })
  document.querySelectorAll('.filter-button').forEach((button) => {
    const selected = button.dataset.filter === activeFilter
    button.classList.toggle('is-selected', selected)
    button.setAttribute('aria-pressed', String(selected))
  })

  if (visible.length) {
    grid.innerHTML = visible.map(renderCard).join('')
    grid.classList.remove('is-empty')
  } else {
    const hasFilter = prospects.length > 0
    grid.classList.add('is-empty')
    grid.innerHTML = `<div class="empty-state"><div class="empty-mark">${icon(hasFilter ? 'search' : 'briefcase')}</div><h3>${hasFilter ? 'No encontramos coincidencias' : 'Tu próxima gran oportunidad empieza aquí'}</h3><p>${hasFilter ? 'Prueba con otro nombre, nicho o estatus.' : 'Agrega un negocio local y lleva el seguimiento de cada conversación.'}</p>${hasFilter ? '<button class="button button-quiet" type="button" data-action="clear-filters">Limpiar búsqueda y filtros</button>' : `<button class="button button-primary" type="button" data-action="new">${icon('plus')}<span>Agregar primer negocio</span></button>`}</div>`
  }
}

const openForm = (prospect = null) => {
  editingId = prospect?.id || null
  form.reset()
  document.querySelector('#form-error').textContent = ''
  document.querySelector('#dialog-title').textContent = prospect ? 'Editar prospecto' : 'Nuevo prospecto'
  form.elements.name.value = prospect?.name || ''
  form.elements.niche.value = prospect?.niche || ''
  form.elements.status.value = prospect?.status || 'pendiente'
  form.elements.website.value = prospect?.website || ''
  form.elements.phone.value = prospect?.phone || ''
  form.elements.notes.value = prospect?.notes || ''
  dialog.showModal()
  form.elements.name.focus()
}

const updateStatus = async (prospect, status) => {
  const now = new Date().toISOString()
  const updated = {
    ...prospect,
    status,
    updatedAt: now,
    contactedAt: status !== 'pendiente' ? prospect.contactedAt || now : prospect.contactedAt,
    respondedAt: status === 'respondio' ? prospect.respondedAt || now : prospect.respondedAt,
  }
  if (!await saveProspect(updated)) return false
  Object.assign(prospect, updated)
  render()
  return true
}

document.querySelector('#today-label').textContent = formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })
document.querySelector('#theme-toggle').innerHTML = icon(theme === 'dark' ? 'sun' : 'moon')
document.querySelector('#theme-toggle').setAttribute('aria-label', theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro')
grid.classList.add('is-empty')
grid.innerHTML = '<div class="empty-state"><p>Sincronizando prospectos del equipo...</p></div>'
const refreshProspects = async () => {
  if (await loadProspects()) {
    render()
    return
  }
  grid.classList.add('is-empty')
  grid.innerHTML = `<div class="empty-state"><h3>No se pudo sincronizar</h3><p>Comprueba la conexión y las políticas de Supabase.</p><button class="button button-quiet" type="button" data-action="retry">Reintentar</button></div>`
}
void refreshProspects()

let realtimeRefreshTimer
const teamChannel = supabase
  .channel(`team-prospects-${team.id}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'prospects',
    filter: `team_id=eq.${team.id}`,
  }, () => {
    clearTimeout(realtimeRefreshTimer)
    realtimeRefreshTimer = setTimeout(async () => {
      if (await loadProspects()) render()
    }, 300)
  })
  .subscribe()

window.addEventListener('beforeunload', () => {
  clearTimeout(realtimeRefreshTimer)
  void supabase.removeChannel(teamChannel)
}, { once: true })

document.querySelector('#search-input').addEventListener('input', (event) => {
  searchTerm = event.target.value
  render()
})

document.querySelector('.filter-list').addEventListener('click', (event) => {
  const button = event.target.closest('[data-filter]')
  if (!button) return
  activeFilter = button.dataset.filter
  render()
})

document.querySelector('#app').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]')
  if (!button) return
  const prospect = prospects.find((item) => item.id === button.dataset.id)
  switch (button.dataset.action) {
    case 'new': openForm(); break
    case 'export': exportProspects(); break
    case 'edit': if (prospect) openForm(prospect); break
    case 'activity': if (prospect) await openActivity(prospect); break
    case 'invite':
      try { await navigator.clipboard.writeText(team.invite_code) } catch {}
      showToast(`Código de invitación: ${team.invite_code}`)
      break
    case 'team-activity': await openActivity(); break
    case 'logout': {
      const { error } = await supabase.auth.signOut()
      if (error) {
        showToast('No se pudo cerrar la sesión.')
        break
      }
      sessionStorage.removeItem('devly-workspace-context')
      window.location.reload()
      break
    }
    case 'contact':
      if (prospect) {
        const now = new Date().toISOString()
        const updated = {
          ...prospect,
          contactedAt: now,
          updatedAt: now,
          status: prospect.status === 'pendiente' ? 'contactado' : prospect.status,
        }
        if (!await saveProspect(updated)) break
        Object.assign(prospect, updated)
        render()
        showToast(`Contacto registrado para ${prospect.name}.`)
      }
      break
    case 'delete':
      if (prospect && confirm(`¿Eliminar a ${prospect.name}? Esta acción no se puede deshacer.`)) {
        const { error } = await supabase.from('prospects').delete().eq('team_id', team.id).eq('id', prospect.id)
        if (error) {
          showToast('No se pudo eliminar el negocio.')
          break
        }
        prospects = prospects.filter((item) => item.id !== prospect.id)
        render()
        showToast('Negocio eliminado.')
      }
      break
    case 'close': dialog.close(); break
    case 'close-activity': activityDialog.close(); break
    case 'clear-filters':
      activeFilter = 'todos'
      searchTerm = ''
      document.querySelector('#search-input').value = ''
      render()
      break
    case 'retry': void refreshProspects(); break
  }
})

grid.addEventListener('change', async (event) => {
  if (event.target.dataset.action !== 'status') return
  const prospect = prospects.find((item) => item.id === event.target.dataset.id)
  if (!prospect) return
  if (await updateStatus(prospect, event.target.value)) showToast(`Estatus actualizado: ${statusLabels[event.target.value]}.`)
})

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  const values = new FormData(form)
  const name = String(values.get('name') || '').trim()
  const niche = String(values.get('niche') || '').trim()
  const error = document.querySelector('#form-error')
  if (!name || !niche) {
    error.textContent = 'Completa el nombre del negocio y su nicho.'
    return
  }

  let website
  try {
    website = normalizeWebsite(String(values.get('website') || ''))
  } catch {
    error.textContent = 'Escribe una dirección web válida, como ejemplo.com.'
    return
  }

  const now = new Date().toISOString()
  const status = String(values.get('status'))
  const existing = prospects.find((item) => item.id === editingId)
  const prospect = {
    id: editingId || crypto.randomUUID(),
    name,
    niche,
    status,
    website,
    phone: String(values.get('phone') || '').trim(),
    notes: String(values.get('notes') || '').trim(),
    createdBy: existing?.createdBy || user.id,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    contactedAt: existing?.contactedAt || (status !== 'pendiente' ? now : null),
    respondedAt: existing?.respondedAt || (status === 'respondio' ? now : null),
  }
  if (!await saveProspect(prospect)) return
  prospects = editingId ? prospects.map((item) => item.id === editingId ? prospect : item) : [prospect, ...prospects]
  dialog.close()
  render()
  showToast(editingId ? 'Cambios guardados.' : 'Negocio agregado al tablero.')
})

dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close()
})

activityDialog.addEventListener('click', (event) => {
  if (event.target === activityDialog) activityDialog.close()
})

document.querySelector('#theme-toggle').addEventListener('click', () => {
  theme = theme === 'dark' ? 'light' : 'dark'
  document.documentElement.dataset.theme = theme
  localStorage.setItem(THEME_KEY, theme)
  const button = document.querySelector('#theme-toggle')
  button.innerHTML = icon(theme === 'dark' ? 'sun' : 'moon')
  button.setAttribute('aria-label', theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro')
  document.querySelector('.brand-logo').src = theme === 'dark' ? devlyLogo : devlyLogoLight
})

document.addEventListener('keydown', (event) => {
  if (event.key === '/' && !dialog.open && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
    event.preventDefault()
    document.querySelector('#search-input').focus()
  }
})
