import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui';

export function Pagination({ page, pageSize, total, onPageChange }: { page: number; pageSize: number; total: number; onPageChange: (page: number) => void }) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const firstItem = (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, total);
  return <div className="pagination" aria-label="Pagination">
    <span>Showing {firstItem}-{lastItem} of {total}</span>
    <div className="pagination-actions">
      <Button variant="quiet" icon={ChevronLeft} onClick={() => onPageChange(page - 1)} disabled={page <= 1}>Previous</Button>
      <b aria-current="page">{page} / {pageCount}</b>
      <Button variant="quiet" icon={ChevronRight} onClick={() => onPageChange(page + 1)} disabled={page >= pageCount}>Next</Button>
    </div>
  </div>;
}
