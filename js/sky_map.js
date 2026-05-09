async function buildSkyMap() {
    const rawData = window.globalExoplanetData;
    if (!rawData || rawData.length === 0) return;

    // Prepare data
    const parseNumber = value => {
        if (value == null) return null;
        if (typeof value === "string" && value.trim() === "") return null;
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
    };

    const data = rawData
        .map(d => {
            let cleanMethod = d.discoverymethod || "Other";
            if (cleanMethod === "Radial Velocity") cleanMethod = "Radial velocity";
            
            return {
                name: d.pl_name,
                method: cleanMethod,
                year: parseNumber(d.disc_year),
                ra: parseNumber(d.ra),
                dec: parseNumber(d.dec),
                distance: parseNumber(d.sy_dist),
                radius: parseNumber(d.pl_rade),
                mass: parseNumber(d.pl_bmasse)
            };
        })
        .filter(d => d.ra != null && d.dec != null);

    d3.select("#sky-map-container").html("");

    // Dimensions and lay-out
    const cWidth = 1050;
    const cHeight = 600;
    const margin = { top: 40, right: 40, bottom: 60, left: 75 }; 
    const width = cWidth - margin.left - margin.right;
    const height = cHeight - margin.top - margin.bottom;

    const svg = d3.select("#sky-map-container")
        .append("svg")
        .attr("viewBox", `0 0 ${cWidth} ${cHeight}`)
        .style("width", "100%")
        .style("height", "auto");

    const zoom = d3.zoom()
        .scaleExtent([1, 15])
        .extent([[0, 0], [width, height]])
        .translateExtent([[0, 0], [width, height]])
        .filter(function(event) {
            const [mx, my] = d3.pointer(event, svg.node());

            const insideChart =
                mx >= margin.left &&
                mx <= margin.left + width &&
                my >= margin.top &&
                my <= margin.top + height;

            if (!insideChart) return false;

            if (event.type === "wheel") return true;

            return event.button === 0;
        })
        .on("zoom", zoomed);

    svg.call(zoom);

    const chart = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`)
        .style("pointer-events", "none"); 

    const x = d3.scaleLinear().domain([0, 360]).range([0, width]);
    const y = d3.scaleLinear().domain([-90, 90]).range([height, 0]);

    const xGrid = d3.axisBottom(x).ticks(12).tickSize(-height).tickFormat("");
    const yGrid = d3.axisLeft(y).ticks(7).tickSize(-width).tickFormat("");

    const gxGrid = chart.append("g")
        .attr("transform", `translate(0,${height})`)
        .attr("opacity", 0.03)
        .call(xGrid);

    const gyGrid = chart.append("g")
        .attr("opacity", 0.03)
        .call(yGrid);

    const xAxis = d3.axisBottom(x).tickValues(d3.range(0, 361, 30)).tickFormat(d => `${d}°`);
    const yAxis = d3.axisLeft(y).tickValues([-90, -60, -30, 0, 30, 60, 90]).tickFormat(d => `${d}°`);

    const gx = chart.append("g").attr("transform", `translate(0,${height})`).call(xAxis);
    const gy = chart.append("g").call(yAxis);

    function styleSkyAxes() {
        [gx, gy].forEach(axis => {
            axis.select(".domain")
                .attr("stroke", "var(--border-light)");

            axis.selectAll(".tick line")
                .attr("stroke", "var(--border-light)");

            axis.selectAll(".tick text")
                .style("font-family", "var(--font-body)")
                .style("font-size", "11px")
                .style("fill", "var(--text-muted)");
        });
    }

    styleSkyAxes();

    chart.append("text")
        .attr("x", width / 2).attr("y", height + 45)
        .attr("text-anchor", "middle")
        .style("fill", "var(--text-muted)")
        .style("font-family", "var(--font-heading)")
        .style("font-weight", "600")
        .style("font-size", "16px")
        .text("Right ascension");

    chart.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2).attr("y", -50) 
        .attr("text-anchor", "middle")
        .style("fill", "var(--text-muted)")
        .style("font-family", "var(--font-heading)")
        .style("font-weight", "600")
        .style("font-size", "16px")
        .text("Declination");

    const colorScale = method => {
        if (method === "Transit") return "var(--color-transit)";
        if (method === "Radial velocity") return "var(--color-radial)"; 
        if (method === "Microlensing") return "var(--color-microlensing)";
        if (method === "Imaging") return "var(--color-imaging)";
        return "var(--color-other)";
    };

    svg.append("defs").append("clipPath")
        .attr("id", "sky-map-clip")
        .append("rect")
        .attr("x", 0).attr("y", 0)
        .attr("width", width).attr("height", height);

    const plotArea = chart.append("g")
        .attr("clip-path", `url(#sky-map-clip)`); 

    // Layering System
    const bgLayer = plotArea.append("g");
    const pointsGroup = plotArea.append("g");
    const fgLayer = plotArea.append("g").style("pointer-events", "none");

    const equatorLine = bgLayer.append("line")
        .attr("x1", 0).attr("x2", width)
        .attr("y1", y(0)).attr("y2", y(0))
        .attr("stroke", "var(--accent-glow)")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4,4")
        .attr("opacity", 0.5);

    const equatorLabel = fgLayer.append("text")
        .attr("x", x(353)).attr("y", y(0) - 8)
        .attr("text-anchor", "end")
        .style("font-family", "var(--font-body)")
        .style("font-size", "11px")
        .style("font-weight", "600")
        .style("fill", "var(--accent-glow)")
        .style("paint-order", "stroke")
        .style("stroke", "#ffffff")
        .style("stroke-width", 3)
        .text("Celestial equator");

    // Kepler target marker
    const keplerRA = 290.75;
    const keplerDec = 44.5;
    
    const keplerBg = bgLayer.append("g")
        .attr("transform", `translate(${x(keplerRA)}, ${y(keplerDec)})`)
        .style("pointer-events", "none"); 
        
    keplerBg.append("circle")
        .attr("class", "fov-circle")
        .attr("r", 32)
        .attr("fill", "none")
        .attr("stroke", "var(--text-dark)")
        .attr("stroke-width", 1)
        .attr("opacity", 0.6)
        .attr("stroke-dasharray", "2,2");

    const keplerFg = fgLayer.append("g")
        .attr("transform", `translate(${x(keplerRA)}, ${y(keplerDec)})`)
        .style("pointer-events", "all")
        .style("cursor", "pointer");

    const keplerText = keplerFg.append("text")
        .attr("x", 0).attr("y", 1)
        .attr("text-anchor", "middle")
        .style("dominant-baseline", "middle")
        .text("Kep")
        .style("font-family", "var(--font-heading)")
        .style("font-size", "11px")
        .style("font-weight", "700")
        .style("fill", "var(--text-dark)")
        .style("paint-order", "stroke")
        .style("stroke", "#ffffff")
        .style("stroke-width", 1);

    keplerFg
        .on("mouseenter", () => keplerText.style("font-size", "12.5px"))
        .on("mouseleave", () => keplerText.style("font-size", "11px"))
        .on("click", () => zoomToTarget(keplerRA, keplerDec, 6));

    // Galactic bulge target marker
    const bulgeRA = 267.5; 
    const bulgeDec = -28.5; 
    
    const bulgeBg = bgLayer.append("g")
        .attr("transform", `translate(${x(bulgeRA)}, ${y(bulgeDec)})`)
        .style("pointer-events", "none"); 
        
    bulgeBg.append("circle")
        .attr("class", "fov-circle") 
        .attr("r", 24) 
        .attr("fill", "none")
        .attr("stroke", "var(--text-dark)")
        .attr("stroke-width", 1)
        .attr("opacity", 0.6)
        .attr("stroke-dasharray", "2,2");

    const bulgeFg = fgLayer.append("g")
        .attr("transform", `translate(${x(bulgeRA)}, ${y(bulgeDec)})`)
        .style("pointer-events", "all")
        .style("cursor", "pointer");

    const bulgeText = bulgeFg.append("text")
        .attr("x", 0).attr("y", 1)
        .attr("text-anchor", "middle")
        .style("dominant-baseline", "middle")
        .text("Bul")
        .style("font-family", "var(--font-heading)")
        .style("font-size", "11px")
        .style("font-weight", "700")
        .style("fill", "var(--text-dark)")
        .style("paint-order", "stroke")
        .style("stroke", "#ffffff")
        .style("stroke-width", 1);

    bulgeFg
        .on("mouseenter", () => bulgeText.style("font-size", "12.5px"))
        .on("mouseleave", () => bulgeText.style("font-size", "11px"))
        .on("click", () => zoomToTarget(bulgeRA, bulgeDec, 8));

    const tooltip = d3.select("body")
        .selectAll(".d3-tooltip-sky")
        .data([null])
        .join("div")
        .attr("class", "exo-tooltip d3-tooltip-sky")
        .style("opacity", 0);

    const formatCoordinate = value => {
        if (value == null || !Number.isFinite(value)) return "Unknown";

        return value.toLocaleString("en-GB", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };

    const formatValue = x => {
        if (x == null || !Number.isFinite(x)) return "Unknown";
        if (x >= 1000) return d3.format(",.0f")(x);
        if (x >= 10) return d3.format(",.1f")(x);
        return d3.format(".2f")(x);
    };

    const baseRadius = 2.5;
    const hoverRadius = 4;
    const baseOpacity = 0.6;
    const hoverOpacity = 1;

    // Data points
    const points = pointsGroup.selectAll("circle")
        .data(data)
        .join("circle")
        .attr("cx", d => x(d.ra))
        .attr("cy", d => y(d.dec))
        .attr("r", baseRadius)
        .style("fill", d => colorScale(d.method))
        .style("opacity", baseOpacity)
        .style("stroke", "none")
        .style("pointer-events", "all")
        .on("mouseenter", function() {
            d3.select(this)
                .attr("r", hoverRadius)
                .style("opacity", hoverOpacity);
        })
        .on("mousemove", function(event, d) {
            tooltip
                .style("opacity", 1)
                .style("left", `${event.pageX + 14}px`)
                .style("top", `${event.pageY + 14}px`)
                .html(`
                <div class="tt-header">${d.name}</div>
                <table style="width: 100%; min-width: 160px; font-size: 0.8rem; margin-top: 8px; border-collapse: collapse;">
                    <tr>
                        <td style="padding-bottom: 4px; padding-right: 16px; color: var(--text-light);">Method:</td>
                        <td style="text-align: right; font-weight: bold; padding-bottom: 4px; color: ${colorScale(d.method)};">${d.method}</td>
                    </tr>
                    <tr>
                        <td style="padding-bottom: 4px; padding-right: 16px; color: var(--text-light);">RA:</td>
                        <td style="text-align: right; font-weight: bold; font-variant-numeric: tabular-nums; padding-bottom: 4px;">${formatCoordinate(d.ra)}°</td>
                    </tr>
                    <tr>
                        <td style="padding-bottom: 4px; padding-right: 16px; color: var(--text-light);">Dec:</td>
                        <td style="text-align: right; font-weight: bold; font-variant-numeric: tabular-nums; padding-bottom: 4px;">${formatCoordinate(d.dec)}°</td>
                    </tr>
                    <tr>
                        <td style="padding-right: 16px; color: var(--text-light);">Distance to us:</td>
                        <td style="text-align: right; font-weight: bold; font-variant-numeric: tabular-nums;">${d.distance != null ? `${formatValue(d.distance)} pc` : "Unknown"}</td>
                    </tr>
                </table>
                `);
        })
        .on("mouseleave", function() {
            d3.select(this)
                .attr("r", baseRadius)
                .style("opacity", baseOpacity);

            tooltip.style("opacity", 0);
        });

    // Interactive legend
    const legendCategories = ["Transit", "Radial velocity", "Microlensing", "Imaging", "Other"];
    
    const isMatch = (dMethod, legendMethod) => {
        if (legendMethod === "Other") return !["Transit", "Radial velocity", "Microlensing", "Imaging"].includes(dMethod);
        return dMethod === legendMethod;
    };

    const legend = chart.append("g")
        .attr("transform", `translate(15, 15)`)
        .style("pointer-events", "all"); 

    legend.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", 130)
        .attr("height", 185)
        .attr("fill", "#ffffff")
        .style("opacity", 0.75)
        .attr("rx", 8);

    const legendRows = legend.selectAll(".legend-row")
        .data(legendCategories)
        .join("g")
        .attr("class", "legend-row")
        .style("cursor", "pointer")
        .on("mouseenter", function(event, method) {
            legendRows.transition().duration(150).style("opacity", m => m === method ? 1 : 0.4);
            
            points.classed("legend-highlighted", d => isMatch(d.method, method))
                  .transition().duration(150)
                  .style("opacity", d => isMatch(d.method, method) ? 1 : 0)
                  .attr("r", d => isMatch(d.method, method) ? 4 : 2.5);
        })
        .on("mouseleave", function() {
            legendRows.transition().duration(150).style("opacity", 1);
            
            points.classed("legend-highlighted", false)
                  .transition().duration(150)
                  .style("opacity", 0.6)
                  .attr("r", 2.5);
        });

    legendRows.append("rect")
        .attr("x", 5)
        .attr("y", (d, i) => 8 + i * 24)
        .attr("width", 120)
        .attr("height", 24)
        .attr("fill", "transparent");

    legendRows.append("circle")
        .attr("cx", 15)
        .attr("cy", (d, i) => 20 + i * 24)
        .attr("r", 5)
        .style("fill", d => colorScale(d));

    legendRows.append("text")
        .attr("x", 28)
        .attr("y", (d, i) => 20 + i * 24)
        .style("font-family", "var(--font-body)")
        .style("font-size", "12px")
        .style("font-weight", "600")
        .style("fill", "var(--text-dark)")
        .style("alignment-baseline", "middle")
        .text(d => d);

    // Static for clusters
    const kepY = 20 + legendCategories.length * 24;

    legend.append("text")
        .attr("x", 15).attr("y", kepY)
        .attr("text-anchor", "middle")
        .style("font-family", "var(--font-heading)")
        .style("font-size", "10px")
        .style("font-weight", "700")
        .style("fill", "var(--text-dark)")
        .style("alignment-baseline", "middle")
        .text("Kep");

    legend.append("text")
        .attr("x", 28).attr("y", kepY)
        .style("fill", "var(--text-dark)")
        .style("font-size", "12px")
        .style("font-family", "var(--font-body)")
        .style("font-weight", "600")
        .style("alignment-baseline", "middle")
        .text("Kepler cluster");

    const bulgeY = 20 + (legendCategories.length + 1) * 24;

    legend.append("text")
        .attr("x", 15).attr("y", bulgeY)
        .attr("text-anchor", "middle")
        .style("font-family", "var(--font-heading)")
        .style("font-size", "10px")
        .style("font-weight", "700")
        .style("fill", "var(--text-dark)")
        .style("alignment-baseline", "middle")
        .text("Bul");

    legend.append("text")
        .attr("x", 28).attr("y", bulgeY)
        .style("fill", "var(--text-dark)")
        .style("font-size", "12px")
        .style("font-family", "var(--font-body)")
        .style("font-weight", "600")
        .style("alignment-baseline", "middle")
        .text("Galactic bulge");

    // Zoom logic
    function zoomed(event) {
        const k = event.transform.k; 
        const zx = event.transform.rescaleX(x);
        const zy = event.transform.rescaleY(y);
        
        const isDefaultView = event.transform.k < 1.005;

        const xAxisZoom = isDefaultView
            ? d3.axisBottom(zx)
                .tickValues(d3.range(0, 361, 30))
                .tickFormat(d => `${d}°`)
            : d3.axisBottom(zx)
                .ticks(14)
                .tickFormat(d => `${Math.round(d)}°`);

        const yAxisZoom = isDefaultView
            ? d3.axisLeft(zy)
                .tickValues(d3.range(-90, 91, 30))
                .tickFormat(d => `${d}°`)
            : d3.axisLeft(zy)
                .ticks(7)
                .tickFormat(d => `${Math.round(d)}°`);

        const xGridZoom = isDefaultView
            ? d3.axisBottom(zx)
                .tickValues(d3.range(0, 361, 30))
                .tickSize(-height)
                .tickFormat("")
            : d3.axisBottom(zx)
                .ticks(14)
                .tickSize(-height)
                .tickFormat("");

        const yGridZoom = isDefaultView
            ? d3.axisLeft(zy)
                .tickValues(d3.range(-90, 91, 30))
                .tickSize(-width)
                .tickFormat("")
            : d3.axisLeft(zy)
                .ticks(7)
                .tickSize(-width)
                .tickFormat("");

        gx.call(xAxisZoom);
        gy.call(yAxisZoom);

        styleSkyAxes();

        gxGrid.call(xGridZoom);
        gyGrid.call(yGridZoom);

        points.attr("cx", d => zx(d.ra)).attr("cy", d => zy(d.dec));
        
        keplerBg.attr("transform", `translate(${zx(keplerRA)}, ${zy(keplerDec)})`);
        keplerBg.select(".fov-circle").attr("r", 32 * k); 
        keplerFg.attr("transform", `translate(${zx(keplerRA)}, ${zy(keplerDec)})`);
        
        bulgeBg.attr("transform", `translate(${zx(bulgeRA)}, ${zy(bulgeDec)})`);
        bulgeBg.select(".fov-circle").attr("r", 24 * k);
        bulgeFg.attr("transform", `translate(${zx(bulgeRA)}, ${zy(bulgeDec)})`);
        
        equatorLine.attr("y1", zy(0)).attr("y2", zy(0));
        equatorLabel.attr("x", zx(353)).attr("y", zy(0) - 8);
    }

    function zoomToTarget(targetRA, targetDec, scale = 6) {
        const tx = width / 2 - x(targetRA) * scale;
        const ty = height / 2 - y(targetDec) * scale;

        svg.transition().duration(1500).call(
            zoom.transform,
            d3.zoomIdentity.translate(tx, ty).scale(scale)
        );
    }

    // Explorable text interactions
    d3.selectAll(".sky-action").on("click", function(e) {
        e.preventDefault();
        const target = d3.select(this).attr("data-target");
        
        if (target === "kepler") {
            zoomToTarget(keplerRA, keplerDec, 6);
        } else if (target === "bulge") {
            zoomToTarget(bulgeRA, bulgeDec, 8);
        } else if (target === "reset") {
            svg.transition().duration(1000).call(
                zoom.transform, 
                d3.zoomIdentity
            );
        }
    });
}

// Lazy loading (improve performance of site above because many SVG's)
function initSkyMapWhenVisible() {
    const container = document.getElementById("sky-map-container");
    if (!container) return;

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                buildSkyMap();
                obs.unobserve(entry.target);
            }
        });
    }, { 
        rootMargin: "300px 0px" // Start drawing 300px before it enters the screen
    });

    observer.observe(container);
}

if (window.globalExoplanetData && window.globalExoplanetData.length > 0) {
    initSkyMapWhenVisible();
} else {
    document.addEventListener('dataLoaded', initSkyMapWhenVisible);
}