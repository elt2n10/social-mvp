import React, { useState } from 'react';
import { api, clearToken } from '../api/api';

export default function Settings({ onLogout }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [msg, setMsg] = useState('');

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
      <form onSubmit={changePassword}>
        <h3>Изменить пароль</h3>{msg && <p>{msg}</p>}
        <input type="password" placeholder="Старый пароль" value={oldPassword} onChange={e=>setOldPassword(e.target.value)}/>
        <input type="password" placeholder="Новый пароль" value={newPassword} onChange={e=>setNewPassword(e.target.value)}/>
        <button>Изменить</button>
      </form>
      <div><h3>Тема</h3><p>В MVP включена тёмная тема. Переключатель можно расширить позже.</p></div>
      <button className="danger" onClick={deleteAccount}>Удалить аккаунт</button>
    </div>
  </section>;
}
