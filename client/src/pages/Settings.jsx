import React, { useEffect, useState } from 'react';
import { api, clearToken } from '../api/api';

export default function Settings({ onLogout, onDevSecret, config, setConfig }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [tapCount, setTapCount] = useState(0);
  const [localTheme, setLocalTheme] = useState(() => JSON.parse(localStorage.getItem('localTheme') || '{}'));

  useEffect(() => {
    const reset = setTimeout(() => setTapCount(0), 2200);
    if (tapCount >= 10) { setTapCount(0); onDevSecret(); }
    return () => clearTimeout(reset);
  }, [tapCount]);

  function updateLocal(key, value) {
    const next = { ...localTheme, [key]: value };
    setLocalTheme(next);
    localStorage.setItem('localTheme', JSON.stringify(next));
    setConfig(next);
  }

  async function changePassword(e){
    e.preventDefault(); setMsg('');
    try { await api('/api/auth/password', { method:'PUT', body: JSON.stringify({ oldPassword, newPassword }) }); setMsg('Пароль изменён'); setOldPassword(''); setNewPassword(''); } catch(e){ setMsg(e.message); }
  }
  async function deleteAccount(){
    if(!confirm('Точно удалить аккаунт?')) return;
    await api('/api/auth/me', { method:'DELETE' }); clearToken(); onLogout();
  }

  return <section><h1>Настройки</h1>
    <div className="card settings">
      <button onClick={()=>{clearToken(); onLogout();}}>Выйти из аккаунта</button>
      <form onSubmit={changePassword} className="settingsGroup">
        <h3>Изменить пароль</h3>{msg && <p>{msg}</p>}
        <input type="password" placeholder="Старый пароль" value={oldPassword} onChange={e=>setOldPassword(e.target.value)}/>
        <input type="password" placeholder="Новый пароль" value={newPassword} onChange={e=>setNewPassword(e.target.value)}/>
        <button>Изменить</button>
      </form>
      <div className="settingsGroup">
        <h3>Кастомизация интерфейса</h3>
        <label>Акцентный цвет<input type="color" value={localTheme.accentColor || config.accentColor || '#7c3cff'} onChange={e=>updateLocal('accentColor', e.target.value)} /></label>
        <label>Цвет фона<input type="color" value={localTheme.backgroundColor || config.backgroundColor || '#090a10'} onChange={e=>updateLocal('backgroundColor', e.target.value)} /></label>
        <label>Цвет карточек<input type="color" value={localTheme.cardColor || config.cardColor || '#11131d'} onChange={e=>updateLocal('cardColor', e.target.value)} /></label>
        <label className="checkLine"><input type="checkbox" checked={config.soundsEnabled !== false} onChange={e=>setConfig({ soundsEnabled: e.target.checked })}/> Звуки кнопок</label>
        <label className="checkLine"><input type="checkbox" checked={config.animationsEnabled !== false} onChange={e=>setConfig({ animationsEnabled: e.target.checked })}/> Анимации</label>
      </div>
      <div className="settingsGroup"><h3>Безопасность</h3><p>Если аккаунт заблокируют, посты, сообщения и загрузка видео будут недоступны.</p></div>
      <button className="danger" onClick={deleteAccount}>Удалить аккаунт</button>
      <button className="secretDot" aria-label="" onClick={() => setTapCount(v => v + 1)} type="button" />
    </div>
  </section>;
}
