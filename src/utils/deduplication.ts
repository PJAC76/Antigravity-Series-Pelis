export const TITLE_BLACKLIST = [
    'el hilo de las series',
    'hilo de las series',
    'hilo series',
    'test connectivity',
    'test connection movie',
    'mejores películas de', // New: List titles
    'mejores peliculas de',
];

/**
 * Normalizes a title for comparison.
 * - Lowercases
 * - Removes special characters and extra spaces
 * - Removes "temporada X" or "season X" to group seasons under the main title
 * - Removes " - opiniones" suffix
 */
export const normalizeTitle = (title: string): string => {
    if (!title) return '';
    return title.toLowerCase().trim()
        .replace(/\s*[-–:]\s*temporada\s*\d+/gi, '')
        .replace(/\s*temporada\s*\d+/gi, '')
        .replace(/\s*[-–:]\s*season\s*\d+/gi, '')
        .replace(/\s*season\s*\d+/gi, '')
        .replace(/\s*[-–:]\s*[ts]\d+/gi, '')
        .replace(/\s*-\s*opiniones/gi, '') // New: Remove - Opiniones suffix
        .replace(/\s*[-–:]\s*$/, '')
        .replace(/\s+/g, ' ')
        .trim();
};

/**
 * Checks if a title is in the blacklist.
 */
export const isBlacklisted = (title: string): boolean => {
    const norm = normalizeTitle(title);
    return TITLE_BLACKLIST.some(bl => norm.includes(bl));
}

/**
 * Filters out blacklisted items and deduplicates the list by normalized title.
 * Keeps the item with the highest score (or first encountered if no score fn provided).
 */
export const cleanMediaList = <T>(
    items: T[], 
    getTitle: (item: T) => string,
    getScore?: (item: T) => number
): T[] => {
    const seen = new Map<string, T>();
    
    for (const item of items) {
        const title = getTitle(item);
        if (isBlacklisted(title)) continue;
        
        const key = normalizeTitle(title);
        const existing = seen.get(key);
        
        if (!existing) {
            seen.set(key, item);
        } else if (getScore) {
            // If duplicate, keep the one with higher score
            const currentScore = getScore(item);
            const existingScore = getScore(existing);
            if (currentScore > existingScore) {
                seen.set(key, item);
            }
        }
    }
    
    return Array.from(seen.values());
};
