import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  ArrowDown, ArrowRight, ArrowUpRight, BriefcaseBusiness, Check, ChevronDown,
  CircleHelp, Code2, Eye, FileText, Globe2, GraduationCap, ImagePlus, Layers2, Link2,
  LoaderCircle, LogOut, Menu, Palette, Plus, Sparkles, Trash2, UserRound, X,
} from 'lucide-react'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null
const portfolioTable = 'folio_foundry_portfolios'
const photoBucket = 'folio-foundry-photos'
const templates = [
  { id: 'simple', name: 'Simple', style: 'Professional', description: 'A clear, classic layout with calm colors and easy-to-read sections.', accent: 'SAGE' },
  { id: 'modern', name: 'Modern', style: 'Card-based', description: 'A bold, structured layout with visual project cards and crisp details.', accent: 'BLUE' },
  { id: 'creative', name: 'Creative', style: 'Expressive', description: 'A playful, asymmetrical arrangement with vivid color and personality.', accent: 'VIOLET' },
]

const emptyPortfolio = {
  fullName: '', email: '', phone: '', address: '', about: '',
  education: [], skills: [], projects: [], experience: [], links: [],
  image: '',
}
const defaultRows = {
  education: { school: '', degree: '', year: '' },
  projects: { name: '', description: '', url: '' },
  experience: { role: '', company: '', period: '', description: '' },
  links: { label: '', url: '' },
}
const templateClasses = { simple: 'theme-simple', modern: 'theme-modern', creative: 'theme-creative' }

const cleanSlug = (value) => value.toLowerCase().trim()
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)
const safeHref = (value) => /^https?:\/\//i.test(value || '') ? value : '#'

function usePortfolioStore(user) {
  const [ready, setReady] = useState(false)
  const userId = user.id
  const [portfolioId, setPortfolioId] = useState(null)
  const [portfolio, setPortfolio] = useState(emptyPortfolio)
  const [template, setTemplate] = useState('simple')
  const [slug, setSlug] = useState('')
  const [published, setPublished] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [hasSaved, setHasSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const { data, error: loadError } = await supabase
          .from(portfolioTable).select('*').eq('owner_id', userId).order('created_at').limit(1).maybeSingle()
        if (loadError) throw loadError
        if (data) {
          setPortfolioId(data.id)
          setPortfolio({ ...emptyPortfolio, ...(data.content || {}), fullName: data.full_name || data.content?.fullName || '', image: data.profile_image || data.content?.image || '' })
          setTemplate(data.template)
          setSlug(data.slug)
          setPublished(data.is_published)
          setHasSaved(true)
        }
      } catch (loadError) {
        if (active) setError(`Database connection failed: ${loadError.message}`)
      } finally {
        if (active) setReady(true)
      }
    }
    load()
    return () => { active = false }
  }, [userId])

  const updatePortfolio = (field, value) => {
    setPortfolio((current) => ({ ...current, [field]: value }))
    setDirty(true)
    setPublished(false)
  }

  async function uploadPhoto(file) {
    if (!file.type.startsWith('image/')) throw new Error('Choose an image file.')
    if (file.size > 5 * 1024 * 1024) throw new Error('Your photo must be smaller than 5 MB.')
    const optimizedFile = await new Promise((resolve, reject) => {
      const image = new Image()
      const objectUrl = URL.createObjectURL(file)
      image.onload = () => {
        URL.revokeObjectURL(objectUrl)
        const scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(image.naturalWidth * scale)
        canvas.height = Math.round(image.naturalHeight * scale)
        canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((blob) => {
          if (!blob) reject(new Error('Could not prepare this photo. Try another image.'))
          else resolve(new File([blob], 'profile.jpg', { type: 'image/jpeg' }))
        }, 'image/jpeg', 0.84)
      }
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        reject(new Error('Could not read this photo. Try a JPG, PNG, or WEBP image.'))
      }
      image.src = objectUrl
    })
    const path = `${userId}/${crypto.randomUUID()}.jpg`
    const { error: uploadError } = await supabase.storage.from(photoBucket).upload(path, optimizedFile, { upsert: true, contentType: 'image/jpeg' })
    if (uploadError) throw uploadError
    const { data } = supabase.storage.from(photoBucket).getPublicUrl(path)
    updatePortfolio('image', data.publicUrl)
  }

  async function save({ publish = false } = {}) {
    setError('')
    const nextSlug = cleanSlug(slug || portfolio.fullName || 'my-portfolio')
    if (publish && !portfolio.fullName.trim()) throw new Error('Add your full name before publishing.')
    if (!nextSlug) throw new Error('Add a name to create a portfolio link.')
    const nextPublished = publish
    const values = {
      owner_id: userId, slug: nextSlug, full_name: portfolio.fullName.trim(),
      template, content: portfolio, profile_image: portfolio.image || null,
      is_published: nextPublished, updated_at: new Date().toISOString(),
    }
    const query = portfolioId
    ? supabase.from(portfolioTable).update(values).eq('id', portfolioId).select('id').single()
    : supabase.from(portfolioTable).insert(values).select('id').single()
    const { data, error: saveError } = await query
    if (saveError) throw saveError
    setPortfolioId(data.id)
    setSlug(nextSlug)
    setPublished(nextPublished)
    setDirty(false)
    setHasSaved(true)
  }

  async function remove() {
    setError('')
    let photoCleanupError = ''
    if (!portfolioId) throw new Error('Could not find a saved portfolio to delete.')
    const { data: deleted, error: deleteError } = await supabase.from(portfolioTable)
      .delete().eq('id', portfolioId).eq('owner_id', userId).select('id').maybeSingle()
    if (deleteError) throw deleteError
    if (!deleted) throw new Error('No portfolio was deleted. Refresh the page and try again.')
    const photoPrefix = `${supabaseUrl}/storage/v1/object/public/${photoBucket}/`
    const photoPath = portfolio.image?.startsWith(photoPrefix) ? portfolio.image.slice(photoPrefix.length) : ''
    if (photoPath) {
      const { error: storageError } = await supabase.storage.from(photoBucket).remove([decodeURIComponent(photoPath)])
      if (storageError) photoCleanupError = storageError.message
    }
    setPortfolioId(null)
    setPortfolio(emptyPortfolio)
    setTemplate('simple')
    setSlug('')
    setPublished(false)
    setDirty(false)
    setHasSaved(false)
    return { photoCleanupError }
  }

  const chooseTemplate = (value) => {
    setTemplate(value)
    setDirty(true)
    setPublished(false)
  }
  const editSlug = (value) => {
    setSlug(value)
    setDirty(true)
    setPublished(false)
  }

  return { ready, portfolio, updatePortfolio, template, setTemplate: chooseTemplate, slug, setSlug: editSlug, published, dirty, hasSaved, error, setError, save, remove, uploadPhoto }
}

function RowEditor({ type, items, onChange }) {
  const fields = {
    education: [['school', 'School / institution', 'e.g. University of the Philippines'], ['degree', 'Degree / course', 'e.g. BS Information Technology'], ['year', 'Year', 'e.g. 2022 – 2026']],
    projects: [['name', 'Project name', 'e.g. Mindful — habit tracker'], ['description', 'What did you make?', 'A short description of your project'], ['url', 'Project link', 'https://']],
    experience: [['role', 'Your role', 'e.g. Product design intern'], ['company', 'Company / organization', 'e.g. Studio North'], ['period', 'When', 'e.g. Jun 2024 – Present'], ['description', 'What did you do?', 'A little about your contribution']],
    links: [['label', 'Link label', 'e.g. LinkedIn'], ['url', 'URL', 'https://']],
  }[type]
  return <div className="row-stack">{items.map((item, index) => (
    <div className="repeat-card" key={`${type}-${index}`}>
      <div className="repeat-top"><span className="repeat-number">{String(index + 1).padStart(2, '0')}</span><button className="icon-button danger" type="button" aria-label={`Remove ${type} entry`} onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={15} /></button></div>
      <div className="repeat-fields">{fields.map(([field, label, placeholder]) => <label className={field === 'description' ? 'field field-wide' : 'field'} key={field}>{label}<input value={item[field] || ''} placeholder={placeholder} onChange={(event) => onChange(items.map((row, itemIndex) => itemIndex === index ? { ...row, [field]: event.target.value } : row))} /></label>)}</div>
    </div>
  ))}</div>
}

function PortfolioPage({ portfolio, template, isPublic = false, onClose }) {
  const theme = template || 'simple'
  return <div className={`portfolio-page ${templateClasses[theme] || templateClasses.simple}`}>
    {isPublic && <div className="public-ribbon"><span><Sparkles size={14} /> Made with Folio Foundry</span><a href="/" className="made-link">Make your own <ArrowUpRight size={14} /></a></div>}
    <header className="portfolio-nav"><a href="#top" className="portfolio-brand"><span className="brand-mark">f.</span> {portfolio.fullName || 'Your name'}</a><nav>{portfolio.links?.filter((link) => safeHref(link.url) !== '#').slice(0, 3).map((link, index) => <a key={index} href={safeHref(link.url)} target="_blank" rel="noreferrer">{link.label || 'Connect'}</a>)}<a href="#contact">Say hello <ArrowUpRight size={14} /></a></nav>{onClose && <button className="preview-close" onClick={onClose} aria-label="Close preview"><X size={18} /></button>}</header>
    <main id="top">
      <section className="portfolio-hero">
        <div className="portfolio-intro"><span className="eyebrow"><span className="live-dot" /> {portfolio.address || 'CREATIVE PORTFOLIO'}</span><h1>{portfolio.fullName || 'Your name'}<span className="hero-period">.</span></h1><p className="portfolio-about">{portfolio.about || 'A little about you goes here. Tell the world what you care about, what you make, and what makes your work yours.'}</p><a className="portfolio-cta" href="#work">Explore my work <ArrowDown size={15} /></a></div>
        <div className="portrait-frame">{portfolio.image ? <img src={portfolio.image} alt={portfolio.fullName || 'Profile'} /> : <div className="portrait-placeholder"><UserRound size={68} strokeWidth={1} /><span>YOUR PORTRAIT</span></div>}<span className="portrait-stamp">OPEN TO<br />OPPORTUNITIES <ArrowUpRight size={14} /></span></div>
        <span className="hero-index">01 — INTRODUCTION</span>
      </section>
      {!!portfolio.skills?.length && <section className="portfolio-skills"><span className="eyebrow">THINGS I DO WELL</span><div>{portfolio.skills.map((skill, index) => <span key={`${skill}-${index}`}>{skill}</span>)}</div></section>}
      <section className="portfolio-work" id="work"><div className="section-heading"><div><span className="eyebrow">A FEW FAVORITES</span><h2>Selected work<span className="hero-period">.</span></h2></div><span className="project-count">{String(portfolio.projects?.length || 0).padStart(2, '0')} PROJECTS</span></div>
        {portfolio.projects?.length ? <div className="work-grid">{portfolio.projects.map((project, index) => <article className={`work-card work-card-${index % 3}`} key={`${project.name}-${index}`}><div className="work-visual"><span className="work-index">0{index + 1}</span><Layers2 size={34} strokeWidth={1.2} /><ArrowUpRight size={19} /></div><div className="work-meta"><div><h3>{project.name || 'Untitled project'}</h3><p>{project.description || 'A project made with care.'}</p></div>{safeHref(project.url) !== '#' && <a href={safeHref(project.url)} target="_blank" rel="noreferrer" aria-label={`Open ${project.name}`}><ArrowUpRight size={18} /></a>}</div></article>)}</div> : <div className="portfolio-empty">The best work is still ahead. Check back soon.</div>}
      </section>
      {!!portfolio.experience?.length && <section className="portfolio-experience"><div className="section-heading"><div><span className="eyebrow">THE PATH SO FAR</span><h2>Experience<span className="hero-period">.</span></h2></div></div><div className="timeline">{portfolio.experience.map((item, index) => <article className="timeline-item" key={`${item.company}-${index}`}><span className="timeline-period">{item.period || 'EXPERIENCE'}</span><div><h3>{item.role || 'Role'} <span>at {item.company || 'Company'}</span></h3><p>{item.description}</p></div></article>)}</div></section>}
      {!!portfolio.education?.length && <section className="portfolio-education"><span className="eyebrow">ALWAYS LEARNING</span>{portfolio.education.map((item, index) => <div className="education-line" key={`${item.school}-${index}`}><div><h3>{item.degree || 'Degree'}</h3><p>{item.school || 'Institution'}</p></div><span>{item.year}</span></div>)}</section>}
      <section className="portfolio-contact" id="contact"><span className="eyebrow"><span className="live-dot" /> HAVE SOMETHING IN MIND?</span><h2>Let's make<br />something <em>matter.</em></h2><a className="contact-email" href={portfolio.email ? `mailto:${portfolio.email}` : '#top'}>{portfolio.email || 'your.email@example.com'} <ArrowUpRight size={20} /></a>{portfolio.phone && <a className="contact-phone" href={`tel:${portfolio.phone}`}>{portfolio.phone}</a>}</section>
    </main>
    <footer className="portfolio-footer"><span>© {new Date().getFullYear()} {portfolio.fullName || 'Your name'}</span><span>MADE WITH INTENTION, IN {portfolio.address || 'YOUR CITY'}</span><div>{portfolio.links?.filter((link) => safeHref(link.url) !== '#').map((link, index) => <a key={index} href={safeHref(link.url)} target="_blank" rel="noreferrer">{link.label || 'Link'} <ArrowUpRight size={12} /></a>)}</div></footer>
  </div>
}

function PublicPortfolio({ slug }) {
  const [record, setRecord] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    if (!supabase) { setError('Online portfolios need a Supabase connection.'); return () => { active = false } }
    supabase.from(portfolioTable).select('template,content,full_name,profile_image').eq('slug', slug).eq('is_published', true).maybeSingle()
      .then(({ data, error: requestError }) => {
        if (!active) return
        if (requestError) setError(`Could not load this portfolio: ${requestError.message}`)
        else if (!data) setError('This portfolio is not available. The owner may not have published it yet.')
        else setRecord({ ...data.content, template: data.template, fullName: data.full_name || data.content?.fullName || '', image: data.profile_image || data.content?.image || '' })
      })
    return () => { active = false }
  }, [slug])
  if (record) return <PortfolioPage portfolio={record} template={record.template || 'simple'} isPublic />
  return <div className="public-state"><div className="brand-mark">f.</div>{error ? <><h1>Portfolio not found.</h1><p>{error}</p></> : <><LoaderCircle className="spin" /><p>Opening this portfolio…</p></>}</div>
}

function App() {
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true)
      return undefined
    }
    let active = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      setUser(session?.user?.is_anonymous ? null : session?.user || null)
      setAuthError('')
      setAuthReady(true)
    })
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!active) return
      if (error) setAuthError(`Could not check your sign-in status: ${error.message}`)
      else setUser(session?.user?.is_anonymous ? null : session?.user || null)
      setAuthReady(true)
    }).catch((error) => {
      if (!active) return
      setAuthError(`Could not check your sign-in status: ${error.message}`)
      setAuthReady(true)
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!authReady) return
    if (user && window.location.pathname === '/login') window.history.replaceState(null, '', '/')
    else if (!user && window.location.pathname !== '/login') window.history.replaceState(null, '', '/login')
  }, [authReady, user])

  if (!authReady) return <div className="loading-screen"><div className="brand-mark">f.</div><LoaderCircle className="spin" /><span>CHECKING YOUR SIGN-IN</span></div>
  if (!user) return <LoginPage authError={authError} />
  return <PortfolioApp user={user} />
}

function LoginPage({ authError }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (!supabase) return
    setSubmitting(true)
    setError('')
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (signInError) throw signInError
      window.location.replace('/')
    } catch (signInError) {
      setError(`Sign in failed: ${signInError.message}`)
      setSubmitting(false)
    }
  }

  return <main className="login-page">
    <section className="login-card" aria-labelledby="login-title">
      <a className="sidebar-logo login-logo" href="/" aria-label="Folio Foundry"><span className="brand-mark">f.</span><span>folio<span className="logo-light">foundry</span><small>YOUR PORTFOLIO, MADE PERSONAL</small></span></a>
      <span className="eyebrow"><Sparkles size={14} /> YOUR NEXT CHAPTER STARTS HERE</span>
      <h1 id="login-title">Welcome <em>back.</em></h1>
      <p className="login-intro">Sign in to continue to your portfolio workspace.</p>
      {!supabase && <div className="login-message" role="alert">Supabase is not configured. Add your project URL and anon key to the environment before signing in.</div>}
      {(error || authError) && <div className="login-message" role="alert">{error || authError}</div>}
      <form className="login-form" onSubmit={handleSubmit}>
        <label className="field">Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required disabled={!supabase || submitting} /></label>
        <label className="field">Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required disabled={!supabase || submitting} /></label>
        <button className="button button-dark login-submit" type="submit" disabled={!supabase || submitting}>{submitting ? <><LoaderCircle size={16} className="spin" /> Signing in…</> : <>Sign in <ArrowRight size={15} /></>}</button>
      </form>
      <div className="login-footnote"><span className="live-dot" /> YOUR IDEAS, YOUR SPACE.</div>
    </section>
    <aside className="login-art" aria-hidden="true"><span className="login-art-orbit" /><span className="login-art-mark">f.</span><span className="login-art-note">A LITTLE<br />MORE YOU ↗</span><div><span className="eyebrow">A SPACE TO TELL YOUR STORY</span><p>Your work,<br />beautifully <em>told.</em></p></div></aside>
  </main>
}

function PortfolioApp({ user }) {
  const store = usePortfolioStore(user)
  const { portfolio, updatePortfolio } = store
  const [activeTab, setActiveTab] = useState('about')
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [notice, setNotice] = useState('')
  const [mobileMenu, setMobileMenu] = useState(false)
  const [skillInput, setSkillInput] = useState('')
  const imageRef = useRef(null)
  const path = window.location.pathname.match(/^\/p\/([^/]+)\/?$/)
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (visible) setActiveTab(visible.target.id)
    }, { rootMargin: '-95px 0px -68% 0px' })
    document.querySelectorAll('.builder-content .editor-section[id]').forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [])
  const completeness = useMemo(() => {
    const checks = [portfolio.fullName, portfolio.email, portfolio.about, portfolio.image, portfolio.education.length, portfolio.skills.length, portfolio.projects.length, portfolio.experience.length]
    return Math.round(checks.filter(Boolean).length / checks.length * 100)
  }, [portfolio])
  if (path) return <PublicPortfolio slug={decodeURIComponent(path[1])} />

  const sections = [
    { id: 'home', label: 'Home', icon: Sparkles },
    { id: 'about', label: 'About me', icon: UserRound },
    { id: 'education', label: 'Education', icon: GraduationCap },
    { id: 'skills', label: 'Skills', icon: Code2 },
    { id: 'projects', label: 'Projects', icon: Layers2 },
    { id: 'experience', label: 'Experience', icon: BriefcaseBusiness },
    { id: 'links', label: 'Links & socials', icon: Link2 },
    { id: 'design', label: 'Choose a design', icon: Palette },
    { id: 'manage', label: 'Manage portfolio', icon: Globe2 },
  ]
  const addRow = (type) => updatePortfolio(type, [...portfolio[type], { ...defaultRows[type] }])
  const setRows = (type, rows) => updatePortfolio(type, rows)

  async function handleSave(publish = false) {
    setSaving(true)
    setNotice('')
    store.setError('')
    try {
      await store.save({ publish })
      if (publish) setNotice('Your portfolio is live. Copy the link and share it with the world.')
      else setNotice('All your changes are saved.')
    } catch (error) {
      store.setError(error.message)
    } finally {
      setSaving(false)
    }
  }
  async function handleGenerate() {
    setSaving(true)
    setNotice('')
    store.setError('')
    try {
      await store.save()
      setPreview(true)
      setNotice('Portfolio saved. You can preview it here, then publish it when you’re ready.')
    } catch (error) {
      store.setError(`Could not generate your portfolio: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }
  async function handlePhoto(file) {
    if (!file) return
    try {
      await store.uploadPhoto(file)
    } catch (error) {
      store.setError(error.message)
    }
  }
  async function handleDelete() {
    setSaving(true)
    store.setError('')
    try {
      const result = await store.remove()
      setConfirmDelete(false)
      setNotice(result.photoCleanupError
        ? `Your portfolio was deleted, but its profile photo could not be removed: ${result.photoCleanupError}`
        : 'Your portfolio has been deleted.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      store.setError(`Could not delete the portfolio: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }
  function goToSection(id) {
    setActiveTab(id)
    setMobileMenu(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  function addSkill(event) {
    event.preventDefault()
    const skill = skillInput.trim()
    if (!skill || portfolio.skills.some((item) => item.toLowerCase() === skill.toLowerCase())) return
    updatePortfolio('skills', [...portfolio.skills, skill])
    setSkillInput('')
  }

  async function handleSignOut() {
    try {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) throw signOutError
      window.location.replace('/login')
    } catch (signOutError) {
      store.setError(`Could not sign out: ${signOutError.message}`)
    }
  }

  if (!store.ready) return <div className="loading-screen"><div className="brand-mark">f.</div><LoaderCircle className="spin" /><span>MAKING ROOM FOR YOUR STORY</span></div>

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
      <a className="sidebar-logo" href="/" aria-label="Folio Foundry home"><span className="brand-mark">f.</span><span>folio<span className="logo-light">foundry</span><small>YOUR PORTFOLIO, MADE PERSONAL</small></span></a>
      <div className="workspace-label">YOUR WORKSPACE <ChevronDown size={14} /></div>
      <div className="workspace-card"><div className="workspace-avatar">{portfolio.fullName?.trim()?.[0]?.toUpperCase() || <UserRound size={17} />}</div><div><strong>{portfolio.fullName || 'Your portfolio'}</strong><span>{store.published ? 'Published website' : 'Personal workspace'}</span></div><span className="workspace-status" title={store.published ? 'Published' : 'Draft'} /></div>
      <div className="sidebar-heading">YOUR PORTFOLIO</div>
      <nav className="sidebar-nav" aria-label="Portfolio sections">{sections.map(({ id, label, icon: Icon }, index) => <button key={id} className={`nav-item ${activeTab === id ? 'nav-active' : ''}`} onClick={() => goToSection(id)}><Icon size={17} strokeWidth={1.8} /><span>{label}</span><span className="nav-num">{String(index + 1).padStart(2, '0')}</span></button>)}</nav>
      <div className="sidebar-bottom"><div className="progress-card"><div className="progress-top"><span>YOUR STORY SO FAR</span><span>{completeness}%</span></div><div className="progress-track"><span style={{ width: `${completeness}%` }} /></div><p>A few more details make your portfolio shine.</p></div><a className="help-link" href="mailto:hello@foliofoundry.site"><CircleHelp size={16} /> Need a little help?</a><button className="sidebar-signout" onClick={handleSignOut}><LogOut size={15} /> Sign out</button><div className="sidebar-footnote"><span className="live-dot" /> YOUR IDEAS, YOUR SPACE.</div></div>
    </aside>
    {mobileMenu && <button className="mobile-scrim" onClick={() => setMobileMenu(false)} aria-label="Close navigation" />}

    <main className="builder-main">
      <header className="topbar"><div className="topbar-left"><button className="mobile-menu-button" onClick={() => setMobileMenu(true)} aria-label="Open navigation"><Menu /></button><span className="breadcrumb">My workspace <span>/</span> <strong>Portfolio builder</strong></span></div><div className="topbar-actions"><span className={`save-status ${saving ? '' : store.dirty ? 'is-dirty' : 'is-saved'}`}>{saving ? <LoaderCircle size={14} className="spin" /> : store.dirty ? <CircleHelp size={14} /> : store.published ? <Globe2 size={14} /> : <Check size={14} />}{saving ? 'Saving changes…' : store.dirty ? 'Unsaved changes' : store.published ? 'Published' : store.hasSaved ? 'Changes saved' : 'Ready to begin'}</span><button className="button button-outline button-preview" title="Preview portfolio" aria-label="Preview portfolio" onClick={() => setPreview(true)}><Eye size={16} /> Preview</button><button className="button button-outline button-save" title="Save draft" aria-label="Save draft" onClick={() => handleSave(false)} disabled={saving}><Check size={15} /> Save draft</button><button className="button button-dark button-publish" title="Publish portfolio" aria-label="Publish portfolio" onClick={() => handleSave(true)} disabled={saving}><Globe2 size={16} /> {store.published ? 'Update site' : 'Publish site'} <ArrowUpRight size={14} /></button><button className="button button-outline button-signout" title="Sign out" aria-label="Sign out" onClick={handleSignOut}><LogOut size={15} /><span>Sign out</span></button></div></header>
      <div className="builder-content">
        <section className="welcome-block" id="home"><div className="welcome-copy"><span className="eyebrow"><Sparkles size={14} /> YOUR NEXT CHAPTER STARTS HERE</span><h1>A portfolio that feels<br />like <em>you.</em></h1><p>Bring your story, your work, and your next big opportunity into focus.</p><button className="button button-dark welcome-cta" onClick={() => goToSection('about')}>{store.hasSaved ? 'Edit your portfolio' : 'Create portfolio'} <ArrowRight size={15} /></button></div><div className="welcome-art" aria-hidden="true"><span className="art-orbit orbit-one" /><span className="art-orbit orbit-two" /><span className="art-sparkle"><Sparkles size={20} /></span><span className="art-note">A LITTLE<br />MORE YOU ↗</span><span className="art-mark">f.</span><span className="art-dot dot-one" /><span className="art-dot dot-two" /></div></section>
        {(store.error || notice) && <div className={`notice ${store.error ? 'notice-error' : 'notice-success'}`} role="status">{store.error ? <CircleHelp size={16} /> : <Check size={16} />}<span>{store.error || notice}{notice.includes('Your portfolio is live') && store.published && <button className="copy-link" onClick={async () => { try { await navigator.clipboard.writeText(`${window.location.origin}/p/${store.slug}`); setNotice('Your portfolio link has been copied to the clipboard.') } catch { store.setError('Could not copy automatically. Your link is shown in the design section.') } }}><Link2 size={13} /> Copy link</button>}{store.error?.includes('unique') && ' Try a different custom website link.'}</span><button className="notice-dismiss" onClick={() => { store.setError(''); setNotice('') }} aria-label="Dismiss notice"><X size={15} /></button></div>}
        <section className="editor-section section-about" id="about"><SectionHead number="01" icon={UserRound} title="A little about you" subtitle="Start with the basics. Every good introduction starts somewhere."/><div className="editor-grid about-grid"><div className="field-stack"><label className="field">Full name <span className="required">*</span><input value={portfolio.fullName} onChange={(event) => updatePortfolio('fullName', event.target.value)} placeholder="The name people know you by" /></label><label className="field">Email address<input type="email" value={portfolio.email} onChange={(event) => updatePortfolio('email', event.target.value)} placeholder="you@example.com" /></label><label className="field">Contact number<input type="tel" value={portfolio.phone} onChange={(event) => updatePortfolio('phone', event.target.value)} placeholder="+63 912 345 6789" /></label><label className="field">Address <span className="field-note">City or region is plenty</span><input value={portfolio.address} onChange={(event) => updatePortfolio('address', event.target.value)} placeholder="Quezon City, Philippines" /></label></div><div className="photo-field"><span className="field-label">Profile picture</span><button type="button" className={`photo-drop ${portfolio.image ? 'photo-has-image' : ''}`} onClick={() => imageRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); handlePhoto(event.dataTransfer.files?.[0]) }}>{portfolio.image ? <><img src={portfolio.image} alt="Portfolio profile" /><span className="photo-change"><ImagePlus size={15} /> Change photo</span></> : <><div className="photo-icon"><ImagePlus size={20} /></div><strong>Drop in a photo of you</strong><span>or click to choose a file</span><small>JPG, PNG or WEBP · up to 5 MB</small></>}<input ref={imageRef} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { handlePhoto(event.target.files?.[0]); event.target.value = '' }} /></button></div><label className="field field-full">About me <span className="field-note">A few sentences in your own words</span><textarea rows="5" maxLength="1200" value={portfolio.about} onChange={(event) => updatePortfolio('about', event.target.value)} placeholder="What do you care about? What kind of work gets you out of bed in the morning? Here’s your space to tell that story." /><span className="character-count">{portfolio.about.length} / 1,200</span></label></div></section>

        <section className="editor-section" id="education"><SectionHead number="02" icon={GraduationCap} title="The things you’ve learned" subtitle="School, a course, a long afternoon on YouTube — it all counts."/><RowEditor type="education" items={portfolio.education} onChange={(rows) => setRows('education', rows)} /><button className="add-entry" onClick={() => addRow('education')}><Plus size={16} /> Add education</button></section>

        <section className="editor-section" id="skills"><SectionHead number="03" icon={Code2} title="Your kind of magic" subtitle="Name the tools, skills, and small superpowers you bring to the table."/><form className="skill-entry" onSubmit={addSkill}><input value={skillInput} onChange={(event) => setSkillInput(event.target.value)} placeholder="Type a skill and press Enter — e.g. Figma" aria-label="Add a skill" /><button type="submit" aria-label="Add skill"><Plus size={16} /></button></form><div className="skill-chips">{portfolio.skills.map((skill, index) => <span className="skill-chip" key={`${skill}-${index}`}>{skill}<button type="button" onClick={() => updatePortfolio('skills', portfolio.skills.filter((_, skillIndex) => skillIndex !== index))} aria-label={`Remove ${skill}`}><X size={13} /></button></span>)}</div></section>

        <section className="editor-section" id="projects"><SectionHead number="04" icon={Layers2} title="Things you’ve made" subtitle="Big launch or tiny experiment — show the work you’re proud of."/><RowEditor type="projects" items={portfolio.projects} onChange={(rows) => setRows('projects', rows)} /><button className="add-entry" onClick={() => addRow('projects')}><Plus size={16} /> Add a project</button></section>

        <section className="editor-section" id="experience"><SectionHead number="05" icon={BriefcaseBusiness} title="Where you’ve been" subtitle="Work, volunteering, internships — the experience that shaped your craft."/><RowEditor type="experience" items={portfolio.experience} onChange={(rows) => setRows('experience', rows)} /><button className="add-entry" onClick={() => addRow('experience')}><Plus size={16} /> Add experience</button></section>

        <section className="editor-section" id="links"><SectionHead number="06" icon={Link2} title="Find me around the internet" subtitle="Give people another place to say hello, see what you’re up to, or start a conversation."/><RowEditor type="links" items={portfolio.links} onChange={(rows) => setRows('links', rows)} /><button className="add-entry" onClick={() => addRow('links')}><Plus size={16} /> Add a link</button></section>

        <section className="editor-section design-section" id="design"><SectionHead number="07" icon={Palette} title="Find your look" subtitle="Three starting points. Your story, in its own light."/><label className="field slug-field">Your portfolio link <span className="field-note">A short, memorable address</span><div className="slug-input"><span>{window.location.origin}/p/</span><input value={store.slug || cleanSlug(portfolio.fullName)} onChange={(event) => store.setSlug(cleanSlug(event.target.value))} placeholder="your-name" aria-label="Portfolio URL slug" /></div></label><div className="template-grid">{templates.map((item) => <button className={`template-card ${store.template === item.id ? 'template-selected' : ''}`} key={item.id} onClick={() => store.setTemplate(item.id)}><TemplateMini template={item.id} /><div className="template-info"><div><h3>{item.name}</h3><span>{item.style} · {item.accent}</span></div><span className={`template-radio ${store.template === item.id ? 'radio-checked' : ''}`}>{store.template === item.id && <Check size={12} />}</span></div><p>{item.description}</p></button>)}</div></section>

        <section className="editor-section manage-section" id="manage"><SectionHead number="08" icon={Globe2} title="Your portfolio, at a glance" subtitle="Preview, update, and manage the portfolio you’ve saved." />{store.hasSaved ? <div className="manage-card"><div className="manage-card-icon"><FileText size={19} /></div><div className="manage-card-info"><span className="eyebrow">{store.published ? 'LIVE PORTFOLIO' : 'SAVED DRAFT'} · {templates.find((item) => item.id === store.template)?.name}</span><h3>{portfolio.fullName || 'Your portfolio'}</h3><p>{store.published ? `${window.location.origin}/p/${store.slug}` : 'Your latest changes are saved. Preview or continue editing any time.'}</p></div><div className="manage-card-actions"><button className="button button-outline" onClick={() => setPreview(true)}><Eye size={15} /> View portfolio</button>{store.published && <a className="button button-outline" href={`/p/${encodeURIComponent(store.slug)}`} target="_blank" rel="noreferrer"><Globe2 size={15} /> Open live site</a>}<button className="button button-outline manage-edit" onClick={() => goToSection('about')}>Edit details <ArrowRight size={14} /></button><button className="button button-outline manage-delete" onClick={() => setConfirmDelete(true)} disabled={saving}><Trash2 size={15} /> Delete</button></div>{confirmDelete && <div className="delete-confirm" role="alertdialog" aria-label="Confirm portfolio deletion"><span>Delete this portfolio and all its saved information? This can’t be undone.</span><button className="button button-outline" onClick={() => setConfirmDelete(false)} disabled={saving}>Keep it</button><button className="button button-delete" onClick={handleDelete} disabled={saving}>{saving ? 'Deleting…' : 'Delete portfolio'}</button></div>}</div> : <div className="manage-empty"><p>No portfolio saved yet. Add your details, then save a draft to manage it here.</p><button className="button button-outline" onClick={() => goToSection('about')}>Create your first portfolio <ArrowRight size={14} /></button></div>}</section>

        <div className="finish-card"><div className="finish-icon"><Sparkles size={19} /></div><div><span className="eyebrow">THE FINISHING TOUCH</span><h2>Ready to make it yours?</h2><p>Save your details, generate a preview, then publish when it feels right.</p></div><div className="finish-actions"><button className="button button-outline" onClick={() => setPreview(true)}><Eye size={15} /> Preview</button><button className="button button-dark" disabled={saving} onClick={handleGenerate}><Sparkles size={15} /> Generate portfolio <ArrowUpRight size={14} /></button></div></div>
        <div className="builder-footer" id="setup"><span>MADE FOR YOUR NEXT CHAPTER <span className="footer-heart">✳</span></span><div><span>A STUDENT PROJECT, BUILT WITH CARE</span><a href="https://supabase.com" target="_blank" rel="noreferrer">DATABASE BY SUPABASE <ArrowUpRight size={12} /></a></div></div>
      </div>
    </main>
    {preview && <div className="preview-overlay" role="dialog" aria-modal="true" aria-label="Portfolio preview"><PortfolioPage portfolio={portfolio} template={store.template} onClose={() => setPreview(false)} /></div>}
  </div>
}

function SectionHead({ number, icon: Icon, title, subtitle }) {
  return <div className="section-head"><span className="section-icon"><Icon size={18} strokeWidth={1.7} /></span><div className="section-head-copy"><div className="section-kicker">CHAPTER {number}</div><h2>{title}</h2><p>{subtitle}</p></div></div>
}

function TemplateMini({ template }) {
  return <div className={`template-mini mini-${template}`}><div className="mini-window"><span /><span /><span /><div className="mini-split"><div className="mini-text"><i /><i /><i /><b /></div><div className="mini-image" /></div><div className="mini-bottom"><i /><i /><i /></div></div>{template === 'modern' && <span className="mini-badge">01—04</span>}{template === 'creative' && <span className="mini-sticker">hello!</span>}</div>
}

export default App
