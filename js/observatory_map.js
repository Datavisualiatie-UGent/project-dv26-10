async function buildObservatoryMap() {
    const rawData = window.globalExoplanetData;
    if (!rawData || rawData.length === 0) return;

    const geoResponse = await fetch("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson");
    const geoData = await geoResponse.json();

    d3.select("#observatory-map-container").html(""); 

    // Coordinates of observatories currently in dataset (06/05/2026)
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
        "South African Radio Astronomy Observatory (SARAO)": [21.41, -30.71],
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

    // Which facility uses which methods
    const counts = d3.rollup(rawData, v => ({ 
        count: v.length, 
        locale: v[0].disc_locale,
        methods: Array.from(new Set(v.map(d => d.discoverymethod))) 
    }), d => d.disc_facility);

    const facilities = Array.from(counts, ([name, data]) => ({ 
        name, 
        count: data.count, 
        locale: data.locale,
        methods: data.methods 
    }));

    const spaceFacilities = facilities.filter(d => d.locale === "Space").sort((a, b) => b.count - a.count);
    
    const groundFacilitiesRaw = facilities.filter(d => d.locale === "Ground" && coordinates[d.name]);
    const groundGroups = d3.rollup(groundFacilitiesRaw, 
        v => ({
            totalCount: d3.sum(v, d => d.count),
            facilitiesList: v.map(d => ({name: d.name, count: d.count, methods: d.methods})).sort((a,b) => b.count - a.count)
        }), 
        d => coordinates[d.name].join(",")
    );

    const groupedGroundNodes = Array.from(groundGroups, ([coordStr, data]) => ({
        coords: coordStr.split(",").map(Number),
        totalCount: data.totalCount,
        facilities: data.facilitiesList
    }));

    // Dimensions and lay-out
    const cWidth = 1050;
    const cHeight = 650; 
    const spaceRowHeight = 150; 
    const mapHeight = cHeight - spaceRowHeight;

    const svg = d3.select("#observatory-map-container")
        .append("svg")
        .attr("viewBox", `0 0 ${cWidth} ${cHeight}`)
        .style("width", "100%")
        .style("height", "auto");

    const tooltip = d3.select("body").append("div").attr("class", "exo-tooltip");

    const sizeScale = d3.scaleSqrt()
        .domain([0, d3.max([...spaceFacilities, ...groupedGroundNodes], d => d.count || d.totalCount)])
        .range([10, 45]); 

    // Space telescopes
    const spaceGroup = svg.append("g").attr("transform", "translate(0, 0)");
    
    spaceGroup.append("text")
        .attr("x", 0).attr("y", 20)
        .style("font-family", "var(--font-heading)")
        .style("font-size", "14px")
        .style("font-weight", "700")
        .style("fill", "var(--text-muted)")
        .style("text-transform", "uppercase")
        .style("letter-spacing", "1px")
        .text("Space-based telescopes");

    const spaceSpacing = cWidth / (spaceFacilities.length + 1);

    const spaceNodes = spaceGroup.selectAll(".space-node")
        .data(spaceFacilities)
        .join("g")
        .attr("class", "map-node")
        .attr("transform", (d, i) => `translate(${spaceSpacing * (i + 1)}, 70)`)
        .on("mouseover", function(event, d) {
            if (!d3.select(this).classed("is-highlighted")) {
                d3.select(this).select(".facility-icon")
                    .style("transform", "scale(1.2)")
                    .style("filter", "drop-shadow(0 6px 8px rgba(192, 132, 252, 0.6))"); 
            }
            tooltip.style("opacity", 1).html(`
                <div class="tt-header">${d.name}</div>
                <div class="tt-body">Confirmed Planets: <strong style="font-variant-numeric: tabular-nums;">${window.formatExoNumber(d.count)}</strong></div>
            `);
        })
        .on("mousemove", event => tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 20) + "px"))
        .on("mouseout", function() {
            if (!d3.select(this).classed("is-highlighted")) {
                d3.select(this).select(".facility-icon")
                    .style("transform", "scale(1)")
                    .style("filter", "none");
            }
            tooltip.style("opacity", 0);
        });

    spaceNodes.append("circle")
        .attr("r", d => sizeScale(d.count) * 0.8)
        .attr("fill", "transparent");

    spaceNodes.append("image")
        .attr("class", "facility-icon")
        .attr("href", "https://img.icons8.com/ios-filled/96/c084fc/satellite.png")
        .attr("width", d => sizeScale(d.count) * 1.5)
        .attr("height", d => sizeScale(d.count) * 1.5)
        .attr("x", d => -sizeScale(d.count) * 0.9)
        .attr("y", d => -sizeScale(d.count) * 0.6)
        .style("transition", "all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1)")
        .style("pointer-events", "none");

    spaceNodes.append("text")
        .attr("y", 52)
        .attr("text-anchor", "middle")
        .style("font-family", "var(--font-body)")
        .style("font-size", "11px")
        .style("font-weight", "600")
        .style("fill", "var(--text-dark)")
        .text(d => { // Show abbreviation (and handle Gaia/ESA)
            const match = d.name.match(/\(([^)]+)\)/);
            let abbr = match ? match[1] : d.name.split(" ")[0];
            if (abbr === "ESA" || d.name.includes("Gaia")) return "Gaia";
            return abbr;
        }); 

    svg.append("line")
        .attr("x1", 0).attr("y1", spaceRowHeight).attr("x2", cWidth).attr("y2", spaceRowHeight)
        .style("stroke", "var(--border-light)").style("stroke-width", 2).style("stroke-dasharray", "4,4");

    // Ground observatories
    svg.append("clipPath")
        .attr("id", "map-clip")
        .append("rect")
        .attr("width", cWidth)
        .attr("height", mapHeight);

    const mapZoomContainer = svg.append("g")
        .attr("transform", `translate(0, ${spaceRowHeight})`)
        .attr("clip-path", "url(#map-clip)");

    mapZoomContainer.append("rect")
        .attr("width", cWidth)
        .attr("height", mapHeight)
        .attr("fill", "transparent")
        .style("cursor", "grab");

    const mapGroup = mapZoomContainer.append("g").attr("transform", "translate(0, 15)");

    mapZoomContainer.append("text")
        .attr("x", 0).attr("y", 30)
        .style("font-family", "var(--font-heading)")
        .style("font-size", "14px")
        .style("font-weight", "700")
        .style("fill", "var(--text-muted)")
        .style("text-transform", "uppercase")
        .style("letter-spacing", "1px")
        .style("pointer-events", "none")
        .text("Ground-based observatories");

    const projection = d3.geoNaturalEarth1()
        .scale(cWidth / 5.5) 
        .translate([cWidth / 2, mapHeight / 2]);

    const path = d3.geoPath().projection(projection);

    mapGroup.selectAll("path")
        .data(geoData.features)
        .join("path")
        .attr("d", path)
        .attr("fill", "#e2e8f0") 
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 0.5)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("fill", "#cbd5e1");
            tooltip.style("opacity", 1).html(`<div class="tt-header">${d.properties.name}</div>`);
        })
        .on("mousemove", event => tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 20) + "px"))
        .on("mouseout", function() {
            d3.select(this).attr("fill", "#e2e8f0");
            tooltip.style("opacity", 0);
        });

    // Expandable facility hub
    let activeExpandedNode = null;

    function collapseSpider() {
        if (!activeExpandedNode) return;
        const group = d3.select(activeExpandedNode);
        group.selectAll(".spider-container").remove();
        group.select(".facility-icon").transition().style("opacity", 1);
        group.select("circle").transition().style("opacity", 0.85);
        activeExpandedNode = null;
    }

    svg.on("click", () => collapseSpider());

    const groundNodes = mapGroup.selectAll(".ground-node")
        .data(groupedGroundNodes)
        .join("g")
        .attr("class", "map-node")
        .attr("transform", d => {
            const coords = projection(d.coords);
            return `translate(${coords[0]}, ${coords[1]})`;
        })
        .on("mouseover", function(event, d) {
            if (activeExpandedNode === this) return; 
            
            d3.select(this).raise(); 
            
            if (!d3.select(this).classed("is-highlighted")) {
                d3.select(this).select(".facility-icon")
                    .style("transform", "scale(1.2)")
                    .style("filter", "drop-shadow(0 6px 8px rgba(37, 99, 235, 0.6))"); 
            }

            if (d.facilities.length > 1) {
                let listHtml = d.facilities.map(f => 
                    `<div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                        <span>${f.name}</span>
                        <strong style="margin-left:15px; font-variant-numeric: tabular-nums;">${window.formatExoNumber(f.count)}</strong>
                    </div>`
                ).join('');

                let instruction = `<span style="color:var(--accent-glow); font-size:0.75rem; font-weight:700;">(Click to expand)</span>`;

                tooltip.style("opacity", 1).html(`
                    <div class="tt-header">Location: ${Math.abs(d.coords[1]).toFixed(1)}°${d.coords[1] >= 0 ? 'N' : 'S'}, ${Math.abs(d.coords[0]).toFixed(1)}°${d.coords[0] >= 0 ? 'E' : 'W'}</div>
                    <div class="tt-body" style="font-size:0.8rem; margin-top:8px;">${listHtml}</div>
                    
                    <div class="tt-body" style="display: flex; justify-content: space-between; align-items: center; border-top:1px solid rgba(255,255,255,0.2); margin-top:6px; padding-top:6px;">
                        ${instruction}
                        <div style="text-align:right; flex-grow:1;">
                            Total: <strong style="font-variant-numeric: tabular-nums;">${window.formatExoNumber(d.totalCount)}</strong>
                        </div>
                    </div>
                `);
            } else {
                let f = d.facilities[0];
                tooltip.style("opacity", 1).html(`
                    <div class="tt-header">${f.name}</div>
                    <div class="tt-body">Confirmed Planets: <strong style="font-variant-numeric: tabular-nums;">${window.formatExoNumber(f.count)}</strong></div>
                `);
            }
        })
        .on("mousemove", event => tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 20) + "px"))
        .on("mouseout", function() {
            if (activeExpandedNode === this) return;
            
            if (!d3.select(this).classed("is-highlighted")) {
                d3.select(this).select(".facility-icon")
                    .style("transform", "scale(1)")
                    .style("filter", "none");
            }
            tooltip.style("opacity", 0);
        })
        .on("click", function(event, d) {
            event.stopPropagation(); 
            
            if (activeExpandedNode === this) {
                collapseSpider();
            } else {
                collapseSpider(); 
                
                if (d.facilities.length > 1) {
                    activeExpandedNode = this;
                    tooltip.style("opacity", 0); 
                    
                    const group = d3.select(this);
                    const k = d3.zoomTransform(mapZoomContainer.node()).k;
                    const R = 60 / k; 

                    group.select(".facility-icon").transition().style("opacity", 0.15);
                    group.select("circle").transition().style("opacity", 0.1);

                    const spider = group.append("g").attr("class", "spider-container");

                    d.facilities.forEach((f, i) => {
                        const angle = i * (2 * Math.PI / d.facilities.length) - Math.PI / 2;
                        const cx = Math.cos(angle) * R;
                        const cy = Math.sin(angle) * R;

                        const sNode = spider.append("g");

                        sNode.append("line")
                            .attr("x1", 0).attr("y1", 0)
                            .attr("x2", 0).attr("y2", 0)
                            .attr("stroke", "var(--text-light)")
                            .attr("stroke-width", 1.5 / k)
                            .transition().duration(300).ease(d3.easeBackOut)
                            .attr("x2", cx).attr("y2", cy);

                        const fSize = (sizeScale(f.count) * 1.5) / k;
                        
                        const iconGroup = sNode.append("g")
                            .attr("transform", "translate(0,0)")
                            .style("cursor", "pointer")
                            .on("mouseover", function(e) {
                                e.stopPropagation();
                                d3.select(this).select("image").style("filter", "drop-shadow(0 4px 6px rgba(0,0,0,0.5))").style("transform", "scale(1.2)");
                                tooltip.style("opacity", 1).html(`
                                    <div class="tt-header">${f.name}</div>
                                    <div class="tt-body">Confirmed Planets: <strong style="font-variant-numeric: tabular-nums;">${window.formatExoNumber(f.count)}</strong></div>
                                `);
                            })
                            .on("mousemove", e => tooltip.style("left", (e.pageX + 15) + "px").style("top", (e.pageY - 20) + "px"))
                            .on("mouseout", function(e) {
                                e.stopPropagation();
                                d3.select(this).select("image").style("filter", "none").style("transform", "scale(1)");
                                tooltip.style("opacity", 0);
                            });

                        iconGroup.transition().duration(300).ease(d3.easeBackOut)
                            .attr("transform", `translate(${cx}, ${cy})`);

                        iconGroup.append("circle")
                            .attr("r", fSize * 0.7)
                            .attr("fill", "transparent");

                        iconGroup.append("image")
                            .attr("href", "https://img.icons8.com/ios-filled/96/2563eb/telescope.png")
                            .attr("width", fSize)
                            .attr("height", fSize)
                            .attr("x", -fSize / 2)
                            .attr("y", -fSize / 2)
                            .style("transition", "all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1)")
                            .style("pointer-events", "none");
                    });
                }
            }
        });

    groundNodes.append("circle")
        .attr("r", d => sizeScale(d.totalCount) * 0.8)
        .attr("fill", "transparent");

    groundNodes.append("image")
        .attr("class", "facility-icon")
        .attr("href", "https://img.icons8.com/ios-filled/96/2563eb/telescope.png")
        .attr("width", d => sizeScale(d.totalCount) * 1.5)
        .attr("height", d => sizeScale(d.totalCount) * 1.5)
        .attr("x", d => -sizeScale(d.totalCount) * 0.75)
        .attr("y", d => -sizeScale(d.totalCount) * 0.75)
        .style("transition", "all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1)")
        .style("pointer-events", "none");

    const zoom = d3.zoom()
        .scaleExtent([1, 8]) 
        .translateExtent([[0, 0], [cWidth, mapHeight]]) 
        .on("zoom", (event) => {
            if (activeExpandedNode) collapseSpider();

            mapGroup.attr("transform", event.transform);
            const k = event.transform.k;
            
            groundNodes.selectAll("circle").attr("r", d => (sizeScale(d.totalCount) * 0.8) / Math.sqrt(k));
            groundNodes.selectAll(".facility-icon")
                .attr("width", d => (sizeScale(d.totalCount) * 1.5) / Math.sqrt(k))
                .attr("height", d => (sizeScale(d.totalCount) * 1.5) / Math.sqrt(k))
                .attr("x", d => -(sizeScale(d.totalCount) * 1.5) / Math.sqrt(k) / 2)
                .attr("y", d => -(sizeScale(d.totalCount) * 1.5) / Math.sqrt(k) / 2);
        });

    mapZoomContainer.call(zoom);

    // Explorable text interactinos
    d3.selectAll(".map-action").on("click", function(event) {
        event.preventDefault();
        const btn = d3.select(this);
        const targetName = btn.attr("data-highlight");
        const targetType = btn.attr("data-highlight-type");
        const isReset = btn.attr("data-reset");

        if (btn.classed("method-btn")) {
            d3.selectAll(".method-btn.map-action").classed("active", false); // Clear others
            btn.classed("active", true); // Highlight clicked
        } else if (isReset) {
            d3.selectAll(".method-btn.map-action").classed("active", false); // Clear all on reset
        }

        if (activeExpandedNode) collapseSpider(); 
        
        svg.selectAll(".map-node").classed("is-highlighted", false);
        svg.selectAll(".map-node").transition().duration(400).style("opacity", 1);
        svg.selectAll(".map-node circle").transition().duration(400)
            .attr("stroke", "rgba(255,255,255,0.5)")
            .attr("stroke-width", 1);
        svg.selectAll(".map-node .facility-icon").transition().duration(400)
            .style("transform", "scale(1)")
            .style("filter", "none");

        if (isReset) return;

        // Dynamic match logic
        svg.selectAll(".map-node").each(function(d) {
            let isMatch = false;
            
            // 1. Check for name match
            if (targetName) {
                if (d.name && d.name.includes(targetName)) isMatch = true;
                if (d.facilities && d.facilities.some(f => f.name.includes(targetName))) isMatch = true;
            }
            
            // 2. Check for method match
            if (targetType) {
                if (d.methods && d.methods.includes(targetType)) isMatch = true;
                if (d.facilities && d.facilities.some(f => f.methods && f.methods.includes(targetType))) isMatch = true;
            }

            if (isMatch) {
                d3.select(this).raise(); 
                
                d3.select(this).classed("is-highlighted", true);
                
                d3.select(this).select("circle").transition().duration(400)
                    .attr("stroke", "white")
                    .attr("stroke-width", 3);
                    
                d3.select(this).select(".facility-icon").transition().duration(400)
                    .style("transform", "scale(1.4)")
                    .style("filter", d.name ? "drop-shadow(0 0 15px rgba(192, 132, 252, 1))" : "drop-shadow(0 0 15px rgba(37, 99, 235, 1))");
            } else {
                d3.select(this).transition().duration(400).style("opacity", 0.15);
            }
        });
    });
}

// Lazy loading (performance of prior visualisations)
function initObservatoryWhenVisible() {
    const container = document.getElementById("observatory-map-container");
    if (!container) return;

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                buildObservatoryMap();
                obs.unobserve(entry.target);
            }
        });
    }, { rootMargin: "300px 0px" });

    observer.observe(container);
}

if (window.globalExoplanetData && window.globalExoplanetData.length > 0) {
    initObservatoryWhenVisible();
} else {
    document.addEventListener('dataLoaded', initObservatoryWhenVisible);
}