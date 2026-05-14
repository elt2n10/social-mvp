import React from 'react';
import { Home, MessageCircle, PlaySquare, Settings, User } from 'lucide-react';
import { fileUrl } from '../api/api';

const items = [
  ['home', 'Главная', Home],
  ['videos', 'Видео', PlaySquare],
  ['messages', 'Сообщения', MessageCircle],
  ['profile', 'Профиль', User],
  ['settings', 'Настройки', Settings]
];

export default function Layout({ page, setPage, user, children, config, onlineCount, openMyProfile }) {
  function go(key) {
    if (key === 'profile') return openMyProfile?.();
    setPage(key);
  }

  return <div className="appShell">
    <aside className="sidebar">
      <button className="brand brandButton" onClick={() => setPage('home')}>
        <span className="brandTextOnly">{config?.siteName || 'Yved'}</span>
      </button>
      <button className="miniProfile cleanButton" onClick={openMyProfile}>
        {user?.avatar ? <img className="avatarImage" src={fileUrl(user.avatar)} /> : <div className="avatar">{user?.username?.[0]?.toUpperCase()}</div>}
        <div><b>{user?.username}</b><small>{onlineCount ? `Онлайн: ${onlineCount}` : 'Профиль'}</small></div>
      </button>
      <nav>
        {items.map(([key, label, Icon]) => <button key={key} className={page === key ? 'active' : ''} onClick={() => go(key)}><Icon size={19}/>{label}</button>)}
      </nav>
    </aside>
    <main className="content pageFade">{children}</main>
    <nav className="bottomNav">
      {items.map(([key, label, Icon]) => <button key={key} className={page === key ? 'active' : ''} onClick={() => go(key)}><Icon size={20}/><small>{label}</small></button>)}
    </nav>
  </div>;
}
