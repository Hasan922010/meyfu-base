import { useSearchParams } from 'react-router-dom';

export function useProductFilters() {
  const [params, setParams] = useSearchParams();

  const search = params.get('search') || '';
  const parsedPage = Number.parseInt(params.get('page') || '1', 10);
  const parsedPageSize = Number.parseInt(params.get('page_size') || '20', 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const pageSize = [20, 50, 100].includes(parsedPageSize) ? parsedPageSize : 20;
  const category = params.get('category') || '';
  const brand = params.get('brand') || '';
  const isActive = params.get('is_active') || '';
  const stockStatus = params.get('stock_status') || '';
  const ordering = params.get('ordering') || '';
  const retailPriceMin = params.get('retail_price_min') || '';
  const retailPriceMax = params.get('retail_price_max') || '';

  const setFilter = (key: string, value: string) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) {
          next.set(key, value);
        } else {
          next.delete(key);
        }
        if (key !== 'page' && key !== 'page_size') {
          next.set('page', '1');
        }
        return next;
      },
      { replace: true }
    );
  };

  const clearFilters = () => {
    setParams(new URLSearchParams(), { replace: true });
  };

  return {
    filters: {
      search,
      page,
      page_size: pageSize,
      category,
      brand,
      is_active: isActive,
      stock_status: stockStatus,
      ordering,
      retail_price_min: retailPriceMin,
      retail_price_max: retailPriceMax,
    },
    setFilter,
    clearFilters,
  };
}
