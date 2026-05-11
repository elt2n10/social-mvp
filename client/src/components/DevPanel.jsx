import { useEffect, useState } from 'react';
import { api } from '../api/api';

export default function DevPanel({ open, onClose }) {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [postId, setPostId] = useState('');
  const [videoId, setVideoId] = useState('');
  const [error, setError] = useState('');

  async function load() {
    try {
      setStats(await api('/api/dev/stats'));
      setUsers(await api('/api/dev/users'));
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { if (open) load(); }, [open]);
  if (!open) return null;

  async function action(fn) { try { await fn(); await load(); } catch(e) { setError(e.message); } }

  return <div className="modalBackdrop">
    <div className="modal big">
      <div className="row between"><h2>Панель разработчика</h2><button onClick={onClose}>Закрыть</button></div>
      {error && <p className="error">{error}</p>}
      <div className="stats">
        <div><b>{stats?.users ?? 0}</b><span>пользователей</span></div>
        <div><b>{stats?.posts ?? 0}</b><span>постов</span></div>
        <div><b>{stats?.videos ?? 0}</b><span>видео</span></div>
      </div>
      <div className="devTools">
        <input placeholder="ID поста" value={postId} onChange={e=>setPostId(e.target.value)} />
        <button onClick={()=>action(()=>api(`/api/dev/posts/${postId}`, { method:'DELETE' }))}>Удалить пост</button>
        <input placeholder="ID видео" value={videoId} onChange={e=>setVideoId(e.target.value)} />
        <button onClick={()=>action(()=>api(`/api/dev/videos/${videoId}`, { method:'DELETE' }))}>Удалить видео</button>
      </div>
      <h3>Пользователи</h3>
      <div className="userList">
        {users.map(u => <div className="userRow" key={u.id}>
          <span>#{u.id} <b>{u.username}</b> {u.isBlocked ? '🚫' : ''}<small>{u.email}</small></span>
          <button onClick={()=>action(()=>api(`/api/dev/users/${u.id}/${u.isBlocked ? 'unblock':'block'}`, { method:'PUT' }))}>{u.isBlocked ? 'Разблокировать' : 'Заблокировать'}</button>
        </div>)}
      </div>
      <button className="danger" onClick={()=>{localStorage.removeItem('devAccess'); onClose();}}>Выйти из режима разработчика</button>
    </div>
  </div>;
}
