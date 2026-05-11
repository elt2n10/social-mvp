import React, { useEffect, useState } from 'react';
import { api, clearToken, getToken } from './api/api';
import Layout from './components/Layout';
import DevPanel from './components/DevPanel';
import Auth from './pages/Auth';
import Home from './pages/Home';
import Videos from './pages/Videos';
import Messages from './pages/Messages';
import Profile from './pages/Profile';
import Settings from './pages/Settings';

export default function App() {
  const [inviteOk, setInviteOk] = useState(null);
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('home');
  const [devLogin, setDevLogin] = useState(false);
  const [devPanel, setDevPanel] = useState(localStorage.getItem('devAccess') === 'true');
  const [devPassword, setDevPassword] = useState('');
  const [error, setError] = useState('');

  // Проверка закрытого доступа по invite-ссылке.
  // Пример правильной ссылки:
  // http://localhost:5173/?invite=secret123
  useEffect(() => {
        setInviteOk(true);
  }, []);

  // Проверяем, был ли пользователь уже авторизован.
  useEffect(() => {
    if (!getToken()) return;

    api('/api/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => {
        clearToken();
        setUser(null);
      });
  }, []);

  // Скрытое открытие режима разработчика: Ctrl + Shift + D.
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        setDevLogin(true);
      }
    };

    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  async function checkDev(e) {
    e.preventDefault();
    setError('');

    try {
      await api('/api/dev/login', {
        method: 'POST',
        body: JSON.stringify({ password: devPassword })
      });

      localStorage.setItem('devAccess', 'true');
      setDevLogin(false);
      setDevPanel(true);
      setDevPassword('');
    } catch (err) {
      setError(err.message);
    }
  }

  function logout() {
    clearToken();
    setUser(null);
    setPage('home');
  }

  if (inviteOk === null) {
    return (
      <div className="center">
        Проверка доступа...
      </div>
    );
  }

  if (!inviteOk) {
    return (
      <div className="center denied">
        <h1>Доступ запрещён</h1>
        <p>Открой сайт по invite-ссылке.</p>
      </div>
    );
  }

  if (!user) {
    return <Auth onAuth={setUser} />;
  }

  return (
    <>
      <Layout page={page} setPage={setPage} user={user}>
        {page === 'home' && <Home />}
        {page === 'videos' && <Videos />}
        {page === 'messages' && <Messages me={user} />}
        {page === 'profile' && <Profile user={user} setUser={setUser} />}
        {page === 'settings' && <Settings onLogout={logout} />}
      </Layout>

      {devLogin && (
        <div className="modalBackdrop">
          <form className="modal" onSubmit={checkDev}>
            <h2>Режим разработчика</h2>
            <p>
              Пароль проверяется только на backend через process.env.DEV_PASSWORD.
            </p>

            {error && <p className="error">{error}</p>}

            <input
              type="password"
              value={devPassword}
              onChange={(e) => setDevPassword(e.target.value)}
              placeholder="Пароль разработчика"
            />

            <div className="row">
              <button type="submit">Войти</button>
              <button
                type="button"
                className="ghost"
                onClick={() => setDevLogin(false)}
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      <DevPanel open={devPanel} onClose={() => setDevPanel(false)} />
    </>
  );
}