import React, { useEffect, useRef, useState } from 'react';
import { api, fileUrl } from '../api/api';

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
  const [postImage, setPostImage] = useState(null);
  const [videoDesc, setVideoDesc] = useState('');
  const [videoFile, setVideoFile] = useState(null);
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
  useEffect(()=>{ load(); }, [profileId]);

  async function save(e){
    e.preventDefault();
    const fd = new FormData();
    fd.append('username', username); fd.append('description', description); fd.append('profileColor', profileColor);
    if(avatar) fd.append('avatar', avatar); if(cover) fd.append('cover', cover);
    const updated = await api('/api/profile/me', { method:'PUT', body: fd });
    setUser(updated); setProfile(updated); setEdit(false);
  }

  async function publishPost(e) {
    e.preventDefault();
    if (!postText.trim() && !postImage) return;
    const fd = new FormData();
    fd.append('text', postText);
    if (postImage) fd.append('image', postImage);
    await api('/api/posts', { method:'POST', body: fd });
    setPostText(''); setPostImage(null); if (postFileRef.current) postFileRef.current.value = '';
    await load();
  }

  async function publishVideo(e) {
    e.preventDefault();
    if (!videoFile) return;
    const fd = new FormData();
    fd.append('description', videoDesc);
    fd.append('video', videoFile);
    await api('/api/videos', { method:'POST', body: fd });
    setVideoDesc(''); setVideoFile(null); if (videoFileRef.current) videoFileRef.current.value = '';
    await load();
  }

  if (!profile) return <section><h1>Профиль</h1><div className="card">Загрузка...</div></section>;

  return <section>
    <h1>{isMe ? 'Профиль' : `Профиль ${profile.username}`}</h1>
    <div className="card profileTop profileCard" style={{ borderColor: profile.profileColor || undefined }}>
      <div className="cover" style={{ backgroundImage: profile.coverUrl ? `url(${fileUrl(profile.coverUrl)})` : undefined, backgroundColor: profile.profileColor || undefined }} />
      <div className="profileInfo">
        {profile.avatar ? <img className="bigAvatar" src={fileUrl(profile.avatar)} /> : <div className="avatar huge">{profile.username?.[0]}</div>}
        <div className="profileText"><h2>{profile.username}</h2><p className="safeText">{profile.description || 'Описание пока пустое'}</p><small>Дата регистрации: {new Date(profile.createdAt).toLocaleDateString('ru-RU')}</small></div>
        {isMe ? <button onClick={()=>setEdit(!edit)}>Редактировать</button> : <button onClick={openMessages}>Написать</button>}
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
        <textarea maxLength={3000} placeholder="Напиши пост прямо из профиля" value={postText} onChange={e=>setPostText(e.target.value)} />
        <div className="row responsiveRow">
          <input ref={postFileRef} id="profilePostImage" className="hiddenFile" type="file" accept="image/*" onChange={e=>setPostImage(e.target.files[0] || null)}/>
          <label className="fileButton" htmlFor="profilePostImage">📷 {postImage ? postImage.name : 'Фото'}</label>
          <button>Опубликовать</button>
        </div>
      </form>
      <form className="card composer" onSubmit={publishVideo}>
        <h3>Новое видео</h3>
        <input maxLength={600} placeholder="Описание видео" value={videoDesc} onChange={e=>setVideoDesc(e.target.value)} />
        <div className="row responsiveRow">
          <input ref={videoFileRef} id="profileVideoInput" className="hiddenFile" type="file" accept="video/mp4,video/webm,video/quicktime" onChange={e=>setVideoFile(e.target.files[0] || null)}/>
          <label className="fileButton" htmlFor="profileVideoInput">🎬 {videoFile ? videoFile.name : 'Видео'}</label>
          <button>Загрузить</button>
        </div>
      </form>
    </div>}

    <h2>Посты</h2>
    <div className="grid">{posts.map(p=><div className="card" key={p.id}><p className="safeText">{p.text}</p>{p.imageUrl && <img className="postImage" src={fileUrl(p.imageUrl)}/>}<small>♥ {p.likes}</small></div>)}</div>
    <h2>Видео</h2>
    <div className="grid">{videos.map(v=><div className="card" key={v.id}><video className="miniVideo" src={fileUrl(v.videoUrl)} controls/><p className="safeText">{v.description}</p><small>♥ {v.likes}</small></div>)}</div>
  </section>;
}
