// Web Worker for Search & Filter Operations
// Handles string matching, sorting, and filtering large datasets
// Usage: new Worker(new URL('searchWorker.ts', import.meta.url), { type: 'module' })

interface SearchMessage {
  type: 'search' | 'filter' | 'sort';
  data: any[];
  query?: string;
  fields?: string[];
  filterField?: string;
  filterValue?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface WorkerResponse {
  type: 'success' | 'error';
  data?: any[];
  error?: string;
  count?: number;
}

function searchData(data: any[], query: string, fields: string[]): any[] {
  if (!query.trim()) return data;
  
  const lowerQuery = query.toLowerCase();
  
  return data.filter(item => {
    return fields.some(field => {
      const value = String(getNestedValue(item, field) || '').toLowerCase();
      return value.includes(lowerQuery);
    });
  });
}

function filterData(data: any[], field: string, value: string): any[] {
  return data.filter(item => {
    const itemValue = getNestedValue(item, field);
    if (typeof itemValue === 'boolean' && value === 'true') return true;
    if (typeof itemValue === 'boolean' && value === 'false') return false;
    return String(itemValue) === value;
  });
}

function sortData(data: any[], sortBy: string, sortOrder: 'asc' | 'desc' = 'asc'): any[] {
  const sorted = [...data].sort((a, b) => {
    const aVal = getNestedValue(a, sortBy);
    const bVal = getNestedValue(b, sortBy);
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    }
    
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortOrder === 'asc' 
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }
    
    if (aVal instanceof Date && bVal instanceof Date) {
      return sortOrder === 'asc' 
        ? aVal.getTime() - bVal.getTime()
        : bVal.getTime() - aVal.getTime();
    }
    
    return 0;
  });
  
  return sorted;
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((curr, prop) => curr?.[prop], obj);
}

self.onmessage = (event: MessageEvent<SearchMessage>) => {
  try {
    const { type, data } = event.data;
    let result: any[] = data;
    
    if (type === 'search' && event.data.query && event.data.fields) {
      result = searchData(data, event.data.query, event.data.fields);
    } else if (type === 'filter' && event.data.filterField && event.data.filterValue) {
      result = filterData(data, event.data.filterField, event.data.filterValue);
    } else if (type === 'sort' && event.data.sortBy) {
      result = sortData(data, event.data.sortBy, event.data.sortOrder || 'asc');
    }
    
    self.postMessage({ 
      type: 'success', 
      data: result,
      count: result.length 
    } as WorkerResponse);
  } catch (error) {
    self.postMessage({ type: 'error', error: String(error) } as WorkerResponse);
  }
};
