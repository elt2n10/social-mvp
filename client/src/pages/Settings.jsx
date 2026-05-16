import React, { useEffect, useMemo, useState } from 'react';
import { api, clearToken } from '../api/api';

const DEFAULT_THEME = {
  useDefaultTheme: true,
  accentColor: '',
  secondColor: '',
  backgroundColor: '',
  cardColor: '',
  textColor: '',
  mutedColor: '',
  borderColor: '',
  sidebarColor: '',
  inputColor: '',
  dangerColor: ''
};

export default function Settings({ onLogout, onDevSecret, devUnlocked, onOpenDevPanel, onExitDev, config, setConfig }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [tapCount, setTapCount] = useState(0);
  const [localTheme, setLocalTheme] = useState(() => ({
    ...DEFAULT_THEME,
    ...JSON.parse(localStorage.getItem('localTheme') || '{}')
  }));

  const isDefaultTheme = localTheme.useDefaultTheme !== false;

  const colorFields = useMemo(() => ([
    ['accentColor', 'Акцентный цвет', '#7c3cff'],
    ['secondColor', 'Второй цвет', '#2aa7ff'],
    ['backgroundColor', 'Фон сайта', '#090a10'],
    ['cardColor', 'Карточки', '#11131d'],
    ['sidebarColor', 'Левое меню', '#0d0f18'],
    ['inputColor', 'Поля ввода', '#11131d'],
    ['textColor', 'Основной текст', '#f2f3ff'],
    ['mutedColor', 'Вторичный текст', '#8e94ad'],
    ['borderColor', 'Обводки', '#25293d'],
    ['dangerColor', 'Опасные кнопки', '#d83d5a']
  ]), []);

  useEffect(() => {
    const reset = setTimeout(() => setTapCount(0), 2200);
    if (tapCount >= 10) { setTapCount(0); onDevSecret(); }
    return () => clearTimeout(reset);
  }, [tapCount, onDevSecret]);

  function saveLocalTheme(next) {
    setLocalTheme(next);
    localStorage.setItem('localTheme', JSON.stringify(next));
    if (next.useDefaultTheme === false) {
      const custom = Object.fromEntries(Object.entries(next).filter(([k, v]) => k !== 'useDefaultTheme' && v));
      setConfig(custom);
    } else {
      setConfig(config);
    }
  }

  function updateLocal(key, value) {
    saveLocalTheme({ ...localTheme, useDefaultTheme: false, [key]: value });
  }

  function resetTheme() {
    localStorage.removeItem('localTheme');
    setLocalTheme(DEFAULT_THEME);
    setConfig({ ...config });
    setMsg('Цвета вернулись к настройкам сайта по умолчанию');
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

      {devUnlocked && <div className="settingsGroup devUnlockedBox">
        <h3>Режим разработчика</h3>
        <p>Режим разблокирован. Панель не открывается сама — запускай её отсюда.</p>
        <div className="row responsiveRow">
          <button type="button" onClick={onOpenDevPanel}>Открыть меню разработчика</button>
          <button type="button" className="ghost" onClick={onExitDev}>Выйти из режима разработчика</button>
        </div>
      </div>}

      <form onSubmit={changePassword} className="settingsGroup">
        <h3>Изменить пароль</h3>{msg && <p>{msg}</p>}
        <input type="password" placeholder="Старый пароль" value={oldPassword} onChange={e=>setOldPassword(e.target.value)}/>
        <input type="password" placeholder="Новый пароль" value={newPassword} onChange={e=>setNewPassword(e.target.value)}/>
        <button>Изменить</button>
      </form>
      <div className="settingsGroup">
        <h3>Кастомизация интерфейса</h3>
        <p className="safeText">Если включено “по умолчанию”, цвета берутся из dev-панели и меняются сразу для всех пользователей с режимом по умолчанию.</p>
        <label className="checkLine"><input type="checkbox" checked={isDefaultTheme} onChange={e => e.target.checked ? resetTheme() : saveLocalTheme({ ...localTheme, useDefaultTheme: false })}/> Использовать цвета сайта по умолчанию</label>
        <div className="colorGrid wideColorGrid">
          {colorFields.map(([key, label, fallback]) => (
            <label key={key}>{label}<input disabled={isDefaultTheme} type="color" value={localTheme[key] || config[key] || fallback} onChange={e=>updateLocal(key, e.target.value)} /></label>
          ))}
        </div>
        <div className="row responsiveRow">
          <button type="button" className="ghost" onClick={resetTheme}>По умолчанию</button>
        </div>
        <label className="checkLine"><input type="checkbox" checked={config.soundsEnabled !== false} onChange={e=>setConfig({ soundsEnabled: e.target.checked })}/> Звуки кнопок</label>
        <label className="checkLine"><input type="checkbox" checked={config.animationsEnabled !== false} onChange={e=>setConfig({ animationsEnabled: e.target.checked })}/> Анимации</label>
      </div>
      <div className="settingsGroup"><h3>Безопасность</h3><p>Регистрация защищена капчей и подтверждением почты. Если аккаунт заблокируют, посты, сообщения и загрузка видео будут недоступны.</p></div>
      <button className="danger" onClick={deleteAccount}>Удалить аккаунт</button>
      <button className="secretDot" title="" aria-label="" onClick={() => setTapCount(v => v + 1)} type="button" />
    </div>
  </section>;
}
