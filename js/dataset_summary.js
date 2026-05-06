async function buildDatasetSummary() {
    const rawData = window.globalExoplanetData;
    if (!rawData || rawData.length === 0) return;

    // Helper to safely extract clean numbers
    const getValues = (key) => rawData
        .map(d => parseFloat(d[key]))
        .filter(v => !isNaN(v));

    // Calculate stats for a given array
    const calcStats = (arr) => {
        if (arr.length === 0) return { min: 0, max: 0, median: 0 };
        arr.sort(d3.ascending);
        return {
            min: arr[0],
            max: arr[arr.length - 1],
            median: d3.median(arr)
        };
    };

    // Prepare data dictionaries
    const stats = {
        pl_orbper: calcStats(getValues('pl_orbper')),
        pl_orbsmax: calcStats(getValues('pl_orbsmax')),
        pl_rade: calcStats(getValues('pl_rade')),
        pl_radj: calcStats(getValues('pl_radj')),
        pl_bmasse: calcStats(getValues('pl_bmasse')),
        pl_bmassj: calcStats(getValues('pl_bmassj')),
        pl_orbeccen: calcStats(getValues('pl_orbeccen')),
        st_teff: calcStats(getValues('st_teff')),
        st_mass: calcStats(getValues('st_mass')),
        st_rad: calcStats(getValues('st_rad')),
        sy_dist: calcStats(getValues('sy_dist')),
        sy_gaiamag: calcStats(getValues('sy_gaiamag'))
    };

    const fInt = (val) => window.formatExoNumber(val, 0);
    const fDec = (val) => window.formatExoNumber(val, 2);

    // Definition of the grid squares
    const grid_square = [
        // Row 1: Physical parameters (2x2)
        { id: "b_mass", span: 2, title: "Planet mass", baseKey: "pl_bmasse", altKey: "pl_bmassj", unit: "M<sub>⊕</sub>", altUnit: "M<sub>J</sub>", toggleName: ["Earth", "Jupiter"], format: fDec, desc: "The mass of the planet. This is either expressed as Earth masses (M<sub>⊕</sub>) or Jupiter masses (M<sub>J</sub>). Use the toggle in the top-right corner to switch between them." },
        { id: "b_rad", span: 2, title: "Planet radius", baseKey: "pl_rade", altKey: "pl_radj", unit: "R<sub>⊕</sub>", altUnit: "R<sub>J</sub>", toggleName: ["Earth", "Jupiter"], format: fDec, desc: "The physical size of the planet. This is either expressed as Earth radii (R<sub>⊕</sub>) or Jupiter radii (R<sub>J</sub>). Use the toggle in the top-right corner to switch between them." },
        
        // Row 2: Orbital parameters (2x2)
        { id: "b_orb", span: 2, title: "Orbital period", baseKey: "pl_orbper", unit: "days", format: fDec, desc: "The time it takes for the planet to complete one full orbit around its host star. The duration of a day is taken as on Earth, i.e. 24 hours." },
        { id: "b_smax", span: 2, title: "Semi-major axis", baseKey: "pl_orbsmax", unit: "AU", format: fDec, desc: "The longest radius of an elliptical orbit. Measured in astronomical units (AU), which is the average distance from the Earth to the Sun." },
        
        // Row 3: Location & shape (2x2)
        { id: "b_dist", span: 2, title: "Distance to us", baseKey: "sy_dist", unit: "pc", format: fInt, desc: "Distance from our Solar System to the exoplanet's host star, measured in parsecs (1 pc ≈ 3.26 light-years)." },
        { id: "b_ecc", span: 2, title: "Eccentricity", baseKey: "pl_orbeccen", unit: "", format: fDec, desc: "How circular the orbit is. A value of 0 denotes a perfect circle, while values closer to 1 are highly stretched ovals." },
        
        // Row 4: Host star parameters (4x1)
        { id: "b_steff", span: 1, title: "Stellar temp", baseKey: "st_teff", unit: "K", format: fInt, desc: "The effective surface temperature of the host star, measured in kelvin." },
        { id: "b_smass", span: 1, title: "Stellar mass", baseKey: "st_mass", unit: "M<sub>☉</sub>", format: fDec, desc: "The mass of the host star relative to our Sun, for which M<sub>☉</sub> = 1." },
        { id: "b_srad", span: 1, title: "Stellar radius", baseKey: "st_rad", unit: "R<sub>☉</sub>", format: fDec, desc: "The radius of the host star relative to our Sun, for which R<sub>☉</sub> = 1." },
        { id: "b_gmag", span: 1, title: "Gaia Mag", baseKey: "sy_gaiamag", unit: "mag", format: fDec, desc: "The brightness of the host star (Gaia); lower equals brighter." },
    ];

    const container = d3.select("#summary-square-grid");
    container.html("");

    let currentMode = "medians"; // 'medians' or 'compare'

    // Render square structure
    grid_square.forEach(b => {
        const card = container.append("div")
            .attr("class", `square-card ${b.span === 2 ? 'square-span-2' : ''}`)
            .attr("id", b.id);

        const titleRow = card.append("div").attr("class", "square-title");
        titleRow.append("span").text(b.title);

        // Inline unit toggles
        if (b.toggleName) {
            const miniToggle = titleRow.append("div").attr("class", "mini-toggle");
            miniToggle.append("button").attr("class", "mini-btn active").text(b.toggleName[0]).on("click", function(e) {
                e.stopPropagation();
                d3.select(this.parentNode).selectAll(".mini-btn").classed("active", false);
                d3.select(this).classed("active", true);
                b.useAlt = false;
                updateValues();
            });
            miniToggle.append("button").attr("class", "mini-btn").text(b.toggleName[1]).on("click", function(e) {
                e.stopPropagation();
                d3.select(this.parentNode).selectAll(".mini-btn").classed("active", false);
                d3.select(this).classed("active", true);
                b.useAlt = true;
                updateValues();
            });
        }

        const valRow = card.append("div").attr("class", "square-value");
        valRow.append("span").attr("class", "val-text");
        valRow.append("span").attr("class", "square-unit").style("margin-left", "8px");

        card.append("div").attr("class", "square-range");

        const overlay = card.append("div").attr("class", "square-overlay");
        overlay.append("h4").html(b.title); 
        overlay.append("p").html(b.desc);
    });

    // Fetch values
    function updateValues() {
        grid_square.forEach(b => {
            const card = d3.select(`#${b.id}`);
            const keyToUse = b.useAlt ? b.altKey : b.baseKey;
            const unitToUse = b.useAlt ? b.altUnit : b.unit;
            
            const medianVal = stats[keyToUse].median;
            const minVal = stats[keyToUse].min;
            const maxVal = stats[keyToUse].max;

            if (currentMode === "medians") {
                // Standard view (medians)
                card.select(".val-text").html(b.format(medianVal));
                card.select(".square-unit").html(unitToUse);
                card.select(".square-range")
                    .style("display", "block")
                    .html(`Range: ${b.format(minVal)} - ${b.format(maxVal)}`);
            } 
            else {
                // Compare view (exolab)
                const planet = window.currentExolabPlanet;
                
                if (!planet) {
                    card.select(".val-text").html(`<span style="color: var(--text-light); font-size: 1.2rem;">No planet selected</span>`);
                    card.select(".square-unit").html("");
                    card.select(".square-range").style("display", "none");
                } else {
                    const rawVal = parseFloat(planet[keyToUse]);
                    
                    if (isNaN(rawVal)) {
                        // Missing data handling
                        card.select(".val-text").html(`<span style="color: var(--accent-glow); font-size: 1.5rem;">● Unknown</span>`);
                        card.select(".square-unit").html("");
                        card.select(".square-range").style("display", "block").html(`Archive median: ${b.format(medianVal)} ${unitToUse.replace(/<[^>]*>?/gm, '')}`);
                    } else {
                        // Valid data handling + arrows
                        let arrow = "";
                        if (rawVal > medianVal) arrow = `<span style="color: #10b981; margin-left: 8px;">↑</span>`; 
                        else if (rawVal < medianVal) arrow = `<span style="color: #ef4444; margin-left: 8px;">↓</span>`; 
                        else arrow = `<span style="color: var(--text-muted); margin-left: 8px;">-</span>`;

                        card.select(".val-text").html(`${b.format(rawVal)}${arrow}`);
                        card.select(".square-unit").html(unitToUse);
                        card.select(".square-range").style("display", "block").html(`Archive median: ${b.format(medianVal)}`);
                    }
                }
            }
        });
    }

    // Event listener: global toggle
    d3.selectAll("#summary-mode-toggle .global-toggle-btn").on("click", function() {
        d3.selectAll("#summary-mode-toggle .global-toggle-btn").classed("active", false);
        d3.select(this).classed("active", true);
        currentMode = d3.select(this).attr("data-mode");
        updateValues();
    });

    // Event listener: explorable text
    document.querySelectorAll(".summary-action").forEach(button => {
        button.addEventListener("click", function(e) {
            e.preventDefault();
            currentMode = this.getAttribute("data-mode");
            
            d3.selectAll("#summary-mode-toggle .global-toggle-btn").classed("active", false);
            d3.select(`#summary-mode-toggle .global-toggle-btn[data-mode="${currentMode}"]`).classed("active", true);
            
            updateValues();
        });
    });

    // Event listener: new planet selected
    document.addEventListener('planetSelected', () => {
        if (currentMode === 'compare') {
            updateValues();
        }
    });

    // Initial load
    updateValues();
}

if (window.globalExoplanetData && window.globalExoplanetData.length > 0) {
    buildDatasetSummary();
} else {
    document.addEventListener('dataLoaded', buildDatasetSummary);
}