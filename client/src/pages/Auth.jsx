import React, { useEffect, useState } from 'react';
import { api, setToken } from '../api/api';

export default function Auth({ onAuth, config }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ displayName:'', username:'', email:'', login:'', password:'', captchaAnswer:'' });
  const [captcha, setCaptcha] = useState(null);
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyHint, setVerifyHint] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function buildVerifyHint(data) {
    if (data?.debugCode) return `Тестовый код: ${data.debugCode}`;
    if (data?.mailSent) return `Код отправлен на ${data.maskedEmail || 'почту'}`;
    if (data?.mailError) return `Код создан, но письмо не отправилось: ${data.mailError}`;
    return data?.message || `Проверь почту: ${data?.maskedEmail || ''}`;
  }

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
    setLoading(true);

    try {
      if (mode === 'verify') {
        const data = await api('/api/auth/verify-email', {
          method: 'POST',
          body: JSON.stringify({ email: verifyEmail.trim().toLowerCase(), code: verifyCode.trim() })
        });
        setToken(data.token);
        onAuth(data.user);
        return;
      }

      const path = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'register'
        ? {
            displayName: form.displayName.trim(),
            username: form.username.trim().replace(/^@+/, '').toLowerCase(),
            email: form.email.trim().toLowerCase(),
            password: form.password,
            captchaId: captcha?.captchaId,
            captchaAnswer: String(form.captchaAnswer || '').trim()
          }
        : {
            login: form.login.trim(),
            password: form.password
          };

      const data = await api(path, { method:'POST', body: JSON.stringify(body) });

      if (data.requiresEmailVerification) {
        setVerifyEmail(data.email || form.email.trim().toLowerCase());
        setVerifyHint(buildVerifyHint(data));
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
      } else if (err.data?.requiresEmailVerification) {
        setVerifyEmail(err.data.email || form.email.trim().toLowerCase());
        setVerifyHint(buildVerifyHint(err.data));
        setMode('verify');
      } else {
        setError(err.message);
      }
      if (mode === 'register') loadCaptcha();
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    setError('');
    setLoading(true);
    try {
      const data = await api('/api/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email: verifyEmail.trim().toLowerCase() })
      });
      setVerifyHint(buildVerifyHint(data));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return <div className="authPage">
    <form className="authCard pop" onSubmit={submit}>
      <div className="authLogoText">{config?.siteName || 'Yved'}</div>
      <h1>{mode === 'login' ? 'Вход' : mode === 'register' ? 'Регистрация' : 'Подтверждение почты'}</h1>
      <p>Вход можно выполнить по email или @username. Имя и @username — разные поля.</p>
      {error && <div className="error">{error}</div>}
      {verifyHint && mode === 'verify' && <div className="successBox">{verifyHint}</div>}

      {mode === 'register' && <>
        <input placeholder="Имя" value={form.displayName} onChange={e=>setForm({...form, displayName:e.target.value})}/>
        <input placeholder="@username" value={form.username} onChange={e=>setForm({...form, username:e.target.value.replace(/^@+/, '')})}/>
        <input placeholder="Email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})}/>
        <small className="authHint">Имя видно людям, а @username нужен для входа, поиска и ссылок. После регистрации нужно подтвердить почту.</small>
        <input type="password" placeholder="Пароль" value={form.password} onChange={e=>setForm({...form, password:e.target.value})}/>
        <div className="captchaBox">
          <span>Проверка: <b>{captcha?.question || '...'}</b></span>
          <button type="button" className="ghost miniBtn" onClick={loadCaptcha}>↻</button>
        </div>
        <input placeholder="Ответ на капчу" value={form.captchaAnswer} onChange={e=>setForm({...form, captchaAnswer:e.target.value})}/>
      </>}

      {mode === 'login' && <>
        <input placeholder="Email или @username" value={form.login} onChange={e=>setForm({...form, login:e.target.value})}/>
        <input type="password" placeholder="Пароль" value={form.password} onChange={e=>setForm({...form, password:e.target.value})}/>
      </>}

      {mode === 'verify' && <>
        <input placeholder="Email" value={verifyEmail} onChange={e=>setVerifyEmail(e.target.value)}/>
        <input placeholder="6-значный код из письма" inputMode="numeric" maxLength="6" value={verifyCode} onChange={e=>setVerifyCode(e.target.value)}/>
      </>}

      <button disabled={loading}>{loading ? 'Подожди...' : mode === 'login' ? 'Войти' : mode === 'register' ? 'Зарегистрироваться' : 'Подтвердить'}</button>
      {mode === 'verify' && <button type="button" className="ghost" disabled={loading} onClick={resendCode}>Отправить код ещё раз</button>}
      <button type="button" className="ghost" onClick={()=>{ setMode(mode === 'login' ? 'register' : 'login'); setError(''); setVerifyHint(''); }}>
        {mode === 'login' ? 'Создать аккаунт' : 'Уже есть аккаунт'}
      </button>
    </form>
  </div>;
}
