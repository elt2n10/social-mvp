import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api, fileUrl } from '../api/api';

function makeHandle(username) {
  return '@' + String(username || 'user').replace(/^@+/, '').toLowerCase();
}

export default function Messages({ me, openProfile, config }) {
  const [dialogs, setDialogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [stickers, setStickers] = useState([]);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [showStickers, setShowStickers] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupColor, setGroupColor] = useState('#7c3cff');
  const [members, setMembers] = useState([]);
  const [error, setError] = useState('');
  const bodyRef = useRef(null);

  const emojiFallback = useMemo(() => {
    const raw = config?.stickers || '😀,😂,😎,🔥,💜,👍,❤️,😭,😡,🎉';
    return String(raw).split(',').map(s => s.trim()).filter(Boolean).slice(0, 40);
  }, [config?.stickers]);

  async function loadDialogs(){ setDialogs(await api('/api/messages/dialogs')); }

  async function loadChat(target = active) {
    if (!target) return;
    if (target.type === 'group') {
      setMessages(await api(`/api/messages/groups/${target.id}/messages?limit=80`));
    } else {
      setMessages(await api(`/api/messages/with/${target.id}?limit=80`));
    }
  }

  async function loadStickers(){
    try { setStickers(await api('/api/messages/stickers')); }
    catch { setStickers([]); }
  }

  useEffect(()=>{ loadDialogs(); loadStickers(); }, []);
  useEffect(()=>{ const timer = setInterval(() => loadDialogs().catch(()=>{}), 4000); return () => clearInterval(timer); }, []);
  useEffect(()=>{ if(active) loadChat(active); }, [active?.type, active?.id]);
  useEffect(()=>{ if(!active) return; const timer = setInterval(() => loadChat(active).catch(()=>{}), 1800); return () => clearInterval(timer); }, [active?.type, active?.id]);
  useEffect(()=>{ bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' }); }, [messages.length]);

  async function search() {
    const found = await api(`/api/messages/users/search?q=${encodeURIComponent(q)}`);
    setUsers(found);
  }

  function toggleMember(user) {
    setMembers(prev => prev.some(x => x.id === user.id) ? prev.filter(x => x.id !== user.id) : [...prev, user].slice(0, 50));
  }

  async function createGroup(e) {
    e.preventDefault();
    setError('');
    try {
      const data = await api('/api/messages/groups', {
        method: 'POST',
        body: JSON.stringify({ name: groupName, color: groupColor, memberIds: members.map(m => m.id) })
      });
      setGroupName('');
      setMembers([]);
      setShowCreateGroup(false);
      await loadDialogs();
      setActive({ id: data.id, type: 'group', name: groupName, color: groupColor });
    } catch (err) { setError(err.message); }
  }

  async function sendMessage(value) {
    if (!active || !String(value).trim()) return;
    if (active.type === 'group') {
      await api(`/api/messages/groups/${active.id}/send`, { method:'POST', body: JSON.stringify({ text: String(value).trim() }) });
    } else {
      await api('/api/messages/send', { method:'POST', body: JSON.stringify({ toUserId: active.id, text: String(value).trim() }) });
    }
    await loadChat(active); await loadDialogs();
  }

  async function sendSticker(sticker) {
    if (!active) return;
    if (active.type === 'group') {
      await api(`/api/messages/groups/${active.id}/send`, { method:'POST', body: JSON.stringify({ stickerId: sticker.id }) });
    } else {
      await api('/api/messages/send', { method:'POST', body: JSON.stringify({ toUserId: active.id, stickerId: sticker.id }) });
    }
    setShowStickers(false);
    await loadChat(active); await loadDialogs();
  }

  async function sendEmojiSticker(value) {
    await sendMessage(value);
    setShowStickers(false);
  }

  async function send(e) {
    e.preventDefault();
    const msg = text;
    setText('');
    await sendMessage(msg);
  }

  const list = q ? users.map(u => ({ ...u, type: 'user', name: u.displayName || u.username })) : dialogs;

  return <section>
    <div className="row between pageHeader">
      <div>
        <h1>Сообщения</h1>
        <small>Личные сообщения и группы.</small>
      </div>
      <button className="ghost" onClick={()=>setShowCreateGroup(v=>!v)}>{showCreateGroup ? 'Закрыть' : 'Создать группу'}</button>
    </div>
    {error && <p className="error">{error}</p>}

    {showCreateGroup && <form className="card groupCreator" onSubmit={createGroup}>
      <h2>Новая группа</h2>
      <div className="row responsiveRow">
        <input placeholder="Название группы" value={groupName} onChange={e=>setGroupName(e.target.value)} maxLength={40} />
        <input className="colorInput" type="color" value={groupColor} onChange={e=>setGroupColor(e.target.value)} />
        <button>Создать</button>
      </div>
      <small>Найди пользователей ниже и нажми по ним, чтобы добавить в группу.</small>
      {members.length > 0 && <div className="pickedMembers">{members.map(m => <span key={m.id}>@{m.username}<button type="button" onClick={()=>toggleMember(m)}>×</button></span>)}</div>}
    </form>}

    <div className="messagesBox card stableMessagesBox">
      <aside className="dialogs">
        <div className="row searchRow"><input placeholder="Найти пользователя" value={q} onChange={e=>setQ(e.target.value)} /><button type="button" onClick={search}>Найти</button></div>
        {list.map(u => <button key={`${u.type || 'user'}-${u.id}`} className={active?.id===u.id && active?.type===(u.type || 'user') ? 'active dialogItem':'dialogItem'} onClick={()=>{
          if (showCreateGroup && (u.type || 'user') === 'user') toggleMember(u);
          else setActive({ ...u, type: u.type || 'user', name: u.name || u.username });
        }}>
          {u.avatar ? <img className="avatarImage tiny" src={fileUrl(u.avatar)} /> : <span className="avatar tiny" style={{ background: u.type === 'group' ? (u.color || undefined) : undefined }}>{u.type === 'group' ? 'G' : u.username?.[0]}</span>}
          <span><b>{u.type === 'group' ? u.name : (u.displayName || u.name || u.username)}</b><small>{u.type === 'group' ? `${u.lastMessage || 'Группа'} · ${u.memberCount || ''}` : `${makeHandle(u.username)} · ${u.lastMessage || u.description || 'Начать диалог'}`}</small></span>
        </button>)}
      </aside>
      <div className="chat">
        {active ? <>
          <div className="chatHeader">
            <button className="cleanButton row" onClick={()=> active.type === 'user' && openProfile?.(active.id)}>
              {active.avatar ? <img className="avatarImage small" src={fileUrl(active.avatar)} /> : <span className="avatar small" style={{ background: active.type === 'group' ? (active.color || undefined) : undefined }}>{active.type === 'group' ? 'G' : active.username?.[0]}</span>}
              <span className="nameStack"><b>{active.type === 'group' ? active.name : `Чат с ${active.displayName || active.name || active.username}`}</b>{active.type === 'user' && <small>{makeHandle(active.username)}</small>}</span>
            </button>
          </div>
          <div ref={bodyRef} className="chatBody noFlickerChat">
            {messages.map(m => <div key={m.id} className={m.fromUserId === me.id ? 'bubble mine' : 'bubble'}>
              {active.type === 'group' && m.fromUserId !== me.id && <small className="messageAuthor">@{m.authorName || 'user'}</small>}
              {m.messageType === 'sticker' && m.stickerUrl
                ? <img className="messageSticker" src={fileUrl(m.stickerUrl)} alt={m.text || 'sticker'} />
                : <span className="safeText">{m.text}</span>}
              <small>{new Date(m.createdAt).toLocaleTimeString('ru-RU')}</small>
            </div>)}
          </div>

          {showStickers && <div className="stickerPanel flatStickerPanel">
            {stickers.length > 0 ? stickers.map(st => <button key={st.id} type="button" className="stickerImageButton flatStickerButton" onClick={()=>sendSticker(st)} title={st.name}>
              <img src={fileUrl(st.imageUrl)} alt={st.name} />
            </button>) : emojiFallback.map(st => <button key={st} type="button" className="stickerButton flatStickerButton" onClick={()=>sendEmojiSticker(st)}>{st}</button>)}
          </div>}

          <form className="chatInput" onSubmit={send}>
            <button type="button" className="ghost stickerToggle" onClick={()=>setShowStickers(v=>!v)}>Стикеры</button>
            <input maxLength={2000} placeholder={active.type === 'group' ? 'Сообщение в группу' : 'Сообщение'} value={text} onChange={e=>setText(e.target.value)}/>
            <button>Отправить</button>
          </form>
        </> : <div className="empty">Выбери диалог, группу или найди пользователя</div>}
      </div>
    </div>
  </section>;
}
