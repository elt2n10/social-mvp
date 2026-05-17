import React, { useEffect, useState } from 'react';
import { api, clearToken, getToken, fileUrl, getDevToken, setDevToken, clearDevToken } from './api/api';
import Layout from './components/Layout';
import DevPanel from './components/DevPanel';
import Auth from './pages/Auth';
import Home from './pages/Home';
import Videos from './pages/Videos';
import Messages from './pages/Messages';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Activity from './pages/Activity';

const defaultConfig = {
  siteName: 'Yved',
  logoUrl: '',
  faviconUrl: '/favicon.svg',
  siteTheme: 'default',
  accentColor: '#7c3cff',
  secondColor: '#2aa7ff',
  backgroundColor: '#090a10',
  cardColor: '#11131d',
  textColor: '#f2f3ff',
  mutedColor: '#8e94ad',
  borderColor: '#25293d',
  sidebarColor: '#0d0f18',
  inputColor: '#11131d',
  dangerColor: '#d83d5a',
  buttonRadius: '14',
  soundsEnabled: true,
  animationsEnabled: true,
  inviteEnabled: false
};

const THEME_PRESETS = {
  default: {
    accentColor: '#7c3cff', secondColor: '#2aa7ff', backgroundColor: '#090a10', cardColor: '#11131d',
    textColor: '#f2f3ff', mutedColor: '#8e94ad', borderColor: '#25293d', sidebarColor: '#0d0f18',
    inputColor: '#11131d', dangerColor: '#d83d5a'
  },
  dark: {
    accentColor: '#00b7ff', secondColor: '#6d5dfc', backgroundColor: '#02030a', cardColor: '#0b0f19',
    textColor: '#f8fafc', mutedColor: '#94a3b8', borderColor: '#1e293b', sidebarColor: '#050814',
    inputColor: '#0f1524', dangerColor: '#ff3b5c'
  },
  light: {
    accentColor: '#5b5fe8', secondColor: '#8b5cf6', backgroundColor: '#eef1f7', cardColor: '#f8fafc',
    textColor: '#172033', mutedColor: '#5f697c', borderColor: '#ccd4e3', sidebarColor: '#f2f5fb',
    inputColor: '#ffffff', dangerColor: '#d33b4c'
  }
};

function getEffectiveConfig(config) {
  const userTheme = localStorage.getItem('yvedTheme') || 'default';
  const siteTheme = config.siteTheme || 'default';
  const presetName = userTheme === 'default' ? siteTheme : userTheme;
  const preset = THEME_PRESETS[presetName] || THEME_PRESETS.default;
  const animationsPref = localStorage.getItem('yvedAnimations');
  const localAnimations = animationsPref === null ? undefined : animationsPref === 'true';

  return {
    ...config,
    ...preset,
    animationsEnabled: localAnimations ?? (config.animationsEnabled !== false && config.animationsEnabled !== 'false'),
    soundsEnabled: config.soundsEnabled !== false && config.soundsEnabled !== 'false'
  };
}

function applyConfig(config) {
  const effective = getEffectiveConfig({ ...defaultConfig, ...config });
  const root = document.documentElement;
  root.style.setProperty('--accent', effective.accentColor || defaultConfig.accentColor);
  root.style.setProperty('--accent2', effective.secondColor || defaultConfig.secondColor);
  root.style.setProperty('--bg', effective.backgroundColor || defaultConfig.backgroundColor);
  root.style.setProperty('--card', effective.cardColor || defaultConfig.cardColor);
  root.style.setProperty('--text', effective.textColor || defaultConfig.textColor);
  root.style.setProperty('--muted', effective.mutedColor || defaultConfig.mutedColor);
  root.style.setProperty('--border', effective.borderColor || defaultConfig.borderColor);
  root.style.setProperty('--sidebar', effective.sidebarColor || defaultConfig.sidebarColor);
  root.style.setProperty('--input', effective.inputColor || defaultConfig.inputColor);
  root.style.setProperty('--danger', effective.dangerColor || defaultConfig.dangerColor);
  root.style.setProperty('--radius', `${effective.buttonRadius || 14}px`);
  document.body.classList.toggle('noAnimations', !effective.animationsEnabled);
  document.body.dataset.theme = localStorage.getItem('yvedTheme') || 'default';
  const favicon = document.querySelector("link[rel='icon']") || document.createElement('link');
  favicon.rel = 'icon';
  favicon.type = 'image/png';
  favicon.href = fileUrl(effective.faviconUrl || '/favicon.png');
  document.head.appendChild(favicon);
  document.title = effective.siteName || 'Yved';
}

export default function App() {
  const [inviteOk, setInviteOk] = useState(true);
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('home');
  const [profileId, setProfileId] = useState(null);
  const [devLogin, setDevLogin] = useState(false);
  // Если режим разработчика уже был разблокирован, сайт НЕ открывает панель автоматически.
  // В настройках появятся кнопки меню разработчика и выхода из режима.
  const [devUnlocked, setDevUnlocked] = useState(Boolean(getDevToken()));
  const [devPanel, setDevPanel] = useState(false);
  const [devPassword, setDevPassword] = useState('');
  const [error, setError] = useState('');
  const [config, setConfig] = useState(defaultConfig);
  const [onlineCount, setOnlineCount] = useState(0);
  const [activityUnread, setActivityUnread] = useState(0);
  const [messageUnread, setMessageUnread] = useState(0);

  useEffect(() => {
    // Старые версии сохраняли devAccess в localStorage и из-за этого кнопки разработчика
    // могли появляться сразу после входа на сайт. Теперь режим разработчика живёт
    // только до закрытия вкладки и подтверждается devToken от backend.
    localStorage.removeItem('devAccess');
    if (!getDevToken()) setDevUnlocked(false);
  }, []);

  // Вкладки теперь живут в hash URL: #home, #videos, #messages, #profile, #settings.
  // Поэтому кнопка «Назад» в браузере переключает вкладки, а не выбрасывает с сайта.
  useEffect(() => {
    const allowed = ['home', 'videos', 'messages', 'activity', 'profile', 'settings'];
    const syncFromHash = () => {
      const next = window.location.hash.replace('#', '');
      if (allowed.includes(next)) setPage(next);
    };
    syncFromHash();
    window.addEventListener('popstate', syncFromHash);
    window.addEventListener('hashchange', syncFromHash);
    return () => {
      window.removeEventListener('popstate', syncFromHash);
      window.removeEventListener('hashchange', syncFromHash);
    };
  }, []);

  function goPage(nextPage) {
    setPage(nextPage);
    if (window.location.hash !== `#${nextPage}`) window.history.pushState(null, '', `#${nextPage}`);
  }

  useEffect(() => {
    api('/api/site/config')
      .then((cfg) => { const merged = { ...defaultConfig, ...cfg }; setConfig(merged); applyConfig(merged); })
      .catch(() => applyConfig(defaultConfig));
  }, []);

  useEffect(() => {
    if (!config.inviteEnabled) { setInviteOk(true); return; }
    const invite = new URLSearchParams(window.location.search).get('invite');
    api('/api/auth/check-invite', { method: 'POST', body: JSON.stringify({ invite }) })
      .then((r) => setInviteOk(r.ok))
      .catch(() => setInviteOk(false));
  }, [config.inviteEnabled]);

  useEffect(() => {
    if (!getToken()) return;
    api('/api/auth/me')
      .then((d) => { setUser(d.user); activateDevEmail(d.user); })
      .catch(() => { clearToken(); setUser(null); });
  }, []);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    async function ping() {
      try {
        await api('/api/live/heartbeat', { method: 'POST' });
        const summary = await api('/api/live/summary');
        const unread = await api('/api/activity/unread-count').catch(() => ({ count: 0 }));
        const msgUnread = await api('/api/messages/unread-count').catch(() => ({ count: 0 }));
        if (alive) {
          setOnlineCount(summary.onlineCount || 0);
          setActivityUnread(unread.count || 0);
          setMessageUnread(msgUnread.count || 0);
        }
      } catch {}
    }
    ping();
    const timer = setInterval(ping, 3500);
    return () => { alive = false; clearInterval(timer); };
  }, [user?.id]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') setDevLogin(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!config.soundsEnabled) return;
    let last = 0;
    const clickSound = () => {
      const now = Date.now();
      if (now - last < 120) return;
      last = now;
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine'; osc.frequency.value = 740; gain.gain.value = 0.025;
        osc.connect(gain); gain.connect(ctx.destination); osc.start();
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.stop(ctx.currentTime + 0.09);
      } catch {}
    };
    const listener = (e) => { if (e.target.closest('button')) clickSound(); };
    document.addEventListener('click', listener);
    return () => document.removeEventListener('click', listener);
  }, [config.soundsEnabled]);

  useEffect(() => {
    if (!user || activityUnread <= 0 || !('Notification' in window) || Notification.permission !== 'granted') return;
    const last = Number(sessionStorage.getItem('lastActivityNotify') || 0);
    const now = Date.now();
    if (now - last < 12000) return;
    sessionStorage.setItem('lastActivityNotify', String(now));
    try { new Notification('Yved', { body: `Новых событий: ${activityUnread}` }); } catch {}
  }, [activityUnread, user?.id]);


  useEffect(() => {
    if (!user || messageUnread <= 0 || !('Notification' in window) || Notification.permission !== 'granted') return;
    const last = Number(sessionStorage.getItem('lastMessageNotify') || 0);
    const now = Date.now();
    if (now - last < 9000) return;
    sessionStorage.setItem('lastMessageNotify', String(now));
    try { new Notification('Yved', { body: messageUnread > 99 ? 'Новых сообщений: 99+' : `Новых сообщений: ${messageUnread}` }); } catch {}
  }, [messageUnread, user?.id]);

  async function checkDev(e) {
    e.preventDefault();
    setError('');
    try {
      const data = await api('/api/dev/login', { method: 'POST', body: JSON.stringify({ password: devPassword }) });
      setDevToken(data.devToken);
      setDevLogin(false); setDevUnlocked(true); setDevPanel(true); setDevPassword('');
    } catch (err) { setError(err.message); }
  }

  async function activateDevEmail(userData) {
    if (!userData?.isDev) return;
    try {
      const data = await api('/api/dev/email-login', { method: 'POST' });
      if (data.devToken) {
        setDevToken(data.devToken);
        setDevUnlocked(true);
      }
    } catch {}
  }

  function logout() { clearToken(); setUser(null); goPage('home'); }
  function openProfile(id) { setProfileId(id); goPage('profile'); }
  function openMyProfile() { setProfileId(user?.id); goPage('profile'); }

  if (!inviteOk) return <div className="center denied"><h1>Доступ запрещён</h1><p>Открой сайт по invite-ссылке.</p></div>;
  if (!user) return <Auth onAuth={(u) => { setUser(u); activateDevEmail(u); }} config={config} />;

  return <>
    <Layout page={page} setPage={goPage} user={user} config={config} onlineCount={onlineCount} activityUnread={activityUnread} messageUnread={messageUnread} openMyProfile={openMyProfile}>
      {page === 'home' && <Home openProfile={openProfile} />}
      {page === 'videos' && <Videos openProfile={openProfile} />}
      {page === 'messages' && <Messages me={user} openProfile={openProfile} config={config} />}
      {page === 'activity' && <Activity />}
      {page === 'profile' && <Profile user={user} setUser={setUser} profileId={profileId || user.id} openMessages={() => goPage('messages')} />}
      {page === 'settings' && <Settings onLogout={logout} onDevSecret={() => setDevLogin(true)} devUnlocked={devUnlocked} onOpenDevPanel={() => setDevPanel(true)} onExitDev={() => { clearDevToken(); setDevUnlocked(false); setDevPanel(false); }} config={config} setConfig={(cfg) => { const merged = { ...config, ...cfg }; setConfig(merged); applyConfig(merged); }} />}
    </Layout>

    {devLogin && <div className="modalBackdrop">
      <form className="modal secretModal" onSubmit={checkDev}>
        {error && <p className="error">{error}</p>}
        <input autoFocus type="password" value={devPassword} onChange={(e) => setDevPassword(e.target.value)} />
      </form>
    </div>}

    <DevPanel open={devPanel} onClose={() => setDevPanel(false)} onExitDev={() => { clearDevToken(); setDevUnlocked(false); setDevPanel(false); }} config={config} onConfig={(cfg) => { const merged = { ...config, ...cfg }; setConfig(merged); applyConfig(merged); }} />
  </>;
}
