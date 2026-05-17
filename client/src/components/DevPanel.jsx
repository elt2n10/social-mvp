import React, { useEffect, useState } from 'react';
import { api, fileUrl } from '../api/api';

const sections = [
  ['dashboard', 'Обзор'],
  ['site', 'Сайт'],
  ['users', 'Пользователи'],
  ['posts', 'Посты'],
  ['videos', 'Видео'],
  ['reports', 'Жалобы'],
  ['moderation', 'Модерация'],
  ['stickers', 'Стикеры'],
  ['backup', 'Backup']
];

export default function DevPanel({ open, onClose, onExitDev, config, onConfig }) {
  const [section, setSection] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [videos, setVideos] = useState([]);
  const [site, setSite] = useState(config || {});
  const [logo, setLogo] = useState(null);
  const [favicon, setFavicon] = useState(null);
  const [error, setError] = useState('');
  const [badgeFiles, setBadgeFiles] = useState({});
  const [badgeTitles, setBadgeTitles] = useState({});
  const [stickers, setStickers] = useState([]);
  const [stickerName, setStickerName] = useState('');
  const [stickerFile, setStickerFile] = useState(null);
  const [forbiddenWords, setForbiddenWords] = useState([]);
  const [forbiddenText, setForbiddenText] = useState('');
  const [moderationLogs, setModerationLogs] = useState([]);
  const [reports, setReports] = useState([]);
  const [userQuery, setUserQuery] = useState('');
  const [postIdQuery, setPostIdQuery] = useState('');

  async function load() {
    try {
      setError('');
      setStats(await api('/api/dev/stats'));
      setUsers(await api('/api/dev/users'));
      setPosts(await api('/api/dev/recent/posts'));
      setVideos(await api('/api/dev/recent/videos'));
      setStickers(await api('/api/dev/stickers'));
      const words = await api('/api/dev/moderation/words').catch(() => []);
      setForbiddenWords(words);
      setForbiddenText(words.map(w => w.word).join('\n'));
      setModerationLogs(await api('/api/dev/moderation/logs').catch(() => []));
      setReports(await api('/api/dev/reports').catch(() => []));
      const cfg = await api('/api/dev/config');
      setSite(cfg);
      onConfig?.(cfg);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { if (open) load(); }, [open]);

  useEffect(() => {
    if (!open || section !== 'reports') return;
    let alive = true;
    async function refreshReports() {
      try {
        const [nextReports, nextStats] = await Promise.all([
          api('/api/dev/reports').catch(() => []),
          api('/api/dev/stats').catch(() => null)
        ]);
        if (alive) {
          setReports(nextReports);
          if (nextStats) setStats(nextStats);
        }
      } catch {}
    }
    refreshReports();
    const timer = setInterval(refreshReports, 2500);
    return () => { alive = false; clearInterval(timer); };
  }, [open, section]);

  if (!open) return null;

  async function action(fn) {
    try {
      setError('');
      await fn();
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  function setField(key, value) { setSite(s => ({ ...s, [key]: value })); }

  async function saveConfig(e) {
    e.preventDefault();
    const fd = new FormData();
    ['siteName','siteTheme','buttonRadius','soundsEnabled','animationsEnabled','inviteEnabled','stickers'].forEach(k => fd.append(k, site[k] ?? ''));
    if (logo) fd.append('logo', logo);
    if (favicon) fd.append('favicon', favicon);
    const updated = await api('/api/dev/config', { method:'PUT', body: fd });
    setLogo(null);
    setFavicon(null);
    setSite(updated);
    onConfig?.(updated);
  }

  async function downloadBackup() {
    const data = await api('/api/dev/backup');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yved-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function uploadBadge(userId) {
    const file = badgeFiles[userId];
    if (!file) throw new Error('Выбери картинку бейджа');
    const fd = new FormData();
    fd.append('badge', file);
    fd.append('title', badgeTitles[userId] || 'badge');
    await api(`/api/dev/users/${userId}/badges`, { method: 'POST', body: fd });
    setBadgeFiles(prev => ({ ...prev, [userId]: null }));
    setBadgeTitles(prev => ({ ...prev, [userId]: '' }));
  }

  async function uploadSticker() {
    if (!stickerFile) throw new Error('Выбери картинку стикера');
    const fd = new FormData();
    fd.append('name', stickerName || 'sticker');
    fd.append('sticker', stickerFile);
    await api('/api/dev/stickers', { method: 'POST', body: fd });
    setStickerName('');
    setStickerFile(null);
  }

  async function saveForbiddenWords() {
    const words = forbiddenText.split(/[\n,]/g).map(w => w.trim()).filter(Boolean);
    const updated = await api('/api/dev/moderation/words', { method: 'PUT', body: JSON.stringify({ words }) });
    setForbiddenWords(updated);
    setForbiddenText(updated.map(w => w.word).join('\n'));
  }

  async function searchUsers(e) {
    e.preventDefault();
    const q = userQuery.trim();
    setUsers(q ? await api(`/api/dev/users/search?q=${encodeURIComponent(q)}`) : await api('/api/dev/users'));
  }

  async function searchPost(e) {
    e.preventDefault();
    const id = postIdQuery.trim();
    setPosts(id ? await api(`/api/dev/posts/search?id=${encodeURIComponent(id)}`) : await api('/api/dev/recent/posts'));
  }

  function renderDashboard() {
    return <div className="devSection"><div className="stats">
      <div><b>{stats?.users ?? 0}</b><span>пользователей</span></div>
      <div><b>{stats?.posts ?? 0}</b><span>постов</span></div>
      <div><b>{stats?.videos ?? 0}</b><span>видео</span></div>
      <div><b>{stats?.reports ?? 0}</b><span>жалоб</span></div>
      <div><b>{stats?.stickers ?? 0}</b><span>стикеров</span></div>
      <div><b>{stats?.moderationLogs ?? 0}</b><span>модерация</span></div>
    </div></div>;
  }

  function renderSite() {
    return <form className="card settingsGroup" onSubmit={saveConfig}>
      <h3>Сайт</h3>
      <input value={site.siteName || ''} onChange={e=>setField('siteName', e.target.value)} placeholder="Название сайта" />
      <label>Тема по умолчанию
        <select value={site.siteTheme || 'default'} onChange={e=>setField('siteTheme', e.target.value)}>
          <option value="default">Стартовая Yved</option>
          <option value="dark">Тёмная</option>
          <option value="light">Белая</option>
        </select>
      </label>
      <label>Скругление кнопок<input type="range" min="4" max="28" value={Number(site.buttonRadius || 14)} onChange={e=>setField('buttonRadius', e.target.value)} /></label>
      <label>Лого сайта<input type="file" accept="image/*" onChange={e=>setLogo(e.target.files[0])} /></label>
      <label>Иконка вкладки<input type="file" accept="image/*" onChange={e=>setFavicon(e.target.files[0])} /></label>
      <label className="checkLine"><input type="checkbox" checked={site.soundsEnabled === true || site.soundsEnabled === 'true'} onChange={e=>setField('soundsEnabled', e.target.checked)} /> Звуки</label>
      <label className="checkLine"><input type="checkbox" checked={site.animationsEnabled === true || site.animationsEnabled === 'true'} onChange={e=>setField('animationsEnabled', e.target.checked)} /> Анимации по умолчанию</label>
      <label className="checkLine"><input type="checkbox" checked={site.inviteEnabled === true || site.inviteEnabled === 'true'} onChange={e=>setField('inviteEnabled', e.target.checked)} /> Invite-доступ</label>
      <button>Сохранить</button>
    </form>;
  }

  function renderUsers() {
    return <div className="devSection">
      <form className="devSearch" onSubmit={searchUsers}>
        <input value={userQuery} onChange={e=>setUserQuery(e.target.value)} placeholder="Поиск по @username, имени или email" />
        <button>Найти</button>
        <button type="button" className="ghost" onClick={()=>action(async()=>{ setUserQuery(''); setUsers(await api('/api/dev/users')); })}>Сброс</button>
      </form>
      <div className="userList">
        {users.map(u => <div className="userRow" key={u.id}>
          <span>#{u.id} <b>{u.displayName || u.username}</b> <small>@{u.username} · {u.email} · {u.isEmailVerified ? 'почта подтверждена' : 'почта не подтверждена'} {u.isBlocked ? ' · заблокирован' : ''} {u.isDev ? ' · dev' : ''}</small></span>
          <div className="devActions">
            {u.avatar && <button className="ghost" onClick={()=>action(()=>api(`/api/dev/users/${u.id}/avatar/clear`, { method:'PUT' }))}>Убрать аватар</button>}
            {u.coverUrl && <button className="ghost" onClick={()=>action(()=>api(`/api/dev/users/${u.id}/cover/clear`, { method:'PUT' }))}>Убрать обложку</button>}
            <input className="devSmallInput" placeholder="Название бейджа" value={badgeTitles[u.id] || ''} onChange={e => setBadgeTitles(prev => ({ ...prev, [u.id]: e.target.value }))} />
            <label className="fileButton devBadgeButton">Бейдж<input type="file" accept="image/*" onChange={e => setBadgeFiles(prev => ({ ...prev, [u.id]: e.target.files?.[0] || null }))} /></label>
            <button className="ghost" onClick={()=>action(()=>uploadBadge(u.id))}>Выдать</button>
            <button onClick={()=>action(()=>api(`/api/dev/users/${u.id}/${u.isBlocked ? 'unblock':'block'}`, { method:'PUT' }))}>{u.isBlocked ? 'Разблокировать' : 'Заблокировать'}</button>
            <button className="danger" onClick={()=>{ if(confirm(`Удалить аккаунт @${u.username}?`)) action(()=>api(`/api/dev/users/${u.id}`, { method:'DELETE' })); }}>Удалить</button>
          </div>
        </div>)}
      </div>
    </div>;
  }

  function renderPosts() {
    return <div className="devSection">
      <form className="devSearch" onSubmit={searchPost}>
        <input value={postIdQuery} onChange={e=>setPostIdQuery(e.target.value)} placeholder="ID поста" />
        <button>Найти пост</button>
        <button type="button" className="ghost" onClick={()=>action(async()=>{ setPostIdQuery(''); setPosts(await api('/api/dev/recent/posts')); })}>Последние</button>
      </form>
      <div className="devList">{posts.map(p => <div className="devItem" key={p.id}>
        <span>#{p.id} @{p.authorName} {p.isHidden ? 'скрыт' : ''}<small className="safeText">{p.text || (p.imageUrls?.length ? `Фото: ${p.imageUrls.length}` : p.imageUrl)}</small></span>
        <div className="devActions">
          <button onClick={()=>action(()=>api(`/api/dev/posts/${p.id}/${p.isHidden ? 'restore':'hide'}`, { method:'PUT' }))}>{p.isHidden ? 'Вернуть' : 'Скрыть'}</button>
          <button className="danger" onClick={()=>{ if(confirm('Удалить пост?')) action(()=>api(`/api/dev/posts/${p.id}`, { method:'DELETE' })); }}>Удалить</button>
        </div>
      </div>)}</div>
    </div>;
  }

  function renderVideos() {
    return <div className="devSection"><div className="devList">{videos.map(v => <div className="devItem" key={v.id}>
      <span>#{v.id} @{v.authorName} {v.isHidden ? 'скрыто' : ''}<small className="safeText">{v.description || v.videoUrl}</small></span>
      <div className="devActions">
        <button onClick={()=>action(()=>api(`/api/dev/videos/${v.id}/${v.isHidden ? 'restore':'hide'}`, { method:'PUT' }))}>{v.isHidden ? 'Вернуть' : 'Скрыть'}</button>
        <button className="danger" onClick={()=>{ if(confirm('Удалить видео?')) action(()=>api(`/api/dev/videos/${v.id}`, { method:'DELETE' })); }}>Удалить</button>
      </div>
    </div>)}</div></div>;
  }

  function renderReports() {
    return <div className="devSection"><div className="devList">
      {reports.map(r => <div className="devItem reportItem" key={r.id}>
        <span>
          <b>Жалоба #{r.id}</b>
          <small>{r.targetType} ID: {r.targetId}</small>
          <small>От: @{r.reporterUsername || 'unknown'} · {r.reporterEmail || 'email скрыт'}</small>
          <small>На: @{r.targetAuthorUsername || 'unknown'} · {r.targetAuthorEmail || 'email неизвестен'}</small>
          <small>Причина: {r.reason || 'не указана'}</small>
          {r.targetText && <small className="safeText">Фрагмент: {r.targetText}</small>}
        </span>
        <div className="devActions">
          <button className="ghost" onClick={()=>action(()=>api(`/api/dev/reports/${r.id}/skip`, { method:'PUT' }))}>Пропустить</button>
          <button className="danger" onClick={()=>{ if(confirm('Удалить объект жалобы?')) action(()=>api(`/api/dev/reports/${r.id}/delete-target`, { method:'DELETE' })); }}>Удалить</button>
        </div>
      </div>)}
      {reports.length === 0 && <p className="safeText">Жалоб нет.</p>}
    </div></div>;
  }

  function renderModeration() {
    return <div className="devSection">
      <div className="card settingsGroup">
        <h3>Запрещённые слова</h3>
        <textarea value={forbiddenText} onChange={e=>setForbiddenText(e.target.value)} placeholder="Каждое слово с новой строки" />
        <button type="button" onClick={()=>action(saveForbiddenWords)}>Сохранить</button>
        <div className="forbiddenWordList">{forbiddenWords.map(w => <span key={w.id}>{w.word}</span>)}</div>
      </div>
      <div className="card settingsGroup">
        <h3>Логи</h3>
        <div className="devList">{moderationLogs.slice(0, 30).map(log => <div className="devItem" key={log.id}>
          <span><b>{log.targetType}</b> @{log.authorName || 'unknown'}<small>{log.reason} · {log.text || log.textPreview}</small></span>
        </div>)}</div>
      </div>
    </div>;
  }

  function renderStickers() {
    return <div className="devSection"><div className="card settingsGroup">
      <h3>Стикеры</h3>
      <div className="row responsiveRow">
        <input placeholder="Название" value={stickerName} onChange={e=>setStickerName(e.target.value)} />
        <label className="fileButton inlineFile">Картинка<input type="file" accept="image/*" onChange={e=>setStickerFile(e.target.files?.[0] || null)} /></label>
        <button type="button" onClick={()=>action(uploadSticker)}>Добавить</button>
      </div>
      <div className="stickerAdminGrid">
        {stickers.map(st => <div className={st.isHidden ? 'stickerAdminItem hidden' : 'stickerAdminItem'} key={st.id}>
          <img src={fileUrl(st.imageUrl)} alt={st.name} />
          <b>{st.name}</b>
          <div className="row">
            <button className="ghost" onClick={()=>action(()=>api(`/api/dev/stickers/${st.id}/${st.isHidden ? 'restore':'hide'}`, { method:'PUT' }))}>{st.isHidden ? 'Вернуть' : 'Скрыть'}</button>
            <button className="danger" onClick={()=>{ if(confirm('Удалить стикер?')) action(()=>api(`/api/dev/stickers/${st.id}`, { method:'DELETE' })); }}>Удалить</button>
          </div>
        </div>)}
      </div>
    </div></div>;
  }

  function renderBackup() {
    return <div className="devSection"><div className="card settingsGroup">
      <h3>Backup</h3>
      <button onClick={() => action(downloadBackup)}>Скачать JSON</button>
    </div></div>;
  }

  const view = {
    dashboard: renderDashboard,
    site: renderSite,
    users: renderUsers,
    posts: renderPosts,
    videos: renderVideos,
    reports: renderReports,
    moderation: renderModeration,
    stickers: renderStickers,
    backup: renderBackup
  }[section] || renderDashboard;

  return <div className="modalBackdrop">
    <div className="modal big devPanel devPanelWindow">
      <div className="row between devPanelTop"><h2>Dev Yved</h2><button onClick={onClose}>Закрыть</button></div>
      {error && <p className="error">{error}</p>}
      <div className="devTabs">{sections.map(([id, title]) => <button key={id} className={section === id ? 'active' : 'ghost'} onClick={() => setSection(id)}>{title}</button>)}</div>
      {view()}
      <button className="danger devExitButton" onClick={onExitDev}>Выйти из режима разработчика</button>
    </div>
  </div>;
}
