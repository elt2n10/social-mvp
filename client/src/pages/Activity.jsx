import React, { useEffect, useState } from 'react';
import { api, fileUrl } from '../api/api';

function textFor(item) {
  const actor = item.actorName ? `@${item.actorName}` : 'Кто-то';
  if (item.type === 'post_like') return `${actor} лайкнул ваш пост`;
  if (item.type === 'video_like') return `${actor} лайкнул ваше видео`;
  if (item.type === 'profile_like') return `${actor} лайкнул ваш профиль`;
  if (item.type === 'post_comment') return `${actor} прокомментировал ваш пост`;
  if (item.type === 'video_comment') return `${actor} прокомментировал ваше видео`;
  if (item.type === 'follow') return `${actor} подписался на вас`;
  if (item.type === 'friend') return `${actor} теперь ваш друг`;
  if (item.type === 'message') return `${actor} написал вам сообщение`;
  if (item.type === 'group_message') return `${actor} написал в группе`;
  return `${actor} ${item.text || 'сделал действие'}`;
}

export default function Activity() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');

  async function load() {
    const data = await api('/api/activity?limit=80');
    setItems(data);
  }

  useEffect(() => {
    load().catch(e => setError(e.message));
    const timer = setInterval(() => load().catch(() => {}), 3000);
    return () => clearInterval(timer);
  }, []);

  async function markAllRead() {
    await api('/api/activity/read-all', { method: 'PUT' });
    await load();
  }

  async function enableNotifications() {
    if (!('Notification' in window)) return alert('Браузер не поддерживает уведомления');
    const result = await Notification.requestPermission();
    if (result === 'granted') new Notification('Yved', { body: 'Уведомления включены' });
  }

  return (
    <section>
      <div className="row between pageHeader">
        <div>
          <h1>Активность</h1>
          <small>Лайки, подписки, комментарии, друзья и другие события.</small>
        </div>
        <div className="row responsiveRow">
          <button className="ghost" onClick={enableNotifications}>Уведомления</button>
          <button onClick={markAllRead}>Прочитано</button>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="activityList">
        {items.length === 0 && <div className="card emptyActivity">Пока активности нет</div>}
        {items.map(item => (
          <div className={item.isRead ? 'card activityItem' : 'card activityItem unread'} key={item.id}>
            {item.actorAvatar ? <img className="avatarImage small" src={fileUrl(item.actorAvatar)} /> : <div className="avatar small">{item.actorName?.[0] || '?'}</div>}
            <div>
              <b>{textFor(item)}</b>
              <small>{new Date(item.createdAt).toLocaleString('ru-RU')}</small>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
