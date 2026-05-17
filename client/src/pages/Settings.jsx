import React, { useEffect, useState } from 'react';
import { api, clearToken } from '../api/api';

const THEME_LABELS = {
  default: 'По умолчанию',
  dark: 'Тёмная',
  light: 'Белая'
};

export default function Settings({ onLogout, onDevSecret, devUnlocked, onOpenDevPanel, onExitDev, config, setConfig }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [tapCount, setTapCount] = useState(0);
  const [theme, setTheme] = useState(localStorage.getItem('yvedTheme') || 'default');
  const [animationsEnabled, setAnimationsEnabled] = useState(localStorage.getItem('yvedAnimations') !== 'false');

  useEffect(() => {
    const reset = setTimeout(() => setTapCount(0), 2200);
    if (tapCount >= 10) { setTapCount(0); onDevSecret(); }
    return () => clearTimeout(reset);
  }, [tapCount, onDevSecret]);

  function changeTheme(next) {
    setTheme(next);
    localStorage.setItem('yvedTheme', next);
    setConfig({ ...config });
    setMsg(`Тема: ${THEME_LABELS[next] || 'По умолчанию'}`);
  }

  function toggleAnimations(checked) {
    setAnimationsEnabled(checked);
    localStorage.setItem('yvedAnimations', String(checked));
    setConfig({ ...config, animationsEnabled: checked });
    setMsg(checked ? 'Анимации включены' : 'Анимации выключены');
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
        <h3>Интерфейс</h3>
        <p className="safeText">Оставили только 3 темы. “По умолчанию” берёт тему, которую разработчик выбрал в dev-панели.</p>
        <div className="themeChoiceGrid">
          {Object.entries(THEME_LABELS).map(([key, label]) => (
            <button type="button" key={key} className={theme === key ? 'active' : 'ghost'} onClick={() => changeTheme(key)}>{label}</button>
          ))}
        </div>
        <button type="button" className="ghost" onClick={() => changeTheme('default')}>Вернуть по умолчанию</button>
        <label className="checkLine"><input type="checkbox" checked={animationsEnabled} onChange={e=>toggleAnimations(e.target.checked)}/> Анимации</label>
      </div>

      <div className="settingsGroup"><h3>Безопасность</h3><p>Регистрация защищена капчей и подтверждением почты. ЛС не читаются ботом-модератором.</p></div>
      <button className="danger" onClick={deleteAccount}>Удалить аккаунт</button>
      <button className="secretDot" title="" aria-label="" onClick={() => setTapCount(v => v + 1)} type="button" />
    </div>
  </section>;
}
