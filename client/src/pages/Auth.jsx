import React, { useState } from 'react';
import { api, setToken } from '../api/api';

export default function Auth({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username:'', email:'', login:'', password:'' });
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault(); setError('');
    try {
      const path = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const data = await api(path, { method:'POST', body: JSON.stringify(form) });
      setToken(data.token); onAuth(data.user);
    } catch (err) { setError(err.message); }
  }

  return <div className="authPage">
    <form className="authCard" onSubmit={submit}>
      <h1>NOVAnet</h1>
      <p>Закрытая MVP-соцсеть по invite-ссылке</p>
      {error && <div className="error">{error}</div>}
      {mode === 'register' && <>
        <input placeholder="Username" value={form.username} onChange={e=>setForm({...form, username:e.target.value})}/>
        <input placeholder="Email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})}/>
      </>}
      {mode === 'login' && <input placeholder="Логин или email" value={form.login} onChange={e=>setForm({...form, login:e.target.value})}/>} 
      <input type="password" placeholder="Пароль" value={form.password} onChange={e=>setForm({...form, password:e.target.value})}/>
      <button>{mode === 'login' ? 'Войти' : 'Зарегистрироваться'}</button>
      <button type="button" className="ghost" onClick={()=>setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Создать аккаунт' : 'Уже есть аккаунт'}</button>
    </form>
  </div>;
}
