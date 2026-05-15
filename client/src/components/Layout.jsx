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

export default function Layout({ page, setPage, user, children, config, onlineCount, activityUnread = 0, openMyProfile }) {
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
        {items.map(([key, label, Icon]) => <button key={key} className={page === key ? 'active' : ''} onClick={() => go(key)}><Icon size={19}/>{label}{key === 'activity' && activityUnread > 0 && <span className="navBadge">{activityUnread}</span>}</button>)}
      </nav>
    </aside>
    <main className="content pageFade">{children}</main>
    <aside className="rightRail">
      <div className="card compactCard"><b>Yved</b><small>Онлайн: {onlineCount || 0}</small></div>
      <div className="card compactCard"><b>Активность</b><small>{activityUnread ? `Новых событий: ${activityUnread}` : 'Новых событий нет'}</small><button className="ghost" onClick={() => setPage('activity')}>Открыть</button></div>
    </aside>
    <nav className="bottomNav">
      {items.map(([key, label, Icon]) => <button key={key} className={page === key ? 'active' : ''} onClick={() => go(key)}><Icon size={20}/><small>{label}</small>{key === 'activity' && activityUnread > 0 && <span className="navBadge mobile">{activityUnread}</span>}</button>)}
    </nav>
  </div>;
}
