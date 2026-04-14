async function buildObservatoryMap() {
    const [rawData, geoData] = await Promise.all([
        getExoplanetData(),
        d3.json("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson")
    ]);

    if (!rawData || rawData.length === 0) return;

    const coordinates = {
        "W. M. Keck Observatory": [-155.47, 19.82],
        "La Silla Observatory": [-70.73, -29.25],
        "Paranal Observatory": [-70.40, -24.62],
        "Okayama Astrophysical Observatory": [133.59, 34.57],
        "Lick Observatory": [-121.64, 37.34],
        "Xinglong Station": [117.57, 40.39],
        "Thueringer Landessternwarte Tautenburg": [11.71, 50.98],
        "Roque de los Muchachos Observatory": [-17.89, 28.76],
        "McDonald Observatory": [-104.02, 30.67],
        "Gemini Observatory": [-155.47, 19.82],
        "Subaru Telescope": [-155.47, 19.82],
        "Cerro Tololo Inter-American Observatory": [-70.80, -30.17],
        "Mauna Kea Observatory": [-155.47, 19.82],
        "Haute-Provence Observatory": [5.71, 43.93],
        "Anglo-Australian Telescope": [149.06, -31.27],
        "Bohyunsan Optical Astronomical Observatory": [128.97, 36.16],
        "Calar Alto Observatory": [-2.54, 37.22],
        "NASA Infrared Telescope Facility (IRTF)": [-155.47, 19.82],
        "Yunnan Astronomical Observatory": [102.79, 25.02],
        "Acton Sky Portal Observatory": [-71.43, 42.48],
        "Palomar Observatory": [-116.86, 33.35],
        "Las Campanas Observatory": [-70.69, -29.01],
        "Kitt Peak National Observatory": [-111.60, 31.96],
        "Fred Lawrence Whipple Observatory": [-110.88, 31.68],
        "Apache Point Observatory": [-105.82, 32.78],
        "Atacama Large Millimeter Array (ALMA)": [-67.75, -23.02],
        "KELT-South": [20.81, -32.37],
        "KELT-North": [-110.59, 31.39],
        "SPECULOOS Southern Observatory": [-70.40, -24.62],
        "Large Binocular Telescope Observatory": [-109.89, 32.70],
        "South African Radio Astronomy Observatory (SAR": [21.41, -30.71],
        "MOA": [170.46, -43.98],
        "Next-Generation Transit Survey (NGTS)": [-70.40, -24.62],
        "Winer Observatory": [-110.59, 31.39],
        "OGLE": [-70.69, -29.01],
        "Arecibo Observatory": [-66.75, 18.34],
        "Parkes Observatory": [148.26, -32.99],
        "Leoncito Astronomical Complex": [-69.29, -31.79],
        "Infrared Survey Facility": [20.81, -32.37],
        "Teide Observatory": [-16.50, 28.30],
        "SuperWASP-South": [20.81, -32.37],
        "SuperWASP-North": [-17.89, 28.76],
        "WASP-South": [20.81, -32.37],
        "United Kingdom Infrared Telescope": [-155.47, 19.82],
        "Haleakala Observatory": [-156.25, 20.70],
        "XO": [-156.25, 20.70],
        "Lowell Observatory": [-111.65, 35.19],
        "Zwicky Transient Facility": [-116.86, 33.35],
        "University of Canterbury Mt John Observatory": [170.46, -43.98],
        "European Southern Observatory": [-70.40, -24.62]
    };

    const counts = d3.rollup(rawData, v => ({ count: v.length, locale: v[0].disc_locale }), d => d.disc_facility);
    const facilities = Array.from(counts, ([name, data]) => ({ name, count: data.count, locale: data.locale }));

    const spaceFacilities = facilities.filter(d => d.locale === "Space").sort((a, b) => b.count - a.count);
    const groundFacilities = facilities.filter(d => d.locale === "Ground" && coordinates[d.name]);

    const containerWidth = document.getElementById("observatory-map-container").clientWidth;
    const height = 650; 
    const spaceRowHeight = 160; 
    const mapHeight = height - spaceRowHeight;

    const svg = d3.select("#observatory-map-container")
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", height);

    // FIX 1: Attach Tooltip to the BODY, not the map container. 
    // This prevents any overflow clipping issues.
    const tooltip = d3.select("body")
        .append("div")
        .attr("class", "d3-tooltip");

    const sizeScale = d3.scaleSqrt()
        .domain([0, d3.max(facilities, d => d.count)])
        .range([12, 60]); 

    const getAbbreviation = (fullName) => {
        const match = fullName.match(/\(([^)]+)\)/);
        return match ? match[1] : fullName.split(" ")[0];
    };

    // ==========================================
    // SECTION A: SPACE OBSERVATORIES
    // ==========================================
    const spaceGroup = svg.append("g").attr("transform", "translate(0, 0)");
    
    spaceGroup.append("text")
        .attr("x", 20).attr("y", 30)
        .style("font-size", "16px").style("font-weight", "bold").style("fill", "var(--text-main)")
        .text("Space Telescopes");

    const spaceSpacing = containerWidth / (spaceFacilities.length + 1);

    const spaceNodes = spaceGroup.selectAll(".space-node")
        .data(spaceFacilities)
        .join("g")
        .attr("transform", (d, i) => `translate(${spaceSpacing * (i + 1)}, 75)`)
        .style("cursor", "pointer")
        .on("mouseover", function(event, d) {
            d3.select(this).select("image").style("filter", "drop-shadow(0px 4px 6px rgba(0,0,0,0.3))");
            tooltip.style("opacity", 1).html(`<strong>${d.name}</strong>Confirmed Planets: ${d.count}`);
        })
        .on("mousemove", function(event) {
            tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 20) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).select("image").style("filter", "none");
            tooltip.style("opacity", 0);
        });

    spaceNodes.append("image")
        .attr("class", "facility-icon")
        .attr("href", "https://img.icons8.com/color/96/000000/satellite.png") 
        .attr("width", d => sizeScale(d.count))
        .attr("height", d => sizeScale(d.count))
        .attr("x", d => -sizeScale(d.count) / 2)
        .attr("y", d => -sizeScale(d.count) / 2);

    spaceNodes.append("text")
        .attr("class", "facility-label")
        .attr("y", d => (sizeScale(d.count) / 2) + 18)
        .attr("text-anchor", "middle")
        .text(d => getAbbreviation(d.name)); 

    svg.append("line")
        .attr("x1", 20).attr("y1", spaceRowHeight).attr("x2", containerWidth - 20).attr("y2", spaceRowHeight)
        .style("stroke", "var(--grid-line, #e0e0e0)").style("stroke-width", 1);


    // ==========================================
    // SECTION B: GROUND OBSERVATORIES (ZOOMABLE MAP)
    // ==========================================
    svg.append("clipPath")
        .attr("id", "map-clip")
        .append("rect")
        .attr("width", containerWidth)
        .attr("height", mapHeight);

    const mapZoomContainer = svg.append("g")
        .attr("transform", `translate(0, ${spaceRowHeight})`)
        .attr("clip-path", "url(#map-clip)");

    mapZoomContainer.append("rect")
        .attr("width", containerWidth)
        .attr("height", mapHeight)
        .attr("class", "map-background");

    mapZoomContainer.append("text")
        .attr("x", 20).attr("y", 30)
        .style("font-size", "16px").style("font-weight", "bold").style("fill", "var(--text-main)")
        .text("Ground-based Observatories");

    const mapGroup = mapZoomContainer.append("g");

    const projection = d3.geoNaturalEarth1()
        .scale(containerWidth / 5.5) 
        .translate([containerWidth / 2, mapHeight / 2 + 20]);

    const path = d3.geoPath().projection(projection);

    // FIX 3: Add Tooltips to the countries themselves!
    mapGroup.selectAll("path")
        .data(geoData.features)
        .join("path")
        .attr("d", path)
        .attr("class", "map-land")
        .on("mouseover", function(event, d) {
            // d.properties.name contains the country name from the GeoJSON
            tooltip.style("opacity", 1).html(`<strong>${d.properties.name}</strong>`);
        })
        .on("mousemove", function(event) {
            tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 20) + "px");
        })
        .on("mouseout", function() {
            tooltip.style("opacity", 0);
        });

    const groundNodes = mapGroup.selectAll(".ground-node")
        .data(groundFacilities)
        .join("g")
        .attr("transform", d => {
            const coords = projection(coordinates[d.name]);
            return `translate(${coords[0]}, ${coords[1]})`;
        })
        .style("cursor", "pointer")
        .on("mouseover", function(event, d) {
            d3.select(this).raise(); // Bring icon to front
            d3.select(this).select("image").style("filter", "drop-shadow(0px 4px 6px rgba(0,0,0,0.5))");
            tooltip.style("opacity", 1).html(`<strong>${d.name}</strong>Confirmed Planets: ${d.count}`);
        })
        .on("mousemove", function(event) {
            tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 20) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).select("image").style("filter", "none");
            tooltip.style("opacity", 0);
        });

    groundNodes.append("image")
        .attr("class", "facility-icon")
        .attr("href", "https://img.icons8.com/color/96/000000/telescope.png")
        .attr("width", d => sizeScale(d.count))
        .attr("height", d => sizeScale(d.count))
        .attr("x", d => -sizeScale(d.count) / 2) 
        .attr("y", d => -sizeScale(d.count) / 2);

    // FIX 2: Inverse scaling for icons during zoom
    const zoom = d3.zoom()
        .scaleExtent([1, 8]) 
        .translateExtent([[0, 0], [containerWidth, mapHeight]]) 
        .on("zoom", (event) => {
            mapGroup.attr("transform", event.transform);
            
            // event.transform.k is the current zoom level. 
            // We divide the icon sizes by this number so they stay the exact same pixel size on screen!
            const k = event.transform.k;
            
            groundNodes.selectAll("image")
                .attr("width", d => sizeScale(d.count) / k)
                .attr("height", d => sizeScale(d.count) / k)
                .attr("x", d => -(sizeScale(d.count) / k) / 2)
                .attr("y", d => -(sizeScale(d.count) / k) / 2);
        });

    mapZoomContainer.call(zoom);
}

buildObservatoryMap();