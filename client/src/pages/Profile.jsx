import React, { useEffect, useRef, useState } from 'react';
import { api, fileUrl } from '../api/api';
import { MAX_POST_CHARS, MAX_POST_IMAGES, preparePostImages, validateVideoFile } from '../utils/media';

function PostImages({ images = [] }) {
  if (!images.length) return null;
  return <div className={images.length === 1 ? 'postImages single' : 'postImages'}>
    {images.slice(0, MAX_POST_IMAGES).map((url, i) => <img className="postImage" key={url + i} src={fileUrl(url)} alt="post" loading="lazy" />)}
  </div>;
}

export default function Profile({ user, setUser, profileId, openMessages }) {
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [videos, setVideos] = useState([]);
  const [edit, setEdit] = useState(false);
  const [username, setUsername] = useState(user.username);
  const [description, setDescription] = useState(user.description || '');
  const [profileColor, setProfileColor] = useState(user.profileColor || '');
  const [avatar, setAvatar] = useState(null);
  const [cover, setCover] = useState(null);
  const [postText, setPostText] = useState('');
  const [postImages, setPostImages] = useState([]);
  const [videoDesc, setVideoDesc] = useState('');
  const [videoFile, setVideoFile] = useState(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [error, setError] = useState('');
  const postFileRef = useRef(null);
  const videoFileRef = useRef(null);
  const isMe = Number(profileId) === Number(user.id);

  async function load(){
    const p = await api(`/api/profile/${profileId}`);
    setProfile(p);
    setUsername(p.username); setDescription(p.description || ''); setProfileColor(p.profileColor || '');
    setPosts(await api(`/api/posts/user/${profileId}`));
    setVideos(await api(`/api/videos/user/${profileId}`));
  }
  useEffect(()=>{ setError(''); load().catch(e => setError(e.message)); }, [profileId]);

  async function save(e){
    e.preventDefault();
    const fd = new FormData();
    fd.append('username', username); fd.append('description', description); fd.append('profileColor', profileColor);
    if(avatar) fd.append('avatar', avatar); if(cover) fd.append('cover', cover);
    const updated = await api('/api/profile/me', { method:'PUT', body: fd });
    setUser(updated); setProfile(updated); setEdit(false);
  }

  async function onPickPostImages(e) {
    setError('');
    try {
      const pickedFiles = Array.from(e.target.files || []);
      const freeSlots = MAX_POST_IMAGES - postImages.length;
      if (freeSlots <= 0) {
        if (postFileRef.current) postFileRef.current.value = '';
        return setError(`Можно добавить максимум ${MAX_POST_IMAGES} фото`);
      }

      const prepared = await preparePostImages(pickedFiles.slice(0, freeSlots));

      setPostImages(prev => {
        const merged = [...prev, ...prepared];
        const unique = [];
        const keys = new Set();

        for (const img of merged) {
          const key = `${img.name}-${img.size}-${img.lastModified}`;
          if (!keys.has(key)) {
            keys.add(key);
            unique.push(img);
          }
        }

        return unique.slice(0, MAX_POST_IMAGES);
      });

      if (postFileRef.current) postFileRef.current.value = '';
    } catch (err) {
      if (postFileRef.current) postFileRef.current.value = '';
      setError(err.message);
    }
  }

  async function onPickVideo(e) {
    setError('');
    const file = e.target.files?.[0] || null;
    try {
      const result = await validateVideoFile(file);
      setVideoFile(result.file);
      setVideoDuration(result.duration);
    } catch (err) {
      setVideoFile(null); setVideoDuration(0);
      if (videoFileRef.current) videoFileRef.current.value = '';
      setError(err.message);
    }
  }

  async function publishPost(e) {
    e.preventDefault(); setError('');
    if (!postText.trim() && postImages.length === 0) return;
    const fd = new FormData();
    fd.append('text', postText.slice(0, MAX_POST_CHARS));
    postImages.forEach(img => fd.append('images[]', img));
    await api('/api/posts', { method:'POST', body: fd });
    setPostText(''); setPostImages([]); if (postFileRef.current) postFileRef.current.value = '';
    await load();
  }

  async function publishVideo(e) {
    e.preventDefault(); setError('');
    if (!videoFile) return;
    const fd = new FormData();
    fd.append('description', videoDesc);
    fd.append('duration', String(videoDuration || 0));
    fd.append('video', videoFile);
    await api('/api/videos', { method:'POST', body: fd });
    setVideoDesc(''); setVideoFile(null); setVideoDuration(0); if (videoFileRef.current) videoFileRef.current.value = '';
    await load();
  }

  async function toggleFollow() {
    if (!profile || profile.isMe) return;
    if (profile.isFollowing) await api(`/api/profile/${profile.id}/follow`, { method: 'DELETE' });
    else await api(`/api/profile/${profile.id}/follow`, { method: 'POST' });
    await load();
  }

  if (!profile) return <section><h1>Профиль</h1><div className="card">Загрузка...</div></section>;

  return <section>
    <h1>{isMe ? 'Профиль' : `Профиль ${profile.username}`}</h1>
    {error && <p className="error">{error}</p>}
    <div className="card profileTop profileCard" style={{ borderColor: profile.profileColor || undefined }}>
      <div className="cover" style={{ backgroundImage: profile.coverUrl ? `url(${fileUrl(profile.coverUrl)})` : undefined, backgroundColor: profile.profileColor || undefined }} />
      <div className="profileInfo">
        {profile.avatar ? <img className="bigAvatar" src={fileUrl(profile.avatar)} /> : <div className="avatar huge">{profile.username?.[0]}</div>}
        <div className="profileText">
          <h2>{profile.username}</h2>
          <p className="safeText">{profile.description || 'Описание пока пустое'}</p>
          <small>Дата регистрации: {new Date(profile.createdAt).toLocaleDateString('ru-RU')}</small>
          <div className="followStats"><span>{profile.followersCount || 0} подписчиков</span><span>{profile.followingCount || 0} подписок</span>{profile.isFriend && <b>Друзья</b>}</div>
        </div>
        {isMe ? <button onClick={()=>setEdit(!edit)}>Редактировать</button> : <div className="profileActions"><button onClick={toggleFollow}>{profile.isFollowing ? 'Отписаться' : 'Подписаться'}</button><button className="ghost" onClick={openMessages}>Написать</button></div>}
      </div>
    </div>

    {isMe && edit && <form className="card composer" onSubmit={save}>
      <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Имя" />
      <textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Описание" />
      <label>Цвет профиля<input type="color" value={profileColor || '#7c3cff'} onChange={e=>setProfileColor(e.target.value)}/></label>
      <label className="fileButton inlineFile">Аватар<input type="file" accept="image/*" onChange={e=>setAvatar(e.target.files[0])}/></label>
      <label className="fileButton inlineFile">Обложка<input type="file" accept="image/*" onChange={e=>setCover(e.target.files[0])}/></label>
      <button>Сохранить</button>
    </form>}

    {isMe && <div className="profilePublishGrid">
      <form className="card composer" onSubmit={publishPost}>
        <h3>Новый пост</h3>
        <textarea maxLength={MAX_POST_CHARS} placeholder="Напиши пост прямо из профиля" value={postText} onChange={e=>setPostText(e.target.value.slice(0, MAX_POST_CHARS))} />
        <small className={postText.length >= MAX_POST_CHARS ? 'limitWarn' : ''}>{postText.length}/{MAX_POST_CHARS}</small>
        {postImages.length > 0 && <div className="pickedFiles">{postImages.map((img, i)=><span key={`${img.name}-${i}`}>📷 {img.name}<button type="button" className="miniRemove" onClick={() => setPostImages(prev => prev.filter((_, index) => index !== i))}>×</button></span>)}</div>}
        <div className="row responsiveRow">
          <input ref={postFileRef} id="profilePostImage" className="hiddenFile" type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" onChange={onPickPostImages}/>
          <label className="fileButton" htmlFor="profilePostImage">📷 {postImages.length ? `Фото: ${postImages.length}/${MAX_POST_IMAGES}` : 'До 10 фото'}</label>
          <button>Опубликовать</button>
        </div>
      </form>
      <form className="card composer" onSubmit={publishVideo}>
        <h3>Новое видео</h3>
        <input maxLength={600} placeholder="Описание видео" value={videoDesc} onChange={e=>setVideoDesc(e.target.value)} />
        <small>Видео до 1 минуты. Длиннее не публикуется.</small>
        <div className="row responsiveRow">
          <input ref={videoFileRef} id="profileVideoInput" className="hiddenFile" type="file" accept="video/mp4,video/webm,video/quicktime" onChange={onPickVideo}/>
          <label className="fileButton" htmlFor="profileVideoInput">🎬 {videoFile ? `${videoFile.name} (${Math.round(videoDuration)}с)` : 'Видео до 1 мин'}</label>
          <button>Загрузить</button>
        </div>
      </form>
    </div>}

    <h2>Посты</h2>
    <div className="grid">{posts.map(p=><div className="card" key={p.id}><p className="safeText">{p.text}</p><PostImages images={p.imageUrls || (p.imageUrl ? [p.imageUrl] : [])}/><small>♥ {p.likes}</small></div>)}</div>
    <h2>Видео</h2>
    <div className="grid">{videos.map(v=><div className="card" key={v.id}><video className="miniVideo" src={fileUrl(v.videoUrl)} controls/><p className="safeText">{v.description}</p><small>♥ {v.likes}</small></div>)}</div>
  </section>;
}
