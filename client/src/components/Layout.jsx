import React from 'react';
import { Home, MessageCircle, PlaySquare, Settings, User } from 'lucide-react';

const items = [
  ['home', 'Главная', Home],
  ['videos', 'Видео', PlaySquare],
  ['messages', 'Сообщения', MessageCircle],
  ['profile', 'Профиль', User],
  ['settings', 'Настройки', Settings]
];

export default function Layout({ page, setPage, user, children }) {
  return <div className="appShell">
    <aside className="sidebar">
      <div className="brand">NOVA<span>net</span></div>
      <div className="miniProfile">
        <div className="avatar">{user?.username?.[0]?.toUpperCase()}</div>
        <div><b>{user?.username}</b><small>{user?.email}</small></div>
      </div>
      <nav>
        {items.map(([key, label, Icon]) => <button key={key} className={page === key ? 'active' : ''} onClick={() => setPage(key)}><Icon size={19}/>{label}</button>)}
      </nav>
    </aside>
    <main className="content">{children}</main>
    <nav className="bottomNav">
      {items.map(([key, label, Icon]) => <button key={key} className={page === key ? 'active' : ''} onClick={() => setPage(key)}><Icon size={20}/><small>{label}</small></button>)}
    </nav>
  </div>;
}
