import React, { useEffect, useState } from 'react';
import { api, clearToken, getToken, fileUrl } from './api/api';
import Layout from './components/Layout';
import DevPanel from './components/DevPanel';
import Auth from './pages/Auth';
import Home from './pages/Home';
import Videos from './pages/Videos';
import Messages from './pages/Messages';
import Profile from './pages/Profile';
import Settings from './pages/Settings';

const defaultConfig = {
  siteName: 'Yved',
  logoUrl: '',
  faviconUrl: '/favicon.svg',
  accentColor: '#7c3cff',
  secondColor: '#2aa7ff',
  backgroundColor: '#090a10',
  cardColor: '#11131d',
  buttonRadius: '14',
  soundsEnabled: true,
  animationsEnabled: true,
  inviteEnabled: false
};

function applyConfig(config) {
  const root = document.documentElement;
  root.style.setProperty('--accent', config.accentColor || defaultConfig.accentColor);
  root.style.setProperty('--accent2', config.secondColor || defaultConfig.secondColor);
  root.style.setProperty('--bg', config.backgroundColor || defaultConfig.backgroundColor);
  root.style.setProperty('--card', config.cardColor || defaultConfig.cardColor);
  root.style.setProperty('--radius', `${config.buttonRadius || 14}px`);
  document.body.classList.toggle('noAnimations', !config.animationsEnabled);
  const favicon = document.querySelector("link[rel='icon']") || document.createElement('link');
  favicon.rel = 'icon';
  favicon.type = 'image/png';
  favicon.href = fileUrl(config.faviconUrl || '/favicon.png');
  document.head.appendChild(favicon);
  document.title = config.siteName || 'Yved';
}

export default function App() {
  const [inviteOk, setInviteOk] = useState(true);
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('home');
  const [profileId, setProfileId] = useState(null);
  const [devLogin, setDevLogin] = useState(false);
  // Если режим разработчика уже был разблокирован, сайт НЕ открывает панель автоматически.
  // В настройках появятся кнопки меню разработчика и выхода из режима.
  const [devUnlocked, setDevUnlocked] = useState(localStorage.getItem('devAccess') === 'true');
  const [devPanel, setDevPanel] = useState(false);
  const [devPassword, setDevPassword] = useState('');
  const [error, setError] = useState('');
  const [config, setConfig] = useState(defaultConfig);

  // Вкладки теперь живут в hash URL: #home, #videos, #messages, #profile, #settings.
  // Поэтому кнопка «Назад» в браузере переключает вкладки, а не выбрасывает с сайта.
  useEffect(() => {
    const allowed = ['home', 'videos', 'messages', 'profile', 'settings'];
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
      .then((d) => setUser(d.user))
      .catch(() => { clearToken(); setUser(null); });
  }, []);

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

  async function checkDev(e) {
    e.preventDefault();
    setError('');
    try {
      await api('/api/dev/login', { method: 'POST', body: JSON.stringify({ password: devPassword }) });
      localStorage.setItem('devAccess', 'true');
      setDevLogin(false); setDevUnlocked(true); setDevPanel(true); setDevPassword('');
    } catch (err) { setError(err.message); }
  }

  function logout() { clearToken(); setUser(null); goPage('home'); }
  function openProfile(id) { setProfileId(id); goPage('profile'); }
  function openMyProfile() { setProfileId(user?.id); goPage('profile'); }

  if (!inviteOk) return <div className="center denied"><h1>Доступ запрещён</h1><p>Открой сайт по invite-ссылке.</p></div>;
  if (!user) return <Auth onAuth={setUser} config={config} />;

  return <>
    <Layout page={page} setPage={goPage} user={user} config={config} openMyProfile={openMyProfile}>
      {page === 'home' && <Home openProfile={openProfile} />}
      {page === 'videos' && <Videos openProfile={openProfile} />}
      {page === 'messages' && <Messages me={user} openProfile={openProfile} config={config} />}
      {page === 'profile' && <Profile user={user} setUser={setUser} profileId={profileId || user.id} openMessages={() => goPage('messages')} />}
      {page === 'settings' && <Settings onLogout={logout} onDevSecret={() => setDevLogin(true)} devUnlocked={devUnlocked} onOpenDevPanel={() => setDevPanel(true)} onExitDev={() => { localStorage.removeItem('devAccess'); setDevUnlocked(false); setDevPanel(false); }} config={config} setConfig={(cfg) => { const merged = { ...config, ...cfg }; setConfig(merged); applyConfig(merged); }} />}
    </Layout>

    {devLogin && <div className="modalBackdrop">
      <form className="modal secretModal" onSubmit={checkDev}>
        {error && <p className="error">{error}</p>}
        <input autoFocus type="password" value={devPassword} onChange={(e) => setDevPassword(e.target.value)} />
      </form>
    </div>}

    <DevPanel open={devPanel} onClose={() => setDevPanel(false)} onExitDev={() => { localStorage.removeItem('devAccess'); setDevUnlocked(false); setDevPanel(false); }} config={config} onConfig={(cfg) => { const merged = { ...config, ...cfg }; setConfig(merged); applyConfig(merged); }} />
  </>;
}
