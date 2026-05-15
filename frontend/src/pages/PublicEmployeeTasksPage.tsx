import { Navigate, useParams } from 'react-router-dom';

/** Старая ссылка /t/:token — перенаправляем на дневник /d/:token (те же задачи). */
export default function PublicEmployeeTasksPage() {
  const { token } = useParams<{ token: string }>();
  if (!token) return null;
  return <Navigate to={`/d/${token}`} replace />;
}
