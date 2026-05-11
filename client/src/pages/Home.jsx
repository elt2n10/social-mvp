import React, { useEffect, useState } from 'react';
import { api, fileUrl } from '../api/api';

export default function Home() {
  const [posts, setPosts] = useState([]);
  const [text, setText] = useState('');
  const [image, setImage] = useState(null);
  const [comment, setComment] = useState({});
  const [error, setError] = useState('');

  async function load() { setPosts(await api('/api/posts')); }
  useEffect(() => { load().catch(e=>setError(e.message)); }, []);

  async function createPost(e) {
    e.preventDefault(); setError('');
    const fd = new FormData(); fd.append('text', text); if (image) fd.append('image', image);
    try { await api('/api/posts', { method:'POST', body:fd }); setText(''); setImage(null); await load(); } catch(e) { setError(e.message); }
  }
  async function like(id) { await api(`/api/posts/${id}/like`, { method:'POST' }); await load(); }
  async function addComment(id) {
    if (!comment[id]) return;
    await api(`/api/posts/${id}/comments`, { method:'POST', body: JSON.stringify({ text: comment[id] }) });
    setComment({...comment, [id]:''}); await load();
  }

  return <section>
    <h1>Главная лента</h1>
    <form className="card composer" onSubmit={createPost}>
      {error && <p className="error">{error}</p>}
      <textarea placeholder="Что нового?" value={text} onChange={e=>setText(e.target.value)} />
      <div className="row"><input type="file" accept="image/*" onChange={e=>setImage(e.target.files[0])}/><button>Опубликовать</button></div>
    </form>
    <div className="feed">
      {posts.map(p => <article className="card post" key={p.id}>
        <div className="postHead"><div className="avatar small">{p.authorName?.[0]}</div><div><b>{p.authorName}</b><small>{new Date(p.createdAt).toLocaleString('ru-RU')} · ID поста: {p.id}</small></div></div>
        {p.text && <p>{p.text}</p>}
        {p.imageUrl && <img className="postImage" src={fileUrl(p.imageUrl)} />}
        <button className={p.likedByMe ? 'liked' : ''} onClick={()=>like(p.id)}>♥ {p.likes}</button>
        <div className="comments">
          {p.comments.map(c => <p key={c.id}><b>{c.authorName}:</b> {c.text}</p>)}
          <div className="row"><input placeholder="Комментарий" value={comment[p.id] || ''} onChange={e=>setComment({...comment,[p.id]:e.target.value})}/><button onClick={()=>addComment(p.id)}>OK</button></div>
        </div>
      </article>)}
    </div>
  </section>;
}
