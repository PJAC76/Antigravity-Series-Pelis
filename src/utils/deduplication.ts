/**
 * Deduplication and blacklist utilities for media items.
 * 
 * Handles:
 * - Title normalization (removes season suffixes like "Temporada 3", "Season 2", etc.)
 * - Blacklist filtering (removes non-media entries like forum section titles)
 * - Deduplication by normalized title (keeps item with highest score)
 */

/**
 * Normalize a title for comparison purposes.
 * Removes season/temporada suffixes, extra whitespace, and lowercases.
 */
export function normalizeTitle(title: string): string {
    return title
        .toLowerCase()
        .trim()
        // Remove "temporada X", "season X", "T1", "S2" suffixes
        .replace(/\s*[-–:]\s*temporada\s*\d+/gi, '')
        .replace(/\s*temporada\s*\d+/gi, '')
        .replace(/\s*[-–:]\s*season\s*\d+/gi, '')
        .replace(/\s*season\s*\d+/gi, '')
        .replace(/\s*[-–:]\s*[ts]\d+/gi, '')
        // Remove trailing colons or dashes left over
        .replace(/\s*[-–:]\s*$/, '')
        // Collapse multiple spaces
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Titles that are not real media content and should be filtered out.
 * All entries must be normalized (lowercase, trimmed).
 */
export const TITLE_BLACKLIST: string[] = [
    'el hilo de las series',
    'hilo de las series',
    'hilo series',
    'test connectivity',
    'test connection movie',
];

/**
 * Check if a title is blacklisted.
 */
export function isBlacklisted(title: string): boolean {
    const normalized = normalizeTitle(title);
    return TITLE_BLACKLIST.some(bl => normalized.includes(bl));
}

/**
 * Filter out blacklisted items from an array.
 * @param items - Array of items to filter
 * @param titleExtractor - Function to extract the title string from each item
 */
export function filterBlacklisted<T>(
    items: T[],
    titleExtractor: (item: T) => string
): T[] {
    return items.filter(item => !isBlacklisted(titleExtractor(item)));
}

/**
 * Deduplicate items by normalized title, keeping the one with the highest score.
 * @param items - Array of items to deduplicate
 * @param titleExtractor - Function to extract the title string from each item
 * @param scoreExtractor - Function to extract the score number from each item (higher = better)
 */
export function deduplicateByTitle<T>(
    items: T[],
    titleExtractor: (item: T) => string,
    scoreExtractor: (item: T) => number
): T[] {
    const seen = new Map<string, T>();

    for (const item of items) {
        const key = normalizeTitle(titleExtractor(item));
        const existing = seen.get(key);

        if (!existing || scoreExtractor(item) > scoreExtractor(existing)) {
            seen.set(key, item);
        }
    }

    return Array.from(seen.values());
}

/**
 * Convenience: apply both blacklist filtering and deduplication in one call.
 */
export function cleanMediaList<T>(
    items: T[],
    titleExtractor: (item: T) => string,
    scoreExtractor: (item: T) => number
): T[] {
    const filtered = filterBlacklisted(items, titleExtractor);
    return deduplicateByTitle(filtered, titleExtractor, scoreExtractor);
}
