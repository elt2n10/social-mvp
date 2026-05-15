import React from 'react';
import { Home, MessageCircle, PlaySquare, Settings, User, Bell } from 'lucide-react';
import { fileUrl } from '../api/api';

const items = [
  ['home', 'Главная', Home],
  ['videos', 'Видео', PlaySquare],
  ['messages', 'Сообщения', MessageCircle],
  ['activity', 'Активность', Bell],
  ['profile', 'Профиль', User],
  ['settings', 'Настройки', Settings]
];

function makeHandle(username) {
  return '@' + String(username || 'user').replace(/^@+/, '').toLowerCase();
}

export default function Layout({ page, setPage, user, children, config, onlineCount, activityUnread = 0, openMyProfile }) {
  function go(key) {
    if (key === 'profile') return openMyProfile?.();
    setPage(key);
  }

  return <div className="appShell centeredShell">
    <aside className="sidebar fixedSidebar">
      <button className="brand brandButton" onClick={() => setPage('home')}>
        <span className="brandTextOnly">{config?.siteName || 'Yved'}</span>
      </button>

      <button className="miniProfile cleanButton" onClick={openMyProfile}>
        {user?.avatar ? <img className="avatarImage" src={fileUrl(user.avatar)} /> : <div className="avatar">{user?.username?.[0]?.toUpperCase()}</div>}
        <div className="nameStack">
          <b>{user?.displayName || user?.username}</b>
          <small>{makeHandle(user?.username)}</small>
        </div>
      </button>

      <nav>
        {items.map(([key, label, Icon]) => (
          <button key={key} className={page === key ? 'active' : ''} onClick={() => go(key)}>
            <Icon size={19}/>
            {label}
            {key === 'activity' && activityUnread > 0 && <span className="navBadge">{activityUnread}</span>}
          </button>
        ))}
      </nav>
    </aside>

    <main className="content pageFade centeredContent">{children}</main>

    <aside className="rightRail desktopInfoRail">
      <div className="card compactCard">
        <b>Yved</b>
        <small>Мини-панель сайта</small>
      </div>
      <div className="card compactCard">
        <b>Сейчас онлайн</b>
        <small>{onlineCount || 0} пользователей</small>
      </div>
      <div className="card compactCard">
        <b>Быстрые действия</b>
        <button className="ghost" onClick={openMyProfile}>Мой профиль</button>
        <button className="ghost" onClick={() => setPage('messages')}>Сообщения</button>
      </div>
    </aside>

    <nav className="bottomNav">
      {items.map(([key, label, Icon]) => (
        <button key={key} className={page === key ? 'active' : ''} onClick={() => go(key)}>
          <Icon size={20}/>
          <small>{label}</small>
          {key === 'activity' && activityUnread > 0 && <span className="navBadge mobile">{activityUnread}</span>}
        </button>
      ))}
    </nav>
  </div>;
}
