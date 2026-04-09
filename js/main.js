/**
 * Fetches and cleans the NASA Exoplanet dataset.
 * Removes the '#' comment metadata at the top before parsing.
 * @returns {Promise<Array>} The parsed dataset as an array of objects.
 */
async function getExoplanetData() {
    try {
        const text = await d3.text("assets/exoplanet_dataset.csv");
        
        const cleanedText = text.split('\n')
                                .filter(line => !line.startsWith('#'))
                                .join('\n');
        
        return d3.csvParse(cleanedText);
    } catch (error) {
        console.error("Error loading the exoplanet dataset:", error);
        return [];
    }
}