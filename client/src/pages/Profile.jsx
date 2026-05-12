import React, { useEffect, useState } from 'react';
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
      <label>Аватар<input type="file" accept="image/*" onChange={e=>setAvatar(e.target.files[0])}/></label>
      <label>Обложка<input type="file" accept="image/*" onChange={e=>setCover(e.target.files[0])}/></label>
      <button>Сохранить</button>
    </form>}
    <h2>Посты</h2>
    <div className="grid">{posts.map(p=><div className="card" key={p.id}><p className="safeText">{p.text}</p>{p.imageUrl && <img className="postImage" src={fileUrl(p.imageUrl)}/>}<small>♥ {p.likes}</small></div>)}</div>
    <h2>Видео</h2>
    <div className="grid">{videos.map(v=><div className="card" key={v.id}><video className="miniVideo" src={fileUrl(v.videoUrl)} controls/><p className="safeText">{v.description}</p><small>♥ {v.likes}</small></div>)}</div>
  </section>;
}
