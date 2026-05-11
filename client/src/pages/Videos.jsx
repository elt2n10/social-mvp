import React, { useEffect, useState } from 'react';
import { api, fileUrl } from '../api/api';

export default function Videos() {
  const [videos, setVideos] = useState([]);
  const [description, setDescription] = useState('');
  const [video, setVideo] = useState(null);
  const [comment, setComment] = useState({});

  async function load() { setVideos(await api('/api/videos')); }
  useEffect(() => { load(); }, []);

  async function upload(e) {
    e.preventDefault();
    const fd = new FormData(); fd.append('description', description); if (video) fd.append('video', video);
    await api('/api/videos', { method:'POST', body: fd });
    setDescription(''); setVideo(null); await load();
  }
  async function like(id) { await api(`/api/videos/${id}/like`, { method:'POST' }); await load(); }
  async function addComment(id) { if (!comment[id]) return; await api(`/api/videos/${id}/comments`, { method:'POST', body: JSON.stringify({ text: comment[id] }) }); setComment({...comment,[id]:''}); await load(); }

  return <section>
    <h1>Короткие видео</h1>
    <form className="card composer" onSubmit={upload}>
      <input placeholder="Описание видео" value={description} onChange={e=>setDescription(e.target.value)} />
      <div className="row"><input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={e=>setVideo(e.target.files[0])}/><button>Загрузить</button></div>
    </form>
    <div className="videoFeed">
      {videos.map(v => <div className="videoCard" key={v.id}>
        <video src={fileUrl(v.videoUrl)} controls loop />
        <div className="videoOverlay"><b>@{v.authorName}</b><p>{v.description}</p><small>ID видео: {v.id}</small></div>
        <div className="videoActions"><button className={v.likedByMe ? 'liked' : ''} onClick={()=>like(v.id)}>♥ {v.likes}</button></div>
        <div className="comments videoComments">
          {v.comments.slice(-3).map(c => <p key={c.id}><b>{c.authorName}:</b> {c.text}</p>)}
          <div className="row"><input placeholder="Коммент" value={comment[v.id] || ''} onChange={e=>setComment({...comment,[v.id]:e.target.value})}/><button onClick={()=>addComment(v.id)}>OK</button></div>
        </div>
      </div>)}
    </div>
  </section>;
}
