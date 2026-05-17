import React, { useState } from 'react';
import { api } from '../api/api';

export default function ReportButton({ targetType, targetId, className = 'ghost reportBtn' }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');

  async function sendReport(e) {
    e.preventDefault();
    setMsg('');
    try {
      await api('/api/reports', {
        method: 'POST',
        body: JSON.stringify({ targetType, targetId, reason: reason.trim() || 'Жалоба пользователя' })
      });
      setMsg('Жалоба отправлена');
      setReason('');
      setTimeout(() => setOpen(false), 650);
    } catch (err) {
      setMsg(err.message);
    }
  }

  return <>
    <button type="button" className={className} onClick={() => setOpen(true)}>⚑</button>
    {open && <div className="modalBackdrop reportModalBackdrop">
      <form className="modal secretModal reportModal" onSubmit={sendReport}>
        <h3>Пожаловаться</h3>
        {msg && <p className="safeText">{msg}</p>}
        <textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={500} placeholder="Причина жалобы" />
        <div className="row">
          <button type="submit">Отправить</button>
          <button type="button" className="ghost" onClick={() => setOpen(false)}>Отмена</button>
        </div>
      </form>
    </div>}
  </>;
}
