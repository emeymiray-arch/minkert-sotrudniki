import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export type ClientEditPayload = {
  id: string;
  fullName: string;
  phone: string;
  note: string;
  birthDate: string;
};

type ClientEditSource = {
  id: string;
  fullName: string;
  phone?: string;
  note?: string;
  birthDate?: string | null;
};

function toDateInput(iso?: string | null) {
  if (!iso) return '';
  return iso.slice(0, 10);
}

export function ClientEditDialog({
  client,
  open,
  pending,
  onOpenChange,
  onSave,
}: {
  client: ClientEditSource | null;
  open: boolean;
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: ClientEditPayload) => void;
}) {
  const [fullName, setFullName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [note, setNote] = React.useState('');
  const [birthDate, setBirthDate] = React.useState('');

  React.useEffect(() => {
    if (!client) return;
    setFullName(client.fullName);
    setPhone(client.phone ?? '');
    setNote(client.note ?? '');
    setBirthDate(toDateInput(client.birthDate));
  }, [client]);

  const handleSave = () => {
    if (!client || !fullName.trim()) return;
    onSave({
      id: client.id,
      fullName: fullName.trim(),
      phone: phone.trim(),
      note: note.trim(),
      birthDate,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>Данные клиента</DialogTitle>
        <p className="mt-1 text-sm text-muted">
          Изменения сразу отобразятся в клиентской базе, записях и расписании.
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">ФИО</label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">Телефон</label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 …" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">Дата рождения</label>
            <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">Заметка</label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Комментарий администратора" />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button type="button" disabled={pending || !fullName.trim()} onClick={handleSave}>
            Сохранить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
