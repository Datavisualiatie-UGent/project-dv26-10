/**
 * Builds an interactive sky map of exoplanets using
 * right ascension (RA) and declination (Dec).
 * 
 * - x-axis: right ascension in degrees
 * - y-axis: declination in degrees
 * - colour: discovery method
 * - points: fixed-size circles
 * - interaction: hover, zoom and pan
 */
async function buildSkyMap() {
    const rawData = await getExoplanetData();
    if (!rawData || rawData.length === 0) return;

    const parseNumber = value => {
        if (value == null) return null;
        if (typeof value === "string" && value.trim() === "") return null;

        const num = Number(value);
        return Number.isFinite(num) ? num : null;
    };

    const data = rawData
        .map(d => ({
            name: d.pl_name,
            method: d.discoverymethod || "Other",
            year: parseNumber(d.disc_year),
            ra: parseNumber(d.ra),
            dec: parseNumber(d.dec),
            distance: parseNumber(d.sy_dist),
            radius: parseNumber(d.pl_rade),
            mass: parseNumber(d.pl_bmasse)
        }))
        .filter(d => d.ra != null && d.dec != null);

    const container = document.getElementById("sky-map-container");
    if (!container) return;

    d3.select("#sky-map-container").selectAll("*").remove();

    const containerWidth = container.clientWidth || 900;

    const margin = { top: 30, right: 30, bottom: 60, left: 65 };
    const width = containerWidth - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    const svg = d3.select("#sky-map-container")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);

    const chart = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const tooltip = d3.select("body")
        .selectAll(".d3-tooltip-sky")
        .data([null])
        .join("div")
        .attr("class", "d3-tooltip d3-tooltip-sky")
        .style("opacity", 0);

    const x = d3.scaleLinear()
        .domain([0, 360])
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([-90, 90])
        .range([height, 0]);

    const xAxis = d3.axisBottom(x)
        .tickValues(d3.range(0, 361, 30))
        .tickFormat(d => `${d}°`);

    const yAxis = d3.axisLeft(y)
        .tickValues([-90, -60, -30, 0, 30, 60, 90])
        .tickFormat(d => `${d}°`);

    const xGrid = d3.axisBottom(x)
        .ticks(12)
        .tickSize(-height)
        .tickFormat("");

    const yGrid = d3.axisLeft(y)
        .ticks(7)
        .tickSize(-width)
        .tickFormat("");

    const gxGrid = chart.append("g")
        .attr("class", "grid")
        .attr("transform", `translate(0,${height})`)
        .attr("opacity", 0.15)
        .call(xGrid);

    const gyGrid = chart.append("g")
        .attr("class", "grid")
        .attr("opacity", 0.15)
        .call(yGrid);

    const gx = chart.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(xAxis);

    const gy = chart.append("g")
        .call(yAxis);

    chart.append("text")
        .attr("class", "axis-label")
        .attr("text-anchor", "middle")
        .attr("x", width / 2)
        .attr("y", height + 42)
        .text("Right Ascension (degrees)");

    chart.append("text")
        .attr("class", "axis-label")
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -45)
        .text("Declination (degrees)");

    const colorScale = method => {
        if (method === "Transit") return "var(--color-transit, #2563eb)";
        if (method === "Radial Velocity") return "var(--color-radial, #ea580c)";
        if (method === "Microlensing") return "var(--color-microlensing, #16a34a)";
        if (method === "Imaging") return "var(--color-imaging, #9333ea)";
        return "var(--color-other, #64748b)";
    };

    const clipId = "sky-map-clip";

    svg.append("defs")
        .append("clipPath")
        .attr("id", clipId)
        .append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", width)
        .attr("height", height);

    const plotArea = chart.append("g")
        .attr("clip-path", `url(#${clipId})`);

    const equatorLine = plotArea.append("line")
        .attr("x1", 0)
        .attr("x2", width)
        .attr("y1", y(0))
        .attr("y2", y(0))
        .attr("stroke", "#444")
        .attr("stroke-width", 1.2)
        .attr("stroke-dasharray", "4,3")
        .attr("opacity", 0.25);

    const pointsGroup = plotArea.append("g");

    const annotationLayer = plotArea.append("g");

    const equatorLabelRA = 348;
    const equatorLabelDec = 0;

    const equatorLabel = annotationLayer.append("text")
        .attr("x", x(equatorLabelRA))
        .attr("y", y(equatorLabelDec) - 6)
        .attr("text-anchor", "end")
        .style("font-size", "11px")
        .style("font-weight", "500")
        .style("fill", "#555")
        .style("paint-order", "stroke")
        .style("stroke", "white")
        .style("stroke-width", 2)
        .text("Celestial equator");

    const keplerLabelRA = 290.5;
    const keplerLabelDec = 44.5;

    const keplerLabel = annotationLayer.append("text")
        .attr("x", x(keplerLabelRA))
        .attr("y", y(keplerLabelDec))
        .attr("text-anchor", "middle")
        .style("dominant-baseline", "middle")
        .text("K")
        .style("font-size", "16px")
        .style("font-weight", "700")
        .style("fill", "#111");

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

    const points = pointsGroup.selectAll("circle")
        .data(data)
        .join("circle")
        .attr("cx", d => x(d.ra))
        .attr("cy", d => y(d.dec))
        .attr("r", baseRadius)
        .style("fill", d => colorScale(d.method))
        .style("opacity", baseOpacity)
        .style("stroke", "none")
        .on("mouseover", function() {
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
                    <strong>${d.name}</strong>
                    Method: ${d.method || "Unknown"}<br>
                    Discovery year: ${d.year != null ? d.year : "Unknown"}<br>
                    Distance: ${d.distance != null ? `${formatValue(d.distance)} pc` : "Unknown"}<br>
                    Radius: ${d.radius != null ? `${formatValue(d.radius)} R⊕` : "Unknown"}<br>
                    Mass: ${d.mass != null ? `${formatValue(d.mass)} M⊕` : "Unknown"}<br>
                    RA: ${formatCoordinate(d.ra)}°<br>
                    Dec: ${formatCoordinate(d.dec)}°
                `);
        })
        .on("mouseleave", function() {
            d3.select(this)
                .attr("r", baseRadius)
                .style("opacity", baseOpacity);

            tooltip.style("opacity", 0);
        });

    const legendCategories = ["Transit", "Radial Velocity", "Microlensing", "Imaging", "Other"];

    const rowHeight = 24;
    const totalRows = legendCategories.length + 1;

    const legendWidth = 115;
    const legendHeight = totalRows * rowHeight;

    const legendOffsetX = 5;
    const legendOffsetY = 7;

    const legendX = width - legendWidth + legendOffsetX;
    const legendY = height - legendHeight + legendOffsetY;

    const legend = chart.append("g")
        .attr("transform", `translate(${legendX}, ${legendY})`);

    legend.append("rect")
        .attr("x", -10)
        .attr("y", -12)
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .attr("fill", "var(--container-bg, #ffffff)")
        .style("opacity", 0.85)
        .attr("rx", 6);

    legend.selectAll("circle")
        .data(legendCategories)
        .join("circle")
        .attr("cx", 0)
        .attr("cy", (d, i) => i * rowHeight)
        .attr("r", 5.5)
        .style("fill", d => colorScale(d));

    legend.selectAll("text")
        .data(legendCategories)
        .join("text")
        .attr("x", 14)
        .attr("y", (d, i) => i * rowHeight)
        .style("font-size", "13px")
        .style("font-weight", "500")
        .style("fill", "var(--text-main, #333)")
        .style("alignment-baseline", "middle")
        .text(d => d);

    const keplerIndex = legendCategories.length;

    legend.append("text")
        .attr("x", 0)
        .attr("y", keplerIndex * rowHeight)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .style("font-weight", "700")
        .style("fill", "#111")
        .style("dominant-baseline", "middle")
        .text("K");

    legend.append("text")
        .attr("x", 14)
        .attr("y", keplerIndex * rowHeight)
        .style("font-size", "13px")
        .style("font-weight", "500")
        .style("fill", "var(--text-main, #333)")
        .style("alignment-baseline", "middle")
        .text("Kepler cluster");

    const zoom = d3.zoom()
        .scaleExtent([1, 10])
        .extent([[0, 0], [width, height]])
        .translateExtent([[0, 0], [width, height]])
        .on("zoom", zoomed);

    svg.call(zoom);

    function zoomed(event) {
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

        gxGrid.call(xGridZoom);
        gyGrid.call(yGridZoom);

        points
            .attr("cx", d => zx(d.ra))
            .attr("cy", d => zy(d.dec));

        keplerLabel
            .attr("x", zx(keplerLabelRA))
            .attr("y", zy(keplerLabelDec));

        equatorLine
            .attr("y1", zy(0))
            .attr("y2", zy(0));

        equatorLabel
            .attr("x", zx(equatorLabelRA))
            .attr("y", zy(equatorLabelDec) - 6);
    }
}

buildSkyMap();