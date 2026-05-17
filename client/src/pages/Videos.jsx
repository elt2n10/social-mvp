import React, { useEffect, useRef, useState } from 'react';
import { api, fileUrl } from '../api/api';
import ReportButton from '../components/ReportButton';

const LIMIT = 12;

function makeHandle(username) {
  return '@' + String(username || 'user').replace(/^@+/, '').toLowerCase();
}

export default function Videos({ openProfile }) {
  const [videos, setVideos] = useState([]);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState('');
  const [comment, setComment] = useState({});
  const [hasMore, setHasMore] = useState(true);
  const [soundOn, setSoundOn] = useState(true);
  const [openComments, setOpenComments] = useState(null);
  const videoRefs = useRef({});

  useEffect(() => {
    document.body.classList.add('videoMode');
    return () => { document.body.classList.remove('videoMode'); pauseAll(); };
  }, []);

  async function load(reset = false) {
    const nextOffset = reset ? 0 : offset;
    const data = await api(`/api/videos?limit=${LIMIT}&offset=${nextOffset}`);
    setVideos(reset ? data : [...videos, ...data]);
    setOffset(nextOffset + data.length);
    setHasMore(data.length === LIMIT);
  }

  useEffect(() => { load(true).catch(e=>setError(e.message)); }, []);
  useEffect(() => {
    const timer = setInterval(() => load(true).catch(()=>{}), 15000);
    return () => clearInterval(timer);
  }, []);

  function pauseAll(except = null) {
    Object.values(videoRefs.current).forEach(v => {
      if (v && v !== except) v.pause();
    });
  }

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const vid = entry.target.querySelector('video');
        if (!vid) return;

        if (entry.isIntersecting && entry.intersectionRatio > 0.72) {
          pauseAll(vid);
          vid.muted = !soundOn;
          vid.play().catch(() => {
            vid.muted = true;
            vid.play().catch(()=>{});
          });
        } else {
          vid.pause();
        }
      });
    }, { threshold: [0.15, 0.72, 0.95] });

    document.querySelectorAll('.videoCard').forEach(card => observer.observe(card));
    return () => { observer.disconnect(); pauseAll(); };
  }, [videos.length, soundOn]);

  useEffect(() => {
    const onVisibility = () => { if (document.hidden) pauseAll(); };
    window.addEventListener('pagehide', pauseAll);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', pauseAll);
      document.removeEventListener('visibilitychange', onVisibility);
      pauseAll();
    };
  }, []);

  function toggleSound() {
    setSoundOn(prev => {
      const next = !prev;
      Object.values(videoRefs.current).forEach(v => {
        if (v) v.muted = !next;
      });
      return next;
    });
  }

  async function like(id) {
    await api(`/api/videos/${id}/like`, { method:'POST' });
    await load(true);
  }

  async function addComment(id) {
    if (!comment[id]?.trim()) return;
    await api(`/api/videos/${id}/comments`, { method:'POST', body: JSON.stringify({ text: comment[id] }) });
    setComment({...comment,[id]:''});
    await load(true);
  }

  return <section className="videoPage tiktokVideoPage">
    {error && <p className="error">{error}</p>}

    <div className="videoFeed tiktokFeed">
      {videos.map((v, index) => <div className="videoCard tiktokCard pop" key={v.id}>
        <video
          onClick={(e)=> e.currentTarget.paused ? e.currentTarget.play().catch(()=>{}) : e.currentTarget.pause()}
          ref={el => { if (el) videoRefs.current[v.id] = el; }}
          src={fileUrl(v.videoUrl)}
          loop
          playsInline
          muted={!soundOn}
          preload={index < 2 ? 'auto' : 'metadata'}
        />
        <div className="videoGradient" />
        <div className="videoOverlay tiktokOverlay">
          <button className="authorButton nameStack videoName" onClick={()=>openProfile?.(v.authorId)}>
            <b>{v.authorDisplayName || v.authorName}</b>
            <small>{v.authorHandle || makeHandle(v.authorName)}</small>
          </button>
          <p className="safeText">{v.description}</p>
        </div>
        <div className="videoActions tiktokActions">
          <button className={v.likedByMe ? 'liked roundAction' : 'roundAction'} onClick={()=>like(v.id)}>♥<small>{v.likes}</small></button>
          <button className="roundAction ghost" onClick={()=>setOpenComments(openComments === v.id ? null : v.id)}>💬<small>{v.comments?.length || 0}</small></button>
          <button className="roundAction ghost" onClick={toggleSound}>{soundOn ? '🔊' : '🔇'}</button>
          <ReportButton targetType="video" targetId={v.id} className="roundAction ghost" />
        </div>
        {openComments === v.id && <div className="comments videoComments tiktokComments open">
          <div className="videoCommentsHandle" />
          <div className="row between commentsTop">
            <b className="commentsTitle">Комментарии · {v.comments?.length || 0}</b>
            <button type="button" className="ghost miniBtn" onClick={()=>setOpenComments(null)}>×</button>
          </div>
          <div className="videoCommentsList">
            {v.comments?.length ? v.comments.slice(-30).map(c => <div className="videoCommentItem" key={c.id}>
              <b className="clickable" onClick={()=>openProfile?.(c.authorId)}>{c.authorName}</b>
              <p className="safeText">{c.text}</p>
            </div>) : <p className="mutedText">Пока комментариев нет</p>}
          </div>
          <div className="row commentRow videoCommentInput"><input placeholder="Добавить комментарий" value={comment[v.id] || ''} onChange={e=>setComment({...comment,[v.id]:e.target.value})}/><button onClick={()=>addComment(v.id)}>➤</button></div>
        </div>}
      </div>)}
      {hasMore && <button className="ghost loadMore videoLoad" onClick={()=>load(false)}>Ещё видео</button>}
    </div>
  </section>;
}
