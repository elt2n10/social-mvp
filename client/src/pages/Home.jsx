import React, { useEffect, useRef, useState } from 'react';
import { api, fileUrl } from '../api/api';

const LIMIT = 20;

export default function Home({ openProfile }) {
  const [posts, setPosts] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [text, setText] = useState('');
  const [image, setImage] = useState(null);
  const [comment, setComment] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);

  async function load(reset = false) {
    setLoading(true);
    const nextOffset = reset ? 0 : offset;
    const data = await api(`/api/posts?limit=${LIMIT}&offset=${nextOffset}`);
    setPosts(reset ? data : [...posts, ...data]);
    setOffset(nextOffset + data.length);
    setHasMore(data.length === LIMIT);
    setLoading(false);
  }
  useEffect(() => { load(true).catch(e=>setError(e.message)); }, []);

  async function createPost(e) {
    e.preventDefault(); setError('');
    if (!text.trim() && !image) return setError('Добавь текст или фото');
    const fd = new FormData(); fd.append('text', text); if (image) fd.append('image', image);
    try { await api('/api/posts', { method:'POST', body:fd }); setText(''); setImage(null); if (fileRef.current) fileRef.current.value = ''; await load(true); } catch(e) { setError(e.message); }
  }
  async function like(id) { await api(`/api/posts/${id}/like`, { method:'POST' }); await load(true); }
  async function addComment(id) {
    if (!comment[id]?.trim()) return;
    await api(`/api/posts/${id}/comments`, { method:'POST', body: JSON.stringify({ text: comment[id] }) });
    setComment({...comment, [id]:''}); await load(true);
  }

  return <section>
    <h1>Главная лента</h1>
    <form className="card composer" onSubmit={createPost}>
      {error && <p className="error">{error}</p>}
      <textarea maxLength={3000} placeholder="Что нового?" value={text} onChange={e=>setText(e.target.value)} />
      <div className="row responsiveRow">
        <input ref={fileRef} id="postImageInput" className="hiddenFile" type="file" accept="image/*" onChange={e=>setImage(e.target.files[0] || null)}/>
        <label className="fileButton" htmlFor="postImageInput">📷 {image ? image.name : 'Добавить фото'}</label>
        <button>Опубликовать</button>
      </div>
    </form>
    <div className="feed">
      {posts.map(p => <article className="card post pop" key={p.id}>
        <div className="postHead clickable" onClick={()=>openProfile?.(p.authorId)}>
          {p.authorAvatar ? <img className="avatarImage small" src={fileUrl(p.authorAvatar)} /> : <div className="avatar small">{p.authorName?.[0]}</div>}
          <div><b>{p.authorName}</b><small>{new Date(p.createdAt).toLocaleString('ru-RU')} · ID поста: {p.id}</small></div>
        </div>
        {p.text && <p className="safeText">{p.text}</p>}
        {p.imageUrl && <img className="postImage" src={fileUrl(p.imageUrl)} alt="post" loading="lazy" />}
        <button className={p.likedByMe ? 'liked' : ''} onClick={()=>like(p.id)}>♥ {p.likes}</button>
        <div className="comments">
          {p.comments.map(c => <p className="safeText" key={c.id}><b className="clickable" onClick={()=>openProfile?.(c.authorId)}>{c.authorName}:</b> {c.text}</p>)}
          <div className="row commentRow"><input placeholder="Комментарий" value={comment[p.id] || ''} onChange={e=>setComment({...comment,[p.id]:e.target.value})}/><button type="button" onClick={()=>addComment(p.id)}>OK</button></div>
        </div>
      </article>)}
      {hasMore && <button className="ghost loadMore" disabled={loading} onClick={()=>load(false)}>{loading ? 'Загрузка...' : 'Загрузить ещё'}</button>}
    </div>
  </section>;
}
