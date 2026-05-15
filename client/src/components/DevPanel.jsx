import React, { useEffect, useState } from 'react';
import { api, fileUrl } from '../api/api';

export default function DevPanel({ open, onClose, onExitDev, config, onConfig }) {
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

  async function load() {
    try {
      setError('');
      setStats(await api('/api/dev/stats'));
      setUsers(await api('/api/dev/users'));
      setPosts(await api('/api/dev/recent/posts'));
      setVideos(await api('/api/dev/recent/videos'));
      setStickers(await api('/api/dev/stickers'));
      const cfg = await api('/api/dev/config');
      setSite(cfg); onConfig?.(cfg);
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { if (open) load(); }, [open]);
  if (!open) return null;

  async function action(fn) { try { setError(''); await fn(); await load(); } catch(e) { setError(e.message); } }
  function setField(key, value) { setSite(s => ({ ...s, [key]: value })); }

  async function saveConfig(e) {
    e.preventDefault();
    const fd = new FormData();
    ['siteName','accentColor','secondColor','backgroundColor','cardColor','buttonRadius','soundsEnabled','animationsEnabled','inviteEnabled','stickers'].forEach(k => fd.append(k, site[k] ?? ''));
    if (logo) fd.append('logo', logo);
    if (favicon) fd.append('favicon', favicon);
    const updated = await api('/api/dev/config', { method:'PUT', body: fd });
    setLogo(null); setFavicon(null); setSite(updated); onConfig?.(updated);
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

  return <div className="modalBackdrop">
    <div className="modal big devPanel">
      <div className="row between"><h2>Панель разработчика Yved</h2><button onClick={onClose}>Закрыть</button></div>
      {error && <p className="error">{error}</p>}
      <div className="stats">
        <div><b>{stats?.users ?? 0}</b><span>пользователей</span></div>
        <div><b>{stats?.posts ?? 0}</b><span>постов</span></div>
        <div><b>{stats?.videos ?? 0}</b><span>видео</span></div>
        <div><b>{stats?.hiddenPosts ?? 0}</b><span>скрытых постов</span></div>
        <div><b>{stats?.hiddenVideos ?? 0}</b><span>скрытых видео</span></div>
        <div><b>{stats?.reports ?? 0}</b><span>жалоб</span></div>
        <div><b>{stats?.stickers ?? 0}</b><span>стикеров</span></div>
      </div>

      <form className="card settingsGroup" onSubmit={saveConfig}>
        <h3>Изменить сайт без нового кода</h3>
        <input value={site.siteName || ''} onChange={e=>setField('siteName', e.target.value)} placeholder="Название сайта" />
        <div className="colorGrid">
          <label>Акцент<input type="color" value={site.accentColor || '#7c3cff'} onChange={e=>setField('accentColor', e.target.value)} /></label>
          <label>Второй цвет<input type="color" value={site.secondColor || '#2aa7ff'} onChange={e=>setField('secondColor', e.target.value)} /></label>
          <label>Фон<input type="color" value={site.backgroundColor || '#090a10'} onChange={e=>setField('backgroundColor', e.target.value)} /></label>
          <label>Карточки<input type="color" value={site.cardColor || '#11131d'} onChange={e=>setField('cardColor', e.target.value)} /></label>
        </div>
        <label>Скругление кнопок<input type="range" min="4" max="28" value={Number(site.buttonRadius || 14)} onChange={e=>setField('buttonRadius', e.target.value)} /></label>
        <label>Лого сайта<input type="file" accept="image/*" onChange={e=>setLogo(e.target.files[0])} /></label>
        <label>Иконка вкладки<input type="file" accept="image/*" onChange={e=>setFavicon(e.target.files[0])} /></label>
        <label className="checkLine"><input type="checkbox" checked={site.soundsEnabled === true || site.soundsEnabled === 'true'} onChange={e=>setField('soundsEnabled', e.target.checked)} /> Звуки</label>
        <label className="checkLine"><input type="checkbox" checked={site.animationsEnabled === true || site.animationsEnabled === 'true'} onChange={e=>setField('animationsEnabled', e.target.checked)} /> Анимации</label>
        <label className="checkLine"><input type="checkbox" checked={site.inviteEnabled === true || site.inviteEnabled === 'true'} onChange={e=>setField('inviteEnabled', e.target.checked)} /> Закрыть сайт invite-ссылкой</label>
        <label>Стикеры для ЛС<textarea value={site.stickers || ''} onChange={e=>setField('stickers', e.target.value)} placeholder="😀,😂,😎,🔥,💜" /></label>
        <button>Сохранить настройки сайта</button>
      </form>

      <div className="card settingsGroup">
        <h3>Сохранение контента</h3>
        <p>Скачай резервную копию перед крупными обновлениями. Для постоянного хранения фото/видео можно подключить Cloudinary через переменные Render.</p>
        <button onClick={() => action(downloadBackup)}>Скачать backup JSON</button>
      </div>

      <div className="card settingsGroup">
        <h3>Настоящие стикеры для ЛС</h3>
        <p>Загружай картинки-стикеры. Они появятся в панели “Стикеры” в личных сообщениях.</p>
        <div className="row responsiveRow">
          <input placeholder="Название стикера" value={stickerName} onChange={e=>setStickerName(e.target.value)} />
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
      </div>

      <h3>Пользователи, аватарки и обложки</h3>
      <div className="userList">
        {users.map(u => <div className="userRow" key={u.id}>
          <span>#{u.id} <b>{u.username}</b> {u.isBlocked ? '🚫' : ''} {u.isDev ? '🛠' : ''}<small>{u.email} · {u.isEmailVerified ? 'почта подтверждена' : 'почта не подтверждена'}</small></span>
          <div className="devActions">
            {u.avatar && <button className="ghost" onClick={()=>action(()=>api(`/api/dev/users/${u.id}/avatar/clear`, { method:'PUT' }))}>Убрать аватар</button>}
            {u.coverUrl && <button className="ghost" onClick={()=>action(()=>api(`/api/dev/users/${u.id}/cover/clear`, { method:'PUT' }))}>Убрать обложку</button>}
            <input className="devSmallInput" placeholder="Название бейджа" value={badgeTitles[u.id] || ''} onChange={e => setBadgeTitles(prev => ({ ...prev, [u.id]: e.target.value }))} />
            <label className="fileButton devBadgeButton">Бейдж<input type="file" accept="image/*" onChange={e => setBadgeFiles(prev => ({ ...prev, [u.id]: e.target.files?.[0] || null }))} /></label>
            <button className="ghost" onClick={()=>action(()=>uploadBadge(u.id))}>Выдать бейдж</button>
            <button onClick={()=>action(()=>api(`/api/dev/users/${u.id}/${u.isBlocked ? 'unblock':'block'}`, { method:'PUT' }))}>{u.isBlocked ? 'Разблокировать' : 'Заблокировать'}</button>
            <button className="danger" onClick={()=>{ if(confirm(`Удалить аккаунт ${u.username} навсегда?`)) action(()=>api(`/api/dev/users/${u.id}`, { method:'DELETE' })); }}>Удалить аккаунт</button>
          </div>
        </div>)}
      </div>

      <h3>Последние посты</h3>
      <div className="devList">{posts.map(p => <div className="devItem" key={p.id}>
        <span>#{p.id} @{p.authorName} {p.isHidden ? 'скрыт' : ''}<small className="safeText">{p.text || (p.imageUrls?.length ? `Фото: ${p.imageUrls.length}` : p.imageUrl)}</small></span>
        <div className="devActions">
          <button onClick={()=>action(()=>api(`/api/dev/posts/${p.id}/${p.isHidden ? 'restore':'hide'}`, { method:'PUT' }))}>{p.isHidden ? 'Вернуть' : 'Скрыть'}</button>
          <button className="danger" onClick={()=>{ if(confirm('Удалить пост навсегда?')) action(()=>api(`/api/dev/posts/${p.id}`, { method:'DELETE' })); }}>Удалить</button>
        </div>
      </div>)}</div>

      <h3>Последние видео</h3>
      <div className="devList">{videos.map(v => <div className="devItem" key={v.id}>
        <span>#{v.id} @{v.authorName} {v.isHidden ? 'скрыто' : ''}<small className="safeText">{v.description || v.videoUrl}</small></span>
        <div className="devActions">
          <button onClick={()=>action(()=>api(`/api/dev/videos/${v.id}/${v.isHidden ? 'restore':'hide'}`, { method:'PUT' }))}>{v.isHidden ? 'Вернуть' : 'Скрыть'}</button>
          <button className="danger" onClick={()=>{ if(confirm('Удалить видео навсегда?')) action(()=>api(`/api/dev/videos/${v.id}`, { method:'DELETE' })); }}>Удалить</button>
        </div>
      </div>)}</div>

      <button className="danger" onClick={onExitDev}>Выйти из режима разработчика</button>
    </div>
  </div>;
}
