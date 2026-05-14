import React, { useEffect, useState } from 'react';
import { api, setToken } from '../api/api';

export default function Auth({ onAuth, config }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username:'', email:'', login:'', password:'', captchaAnswer:'' });
  const [captcha, setCaptcha] = useState(null);
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyHint, setVerifyHint] = useState('');
  const [error, setError] = useState('');

  async function loadCaptcha() {
    try {
      const data = await api('/api/auth/captcha');
      setCaptcha(data);
      setForm(prev => ({ ...prev, captchaAnswer: '' }));
    } catch {
      setCaptcha(null);
    }
  }

  useEffect(() => {
    if (mode === 'register') loadCaptcha();
  }, [mode]);

  async function submit(e) {
    e.preventDefault();
    setError('');

    try {
      if (mode === 'verify') {
        const data = await api('/api/auth/verify-email', {
          method: 'POST',
          body: JSON.stringify({ email: verifyEmail, code: verifyCode })
        });
        setToken(data.token);
        onAuth(data.user);
        return;
      }

      const path = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'register'
        ? {
            ...form,
            captchaId: captcha?.captchaId,
            captchaAnswer: captchaAnswer.trim()
          }
        : form;
      const data = await api(path, { method:'POST', body: JSON.stringify(body) });

      if (data.requiresEmailVerification) {
        setVerifyEmail(data.email);
        setVerifyHint(data.debugCode ? `Тестовый код: ${data.debugCode}` : `Код отправлен на ${data.maskedEmail || 'почту'}`);
        setMode('verify');
        return;
      }

      setToken(data.token);
      onAuth(data.user);
    } catch (err) {
      if (err.data?.needsEmailVerification) {
        setVerifyEmail(err.data.email);
        setVerifyHint(`Сначала подтверди почту: ${err.data.maskedEmail || ''}`);
        setMode('verify');
      } else {
        setError(err.message);
      }
      if (mode === 'register') loadCaptcha();
    }
  }

  async function resendCode() {
    setError('');

    try {
      const data = await api('/api/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({
          email: verifyEmail
        })
      });

      setVerifyHint(
        data.debugCode
          ? `Новый тестовый код: ${data.debugCode}`
          : 'Код отправлен повторно'
      );
    } catch (err) {
      setError(err.message);
    }
  }

  return <div className="authPage">
    <form className="authCard pop" onSubmit={submit}>
      <div className="authLogoText">{config?.siteName || 'Yved'}</div>
      <h1>{mode === 'login' ? 'Вход' : mode === 'register' ? 'Регистрация' : 'Подтверждение почты'}</h1>
      <p>Соцсеть с постами, видео и сообщениями</p>
      {error && <div className="error">{error}</div>}
      {verifyHint && mode === 'verify' && <div className="successBox">{verifyHint}</div>}

      {mode === 'register' && <>
        <input placeholder="Username" value={form.username} onChange={e=>setForm({...form, username:e.target.value})}/>
        <input placeholder="Email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})}/>
        <input type="password" placeholder="Пароль" value={form.password} onChange={e=>setForm({...form, password:e.target.value})}/>
        <div className="captchaBox">
          <span>Проверка: {captcha?.question || '...'}</span>
          <button type="button" className="ghost miniBtn" onClick={loadCaptcha}>↻</button>
        </div>
        <input placeholder="Ответ на капчу" value={form.captchaAnswer} onChange={e=>setForm({...form, captchaAnswer:e.target.value})}/>
      </>}

      {mode === 'login' && <>
        <input placeholder="Логин или email" value={form.login} onChange={e=>setForm({...form, login:e.target.value})}/>
        <input type="password" placeholder="Пароль" value={form.password} onChange={e=>setForm({...form, password:e.target.value})}/>
      </>}

      {mode === 'verify' && <>
        <input placeholder="Email" value={verifyEmail} onChange={e=>setVerifyEmail(e.target.value)}/>
        <input placeholder="Код из письма" value={verifyCode} onChange={e=>setVerifyCode(e.target.value)}/>
      </>}

      <button>{mode === 'login' ? 'Войти' : mode === 'register' ? 'Зарегистрироваться' : 'Подтвердить'}</button>
      {mode === 'verify' && <button type="button" className="ghost" onClick={resendCode}>Отправить код ещё раз</button>}
      <button type="button" className="ghost" onClick={()=>{ setMode(mode === 'login' ? 'register' : 'login'); setError(''); setVerifyHint(''); }}>
        {mode === 'login' ? 'Создать аккаунт' : 'Уже есть аккаунт'}
      </button>
    </form>
  </div>;
}
