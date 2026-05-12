import React, { useEffect, useRef, useState } from 'react';
import { api, fileUrl } from '../api/api';

const LIMIT = 12;

export default function Videos({ openProfile }) {
  const [videos, setVideos] = useState([]);
  const [offset, setOffset] = useState(0);
  const [description, setDescription] = useState('');
  const [video, setVideo] = useState(null);
  const [comment, setComment] = useState({});
  const [hasMore, setHasMore] = useState(true);
  const videoRefs = useRef({});

  async function load(reset = false) {
    const nextOffset = reset ? 0 : offset;
    const data = await api(`/api/videos?limit=${LIMIT}&offset=${nextOffset}`);
    setVideos(reset ? data : [...videos, ...data]);
    setOffset(nextOffset + data.length);
    setHasMore(data.length === LIMIT);
  }
  useEffect(() => { load(true); }, []);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const vid = entry.target.querySelector('video');
        if (!vid) return;
        if (entry.isIntersecting && entry.intersectionRatio > 0.65) {
          Object.values(videoRefs.current).forEach(v => { if (v && v !== vid) v.pause(); });
          vid.play().catch(()=>{});
        } else {
          vid.pause();
        }
      });
    }, { threshold: [0.2, 0.65, 0.9] });

    document.querySelectorAll('.videoCard').forEach(card => observer.observe(card));
    return () => observer.disconnect();
  }, [videos.length]);

  async function upload(e) {
    e.preventDefault();
    const fd = new FormData(); fd.append('description', description); if (video) fd.append('video', video);
    await api('/api/videos', { method:'POST', body: fd });
    setDescription(''); setVideo(null); await load(true);
  }
  async function like(id) { await api(`/api/videos/${id}/like`, { method:'POST' }); await load(true); }
  async function addComment(id) { if (!comment[id]?.trim()) return; await api(`/api/videos/${id}/comments`, { method:'POST', body: JSON.stringify({ text: comment[id] }) }); setComment({...comment,[id]:''}); await load(true); }

  return <section className="videoPage">
    <div className="videoTop">
      <h1>Видео</h1>
      <form className="card composer videoUpload" onSubmit={upload}>
        <input maxLength={600} placeholder="Описание видео" value={description} onChange={e=>setDescription(e.target.value)} />
        <div className="row responsiveRow"><input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={e=>setVideo(e.target.files[0])}/><button>Загрузить</button></div>
      </form>
    </div>
    <div className="videoFeed">
      {videos.map((v, index) => <div className="videoCard pop" key={v.id}>
        <video ref={el => { if (el) videoRefs.current[v.id] = el; }} src={fileUrl(v.videoUrl)} loop playsInline preload={index < 2 ? 'auto' : 'metadata'} />
        <div className="videoGradient" />
        <div className="videoOverlay">
          <button className="authorButton" onClick={()=>openProfile?.(v.authorId)}>@{v.authorName}</button>
          <p className="safeText">{v.description}</p><small>ID видео: {v.id}</small>
        </div>
        <div className="videoActions"><button className={v.likedByMe ? 'liked roundAction' : 'roundAction'} onClick={()=>like(v.id)}>♥<small>{v.likes}</small></button></div>
        <div className="comments videoComments">
          {v.comments.slice(-2).map(c => <p className="safeText" key={c.id}><b className="clickable" onClick={()=>openProfile?.(c.authorId)}>{c.authorName}:</b> {c.text}</p>)}
          <div className="row commentRow"><input placeholder="Коммент" value={comment[v.id] || ''} onChange={e=>setComment({...comment,[v.id]:e.target.value})}/><button onClick={()=>addComment(v.id)}>OK</button></div>
        </div>
      </div>)}
      {hasMore && <button className="ghost loadMore videoLoad" onClick={()=>load(false)}>Ещё видео</button>}
    </div>
  </section>;
}
