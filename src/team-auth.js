import './style.css'
import { hasSupabaseConfig, supabase } from './lib/supabase.js'
import devlyLogo from './assets/devly-logo.png'
import devlyLogoLight from './assets/devly-logo-light.png'

const app = document.querySelector('#app')
const theme = localStorage.getItem('devly-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
document.documentElement.dataset.theme = theme

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
const logoForTheme = theme === 'dark' ? devlyLogo : devlyLogoLight

function renderMessage(title, description, detail = '') {
  app.innerHTML = `<main class="auth-screen"><section class="auth-layout"><aside class="auth-brand"><img class="auth-logo" src="${devlyLogo}" alt="Devly Web Studio"><span class="auth-brand-kicker">CRM DE PROSPECCIÓN</span><h1>Devly Studio</h1><p>Un espacio compartido para organizar prospectos y dar seguimiento a cada conversación.</p></aside><div class="auth-main"><div class="auth-panel"><div class="eyebrow"><span class="eyebrow-dot"></span> ACCESO AL EQUIPO</div><h2>${escapeHtml(title)}</h2><p class="auth-description">${escapeHtml(description)}</p>${detail}<div class="auth-message" id="auth-message" role="status" aria-live="polite"></div></div></div></section></main>`
}

function renderConfigurationRequired() {
  renderMessage(
    'Conecta tu espacio de trabajo',
    'Completa la configuración de Supabase para activar cuentas y sincronización de equipo.',
    `<div class="setup-instructions"><p>1. Copia <code>.env.example</code> a <code>.env.local</code>.</p><p>2. Agrega la URL y la clave publicable de tu proyecto Supabase.</p><p>3. Ejecuta <code>supabase/schema.sql</code> en el SQL Editor de Supabase.</p><p>Reinicia Vite después de agregar las variables. No uses la clave service_role en el navegador.</p></div>`,
  )
}

function renderAuth(mode = 'login', message = '', isError = false) {
  const isSignup = mode === 'signup'
  const logo = theme === 'dark' ? devlyLogo : devlyLogoLight
  app.innerHTML = `<main class="auth-screen"><section class="auth-layout"><aside class="auth-brand"><img class="auth-logo" src="${devlyLogo}" alt="Devly Web Studio"><span class="auth-brand-kicker">CRM DE PROSPECCIÓN</span><h1>Devly Studio</h1><p>Un espacio compartido para organizar prospectos y dar seguimiento a cada conversación.</p></aside><div class="auth-main"><div class="auth-panel"><img class="auth-mobile-logo" src="${logo}" alt="Devly Web Studio"><div class="eyebrow"><span class="eyebrow-dot"></span> ACCESO AL EQUIPO</div><h2>${isSignup ? 'Crea tu usuario' : 'Inicia sesión'}</h2><p class="auth-description">${isSignup ? 'Registra tu cuenta personal. Después podrás crear o unirte al espacio de tu equipo.' : 'Entra con tu cuenta para ver los prospectos compartidos de tu equipo.'}</p><div class="auth-tabs" role="tablist" aria-label="Acceso"><button type="button" role="tab" aria-selected="${!isSignup}" class="${!isSignup ? 'is-selected' : ''}" data-auth-mode="login">Iniciar sesión</button><button type="button" role="tab" aria-selected="${isSignup}" class="${isSignup ? 'is-selected' : ''}" data-auth-mode="signup">Crear cuenta</button></div><form id="auth-form" data-mode="${mode}"><label class="auth-field"><span>Correo electrónico</span><input type="email" name="email" autocomplete="email" required maxlength="254" placeholder="nombre@empresa.com"></label><label class="auth-field"><span>Contraseña</span><input type="password" name="password" autocomplete="${isSignup ? 'new-password' : 'current-password'}" required minlength="8" placeholder="Mínimo 8 caracteres"></label><button class="button button-primary auth-submit" type="submit">${isSignup ? 'Crear cuenta' : 'Entrar al equipo'}</button></form><p class="auth-message ${isError ? 'is-error' : ''}" id="auth-message" role="status" aria-live="polite">${escapeHtml(message)}</p></div></div></section></main>`
}

function renderTeamSetup(email, message = '', isError = false) {
  app.innerHTML = `<main class="auth-screen"><section class="auth-layout"><aside class="auth-brand"><img class="auth-logo" src="${devlyLogo}" alt="Devly Web Studio"><span class="auth-brand-kicker">CRM DE PROSPECCIÓN</span><h1>Tu equipo, en un solo lugar</h1><p>Tu cuenta está activa. Crea el espacio de tu agencia o únete al que ya creó tu responsable.</p></aside><div class="auth-main"><div class="auth-panel"><img class="auth-mobile-logo" src="${theme === 'dark' ? devlyLogo : devlyLogoLight}" alt="Devly Web Studio"><div class="eyebrow"><span class="eyebrow-dot"></span> ${escapeHtml(email)}</div><h2>Configura tu equipo</h2><p class="auth-description">Cada persona entra con su propio usuario y comparte los prospectos del mismo equipo.</p><form id="create-team-form"><label class="auth-field"><span>Nombre del equipo</span><input name="team_name" required minlength="2" maxlength="80" placeholder="Ej. Devly Studio"></label><button class="button button-primary auth-submit" type="submit">Crear espacio de equipo</button></form><div class="auth-divider"><span>o únete con una invitación</span></div><form id="join-team-form"><label class="auth-field"><span>Código del equipo</span><input name="invite_code" required minlength="6" maxlength="20" autocapitalize="characters" placeholder="AB12CD34EF"></label><button class="button button-quiet auth-submit" type="submit">Unirme al equipo</button></form><p class="auth-message ${isError ? 'is-error' : ''}" id="auth-message" role="status" aria-live="polite">${escapeHtml(message)}</p><button class="auth-signout" type="button" data-auth-action="signout">Cerrar sesión</button></div></div></section></main>`
}

function setMessage(message, isError = false) {
  const target = document.querySelector('#auth-message')
  if (!target) return
  target.textContent = message
  target.classList.toggle('is-error', isError)
}

function friendlyAuthError(error) {
  const message = String(error?.message || '').toLowerCase()
  if (message.includes('invalid login credentials')) return 'El correo o la contraseña no son correctos.'
  if (message.includes('user already registered')) return 'Ya existe una cuenta con ese correo. Inicia sesión.'
  if (message.includes('email not confirmed')) return 'Confirma tu correo electrónico antes de iniciar sesión.'
  if (message.includes('password')) return 'La contraseña debe tener al menos 8 caracteres.'
  return error?.message || 'No se pudo completar la operación. Inténtalo de nuevo.'
}

async function loadWorkspace() {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) {
    renderAuth('login', friendlyAuthError(sessionError), true)
    return
  }
  if (!session) {
    renderAuth()
    return
  }

  renderMessage('Cargando tu equipo', 'Estamos verificando tu acceso y sincronizando el espacio de trabajo.')
  const { data: membership, error: membershipError } = await supabase
    .from('team_members')
    .select('team_id, role')
    .eq('user_id', session.user.id)
    .maybeSingle()

  if (membershipError) {
    renderAuth('login', 'No se encontró el esquema de equipo. Ejecuta supabase/schema.sql en el SQL Editor de tu proyecto.', true)
    return
  }
  if (!membership) {
    renderTeamSetup(session.user.email)
    return
  }

  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('id, name, invite_code')
    .eq('id', membership.team_id)
    .single()

  if (teamError || !team) {
    renderAuth('login', 'No se pudo cargar el equipo. Revisa las políticas RLS de Supabase.', true)
    return
  }

  sessionStorage.setItem('devly-workspace-context', JSON.stringify({
    user: { id: session.user.id, email: session.user.email },
    membership,
    team,
  }))
  await import('./main.js')
}

if (!hasSupabaseConfig) {
  renderConfigurationRequired()
} else {
  app.addEventListener('click', async (event) => {
    const modeButton = event.target.closest('[data-auth-mode]')
    if (modeButton) {
      renderAuth(modeButton.dataset.authMode)
      return
    }
    if (event.target.closest('[data-auth-action="signout"]')) {
      await supabase.auth.signOut()
      renderAuth()
    }
  })

  app.addEventListener('submit', async (event) => {
    event.preventDefault()
    const form = event.target
    const values = new FormData(form)
    const submitButton = form.querySelector('button[type="submit"]')
    submitButton.disabled = true
    const originalLabel = submitButton.textContent
    submitButton.textContent = 'Un momento...'

    try {
      if (form.id === 'auth-form') {
        const email = String(values.get('email') || '').trim().toLowerCase()
        const password = String(values.get('password') || '')
        if (form.dataset.mode === 'signup') {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: window.location.origin },
          })
          if (error) throw error
          if (data.session) await loadWorkspace()
          else renderAuth('login', 'Cuenta creada. Confirma tu correo y luego inicia sesión para configurar tu equipo.')
        } else {
          const { error } = await supabase.auth.signInWithPassword({ email, password })
          if (error) throw error
          await loadWorkspace()
        }
      } else if (form.id === 'create-team-form') {
        const teamName = String(values.get('team_name') || '').trim()
        const { error } = await supabase.rpc('create_team', { team_name_input: teamName })
        if (error) throw error
        await loadWorkspace()
      } else if (form.id === 'join-team-form') {
        const inviteCode = String(values.get('invite_code') || '').trim().toUpperCase()
        const { error } = await supabase.rpc('join_team', { invite_code_input: inviteCode })
        if (error) throw error
        await loadWorkspace()
      }
    } catch (error) {
      setMessage(friendlyAuthError(error), true)
      submitButton.disabled = false
      submitButton.textContent = originalLabel
    }
  })

  void loadWorkspace()
}
