import React, { useEffect, useRef, useState } from 'react';
import { api, fileUrl } from '../api/api';
import { validateVideoFile } from '../utils/media';

const LIMIT = 12;

export default function Videos({ openProfile }) {
  const [videos, setVideos] = useState([]);
  const [offset, setOffset] = useState(0);
  const [description, setDescription] = useState('');
  const [video, setVideo] = useState(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [error, setError] = useState('');
  const [comment, setComment] = useState({});
  const [hasMore, setHasMore] = useState(true);
  const videoRefs = useRef({});
  const fileRef = useRef(null);

  async function load(reset = false) {
    const nextOffset = reset ? 0 : offset;
    const data = await api(`/api/videos?limit=${LIMIT}&offset=${nextOffset}`);
    setVideos(reset ? data : [...videos, ...data]);
    setOffset(nextOffset + data.length);
    setHasMore(data.length === LIMIT);
  }
  useEffect(() => { load(true); }, []);
  useEffect(() => {
    const timer = setInterval(() => load(true).catch(()=>{}), 15000);
    return () => clearInterval(timer);
  }, []);

  function pauseAll(except = null) {
    Object.values(videoRefs.current).forEach(v => { if (v && v !== except) v.pause(); });
  }

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const vid = entry.target.querySelector('video');
        if (!vid) return;
        if (entry.isIntersecting && entry.intersectionRatio > 0.72) {
          pauseAll(vid);
          vid.muted = true;
          vid.play().catch(()=>{});
        } else {
          vid.pause();
        }
      });
    }, { threshold: [0.15, 0.72, 0.95] });

    document.querySelectorAll('.videoCard').forEach(card => observer.observe(card));
    return () => { observer.disconnect(); pauseAll(); };
  }, [videos.length]);

  // Если пользователь ушёл на другую вкладку браузера — ставим видео на паузу.
  useEffect(() => {
    const onVisibility = () => { if (document.hidden) pauseAll(); };
    window.addEventListener('pagehide', pauseAll);
    document.addEventListener('visibilitychange', onVisibility);
    return () => { window.removeEventListener('pagehide', pauseAll); document.removeEventListener('visibilitychange', onVisibility); pauseAll(); };
  }, []);

  async function onPickVideo(e) {
    setError('');
    const file = e.target.files?.[0] || null;
    try {
      const result = await validateVideoFile(file);
      setVideo(result.file);
      setVideoDuration(result.duration);
    } catch (err) {
      setVideo(null); setVideoDuration(0);
      if (fileRef.current) fileRef.current.value = '';
      setError(err.message);
    }
  }

  async function upload(e) {
    e.preventDefault();
    setError('');
    if (!video) return;
    const fd = new FormData();
    fd.append('description', description);
    fd.append('duration', String(videoDuration || 0));
    fd.append('video', video);
    try {
      await api('/api/videos', { method:'POST', body: fd });
      setDescription(''); setVideo(null); setVideoDuration(0); if (fileRef.current) fileRef.current.value = ''; await load(true);
    } catch (err) { setError(err.message); }
  }
  async function like(id) { await api(`/api/videos/${id}/like`, { method:'POST' }); await load(true); }
  async function addComment(id) { if (!comment[id]?.trim()) return; await api(`/api/videos/${id}/comments`, { method:'POST', body: JSON.stringify({ text: comment[id] }) }); setComment({...comment,[id]:''}); await load(true); }

  return <section className="videoPage">
    <div className="videoTop">
      <h1>Видео</h1>
      <form className="card composer videoUpload" onSubmit={upload}>
        {error && <p className="error">{error}</p>}
        <input maxLength={600} placeholder="Описание видео" value={description} onChange={e=>setDescription(e.target.value)} />
        <small>Видео до 1 минуты. Длиннее сайт не даст опубликовать.</small>
        <div className="row responsiveRow">
          <input ref={fileRef} id="videoInput" className="hiddenFile" type="file" accept="video/mp4,video/webm,video/quicktime" onChange={onPickVideo}/>
          <label className="fileButton" htmlFor="videoInput">🎬 {video ? `${video.name} (${Math.round(videoDuration)}с)` : 'Выбрать видео до 1 мин'}</label>
          <button>Загрузить</button>
        </div>
      </form>
    </div>
    <div className="videoFeed">
      {videos.map((v, index) => <div className="videoCard pop" key={v.id}>
        <video onClick={(e)=> e.currentTarget.paused ? e.currentTarget.play().catch(()=>{}) : e.currentTarget.pause()} ref={el => { if (el) videoRefs.current[v.id] = el; }} src={fileUrl(v.videoUrl)} loop playsInline muted preload={index < 2 ? 'auto' : 'metadata'} />
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
