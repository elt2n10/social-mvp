import React, { useEffect, useState } from 'react';
import { api } from '../api/api';

export default function Messages({ me }) {
  const [dialogs, setDialogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');

  async function loadDialogs(){ setDialogs(await api('/api/messages/dialogs')); }
  async function loadChat(id){ setMessages(await api(`/api/messages/with/${id}`)); }
  useEffect(()=>{ loadDialogs(); }, []);
  useEffect(()=>{ if(active) loadChat(active.id); }, [active]);

  async function search() { setUsers(await api(`/api/messages/users/search?q=${encodeURIComponent(q)}`)); }
  async function send(e) { e.preventDefault(); if (!active || !text.trim()) return; await api('/api/messages/send', { method:'POST', body: JSON.stringify({ toUserId: active.id, text }) }); setText(''); await loadChat(active.id); await loadDialogs(); }

  const list = q ? users : dialogs;
  return <section>
    <h1>Сообщения</h1>
    <div className="messagesBox card">
      <aside className="dialogs">
        <div className="row"><input placeholder="Найти пользователя" value={q} onChange={e=>setQ(e.target.value)} /><button onClick={search}>Найти</button></div>
        {list.map(u => <button key={u.id} className={active?.id===u.id?'active':''} onClick={()=>setActive(u)}><b>{u.username}</b><small>{u.lastMessage || u.description || 'Начать диалог'}</small></button>)}
      </aside>
      <div className="chat">
        {active ? <>
          <h3>Чат с {active.username}</h3>
          <div className="chatBody">{messages.map(m => <div key={m.id} className={m.fromUserId === me.id ? 'bubble mine' : 'bubble'}>{m.text}<small>{new Date(m.createdAt).toLocaleTimeString('ru-RU')}</small></div>)}</div>
          <form className="row" onSubmit={send}><input placeholder="Сообщение" value={text} onChange={e=>setText(e.target.value)}/><button>Отправить</button></form>
        </> : <div className="empty">Выбери диалог или найди пользователя</div>}
      </div>
    </div>
  </section>;
}
