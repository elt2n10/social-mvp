import React, { useEffect, useState } from 'react';
import { api, fileUrl } from '../api/api';

export default function Profile({ user, setUser }) {
  const [profile, setProfile] = useState(user);
  const [posts, setPosts] = useState([]);
  const [videos, setVideos] = useState([]);
  const [edit, setEdit] = useState(false);
  const [username, setUsername] = useState(user.username);
  const [description, setDescription] = useState(user.description || '');
  const [avatar, setAvatar] = useState(null);

  async function load(){
    setProfile(await api(`/api/profile/${user.id}`));
    setPosts(await api(`/api/posts/user/${user.id}`));
    setVideos(await api(`/api/videos/user/${user.id}`));
  }
  useEffect(()=>{ load(); }, []);

  async function save(e){
    e.preventDefault();
    const fd = new FormData(); fd.append('username', username); fd.append('description', description); if(avatar) fd.append('avatar', avatar);
    const updated = await api('/api/profile/me', { method:'PUT', body: fd });
    setUser(updated); setProfile(updated); setEdit(false);
  }

  return <section>
    <h1>Профиль</h1>
    <div className="card profileTop">
      {profile.avatar ? <img className="bigAvatar" src={fileUrl(profile.avatar)} /> : <div className="avatar huge">{profile.username?.[0]}</div>}
      <div><h2>{profile.username}</h2><p>{profile.description || 'Описание пока пустое'}</p><small>Дата регистрации: {new Date(profile.createdAt).toLocaleDateString('ru-RU')}</small></div>
      <button onClick={()=>setEdit(!edit)}>Редактировать</button>
    </div>
    {edit && <form className="card composer" onSubmit={save}>
      <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Имя" />
      <textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Описание" />
      <input type="file" accept="image/*" onChange={e=>setAvatar(e.target.files[0])}/>
      <button>Сохранить</button>
    </form>}
    <h2>Мои посты</h2>
    <div className="grid">{posts.map(p=><div className="card" key={p.id}><p>{p.text}</p>{p.imageUrl && <img className="postImage" src={fileUrl(p.imageUrl)}/>}<small>♥ {p.likes}</small></div>)}</div>
    <h2>Мои видео</h2>
    <div className="grid">{videos.map(v=><div className="card" key={v.id}><video className="miniVideo" src={fileUrl(v.videoUrl)} controls/><p>{v.description}</p><small>♥ {v.likes}</small></div>)}</div>
  </section>;
}
