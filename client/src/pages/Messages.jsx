import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api, fileUrl } from '../api/api';

export default function Messages({ me, openProfile, config }) {
  const [dialogs, setDialogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const bodyRef = useRef(null);

  const stickers = useMemo(() => {
    const raw = config?.stickers || '😀,😂,😎,🔥,💜,👍,❤️,😭,😡,🎉';
    return String(raw).split(',').map(s => s.trim()).filter(Boolean).slice(0, 40);
  }, [config?.stickers]);

  async function loadDialogs(){ setDialogs(await api('/api/messages/dialogs')); }
  async function loadChat(id){ setMessages(await api(`/api/messages/with/${id}?limit=80`)); }
  useEffect(()=>{ loadDialogs(); }, []);
  useEffect(()=>{ if(active) loadChat(active.id); }, [active]);
  useEffect(()=>{ bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' }); }, [messages.length]);

  async function search() { setUsers(await api(`/api/messages/users/search?q=${encodeURIComponent(q)}`)); }
  async function sendMessage(value) {
    if (!active || !String(value).trim()) return;
    await api('/api/messages/send', { method:'POST', body: JSON.stringify({ toUserId: active.id, text: String(value).trim() }) });
    await loadChat(active.id); await loadDialogs();
  }
  async function send(e) {
    e.preventDefault();
    const msg = text;
    setText('');
    await sendMessage(msg);
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
          <div className="stickerBar">{stickers.map(st => <button key={st} type="button" className="stickerButton" onClick={()=>sendMessage(st)}>{st}</button>)}</div>
          <form className="chatInput" onSubmit={send}><input maxLength={2000} placeholder="Сообщение" value={text} onChange={e=>setText(e.target.value)}/><button>Отправить</button></form>
        </> : <div className="empty">Выбери диалог или найди пользователя</div>}
      </div>
    </div>
  </section>;
}
