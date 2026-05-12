import React, { useEffect, useRef, useState } from 'react';
import { api, fileUrl } from '../api/api';

export default function Messages({ me, openProfile }) {
  const [dialogs, setDialogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const bodyRef = useRef(null);

  async function loadDialogs(){ setDialogs(await api('/api/messages/dialogs')); }
  async function loadChat(id){ setMessages(await api(`/api/messages/with/${id}?limit=80`)); }
  useEffect(()=>{ loadDialogs(); }, []);
  useEffect(()=>{ if(active) loadChat(active.id); }, [active]);
  useEffect(()=>{ bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' }); }, [messages.length]);

  async function search() { setUsers(await api(`/api/messages/users/search?q=${encodeURIComponent(q)}`)); }
  async function send(e) {
    e.preventDefault();
    if (!active || !text.trim()) return;
    const msg = text;
    setText('');
    await api('/api/messages/send', { method:'POST', body: JSON.stringify({ toUserId: active.id, text: msg }) });
    await loadChat(active.id); await loadDialogs();
  }

  const list = q ? users : dialogs;
  return <section>
    <h1>Сообщения</h1>
    <div className="messagesBox card">
      <aside className="dialogs">
        <div className="row searchRow"><input placeholder="Найти пользователя" value={q} onChange={e=>setQ(e.target.value)} /><button onClick={search}>Найти</button></div>
        {list.map(u => <button key={u.id} className={active?.id===u.id?'active dialogItem':'dialogItem'} onClick={()=>setActive(u)}>
          {u.avatar ? <img className="avatarImage tiny" src={fileUrl(u.avatar)} /> : <span className="avatar tiny">{u.username?.[0]}</span>}
          <span><b>{u.username}</b><small>{u.lastMessage || u.description || 'Начать диалог'}</small></span>
        </button>)}
      </aside>
      <div className="chat">
        {active ? <>
          <div className="chatHeader">
            <button className="cleanButton row" onClick={()=>openProfile?.(active.id)}>
              {active.avatar ? <img className="avatarImage small" src={fileUrl(active.avatar)} /> : <span className="avatar small">{active.username?.[0]}</span>}
              <b>Чат с {active.username}</b>
            </button>
          </div>
          <div ref={bodyRef} className="chatBody">{messages.map(m => <div key={m.id} className={m.fromUserId === me.id ? 'bubble mine' : 'bubble'}><span className="safeText">{m.text}</span><small>{new Date(m.createdAt).toLocaleTimeString('ru-RU')}</small></div>)}</div>
          <form className="chatInput" onSubmit={send}><input maxLength={2000} placeholder="Сообщение" value={text} onChange={e=>setText(e.target.value)}/><button>Отправить</button></form>
        </> : <div className="empty">Выбери диалог или найди пользователя</div>}
      </div>
    </div>
  </section>;
}
