
import { useState, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

export interface UseFilterOptions<T> {
    data: T[];
    searchKeys: (keyof T)[];
    initialItemsPerPage?: number;
    // Basic filter function that receives attributes and the item
    customFilter?: (item: T, filters: Record<string, any>) => boolean;
}

export function useFilter<T>({ data, searchKeys, initialItemsPerPage = 10, customFilter }: UseFilterOptions<T>) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    // 1. Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(initialItemsPerPage);

    // 2. Search State (Debounced locally generally, but here we can just bind to input)
    // We will sync search to URL 'q' param
    const searchTerm = searchParams.get('q') || '';

    // 3. Filter State (Generic map of key -> value)
    // We will assume any other param in searchParams is a filter if logic requires

    const handleSearch = (term: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (term) {
            params.set('q', term);
        } else {
            params.delete('q');
        }
        params.set('page', '1'); // Reset to page 1 on search
        setCurrentPage(1);
        router.replace(`${pathname}?${params.toString()}`);
    };

    const handleFilterChange = (key: string, value: string | null) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value && value !== 'all') {
            params.set(key, value);
        } else {
            params.delete(key);
        }
        params.set('page', '1');
        setCurrentPage(1);
        router.replace(`${pathname}?${params.toString()}`);
    }

    const clearFilters = () => {
        router.replace(pathname);
        setCurrentPage(1);
    }

    // Process Data
    const filteredData = useMemo(() => {
        let result = [...data];

        // 1. Text Search
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            result = result.filter(item =>
                searchKeys.some(key => {
                    const value = item[key];
                    return String(value).toLowerCase().includes(lowerTerm);
                })
            );
        }

        // 2. Custom Filters (using URL params)
        if (customFilter) {
            // Convert searchParams to a plain object
            const filters: Record<string, any> = {};
            searchParams.forEach((value, key) => {
                if (key !== 'q' && key !== 'page' && key !== 'limit') {
                    filters[key] = value;
                }
            });

            if (Object.keys(filters).length > 0) {
                result = result.filter(item => customFilter(item, filters));
            }
        }

        return result;
    }, [data, searchTerm, searchParams, searchKeys, customFilter]);

    // Pagination Logic
    const totalItems = filteredData.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    // Ensure current page is valid
    const validCurrentPage = Math.max(1, Math.min(currentPage, totalPages || 1));

    const paginatedData = useMemo(() => {
        const startIndex = (validCurrentPage - 1) * itemsPerPage;
        return filteredData.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredData, validCurrentPage, itemsPerPage]);

    return {
        // Data
        data: paginatedData,
        totalItems,

        // Pagination
        currentPage: validCurrentPage,
        totalPages,
        itemsPerPage,
        setPage: setCurrentPage,
        setItemsPerPage,

        // Search & Filters
        searchTerm,
        setSearchTerm: handleSearch,
        setFilter: handleFilterChange,
        clearFilters,

        // Helpers
        filters: Object.fromEntries(searchParams.entries())
    };
}
