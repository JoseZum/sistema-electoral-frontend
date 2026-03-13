'use client';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: PaginationProps) {
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  const getVisiblePages = (): (number | '...')[] => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | '...')[] = [];

    if (currentPage <= 3) {
      pages.push(1, 2, 3, '...', totalPages);
    } else if (currentPage >= totalPages - 2) {
      pages.push(1, '...', totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, '...', currentPage, '...', totalPages);
    }

    return pages;
  };

  return (
    <div className="table-pagination">
      <span>
        Mostrando {start}&ndash;{end} de {totalItems.toLocaleString()}
      </span>
      <div className="pagination-btns">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          &lsaquo;
        </button>
        {getVisiblePages().map((page, i) =>
          page === '...' ? (
            <button key={`ellipsis-${i}`} disabled>
              &hellip;
            </button>
          ) : (
            <button
              key={page}
              className={page === currentPage ? 'active' : ''}
              onClick={() => onPageChange(page)}
            >
              {page}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
        >
          &rsaquo;
        </button>
      </div>
    </div>
  );
}
