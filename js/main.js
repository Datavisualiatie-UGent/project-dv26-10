// Our Solar System (Earth radii)
let solarSystem = [
    { name: "Mercury", distance: 0.387, radius: 0.034, color: "#94a3b8", labelOffset: -15 },
    { name: "Venus", distance: 0.723, radius: 0.084, color: "#f8e2b0", labelOffset: 20 },
    { name: "Earth", distance: 1.000, radius: 0.089, color: "#30b3ff", labelOffset: -15 },
    { name: "Mars", distance: 1.524, radius: 0.047, color: "#c9452d", labelOffset: 20 },
    { name: "Jupiter", distance: 5.203, radius: 1.000, color: "#d1a77f", labelOffset: -25 },
    { name: "Saturn", distance: 9.537, radius: 0.840, color: "#fde68a", labelOffset: 25 },
    { name: "Uranus", distance: 19.191, radius: 0.358, color: "#7dd3fc", labelOffset: -20 },
    { name: "Neptune", distance: 30.069, radius: 0.346, color: "#6897f0", labelOffset: 20 }
];

/**
 * Number formatter.
 * Returns a string with thin space as thousand separator 
 * and a period as the decimal separator.
 */
window.formatExoNumber = function(value, decimals = 0) {
    let formatted = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(value);
    
    return formatted.replace(/,/g, '\u2009'); 
};

window.globalExoplanetData = null;

/**
 * Fetches and cleans the NASA Exoplanet dataset.
 */
async function loadGlobalData() {
    if (window.globalExoplanetData) {
        return window.globalExoplanetData;
    }

    try {
        const [csvData, metadata] = await Promise.all([
            d3.csv("assets/reduced_dataset.csv"),
            d3.json("assets/metadata.json")
        ]);
        
        window.globalExoplanetData = csvData;
        window.globalExoplanetData.datasetDate = metadata.dataset_date;
        window.globalExoplanetData.totalPlanets = metadata.total_planets;
        window.globalExoplanetData.totalSystems = metadata.total_systems;
        
        document.dispatchEvent(new Event('dataLoaded'));
        return window.globalExoplanetData;
    } catch (error) {
        console.error("Error loading the exoplanet dataset:", error);
        return [];
    }
}

loadGlobalData();