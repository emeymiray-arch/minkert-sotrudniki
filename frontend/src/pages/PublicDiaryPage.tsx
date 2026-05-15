import { useParams } from 'react-router-dom';

import { PublicEmployeeTasksPanel } from '@/components/tasks/PublicEmployeeTasksPanel';

export default function PublicDiaryPage() {
  const { token } = useParams<{ token: string }>();
  if (!token) return null;

  return (
    <div className="min-h-full bg-[hsl(var(--bg))] bg-ambient px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-lg">
        <PublicEmployeeTasksPanel
          token={token}
          heading="Дневник"
          subtitle="Здесь те же задачи, что задал руководитель в программе. Выберите дату и отметьте выполнение — править список задач не нужно."
        />
      </div>
    </div>
  );
}
