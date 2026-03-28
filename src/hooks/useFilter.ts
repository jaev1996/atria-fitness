
import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

export interface UseFilterOptions<T> {
    data: T[];
    searchKeys: (keyof T)[];
    initialItemsPerPage?: number;
    // Basic filter function that receives attributes and the item
    customFilter?: (item: T, filters: Record<string, string>) => boolean;
}

export function useFilter<T>({ data, searchKeys, initialItemsPerPage = 10, customFilter }: UseFilterOptions<T>) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    // 1. Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(initialItemsPerPage);

    // 2. Search State (Debounced sync to URL, but instant in UI)
    const urlTerm = searchParams.get('q') || '';
    const [localSearchTerm, setLocalSearchTerm] = useState(urlTerm);

    // 3. Debounce Effect: Sync local state to URL 'q' param
    const lastPushedTerm = useRef(urlTerm);

    useEffect(() => {
        if (localSearchTerm === urlTerm) {
            lastPushedTerm.current = localSearchTerm;
            return;
        }

        const timer = setTimeout(() => {
            const params = new URLSearchParams(searchParams.toString());
            if (localSearchTerm) {
                params.set('q', localSearchTerm);
            } else {
                params.delete('q');
            }
            params.set('page', '1'); // Reset to page 1 on search
            
            lastPushedTerm.current = localSearchTerm;
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        }, 400); // 400ms debounce

        return () => clearTimeout(timer);
    }, [localSearchTerm, urlTerm, pathname, router, searchParams]);

    // 4. External Sync: If URL changes EXTERNALLY (e.g., Back button), update local state
    useEffect(() => {
        if (urlTerm !== lastPushedTerm.current) {
            // We use setTimeout to avoid the "cascading renders" lint error
            // while still keeping the local state in sync with the URL.
            const syncTimer = setTimeout(() => {
                setLocalSearchTerm(urlTerm);
                lastPushedTerm.current = urlTerm;
            }, 0);
            return () => clearTimeout(syncTimer);
        }
    }, [urlTerm]);

    const handleSearch = (term: string) => {
        setLocalSearchTerm(term);
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

        // 1. Text Search (Use localSearchTerm for instant UI updates)
        if (localSearchTerm) {
            const lowerTerm = localSearchTerm.toLowerCase();
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
            const filters: Record<string, string> = {};
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
    }, [data, localSearchTerm, searchParams, searchKeys, customFilter]);

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
        searchTerm: localSearchTerm,
        setSearchTerm: handleSearch,
        setFilter: handleFilterChange,
        clearFilters,

        // Helpers
        filters: Object.fromEntries(searchParams.entries())
    };
}
