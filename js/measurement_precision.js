
async function buildMeasurementPrecisionPlot() {
    const rawData = window.globalExoplanetData;
    if (!rawData || rawData.length === 0) return;

    const mainMethods = ["Transit", "Radial velocity", "Microlensing", "Imaging"];

    const metricOptions = {
        orbper: { valueKey: "pl_orbper", err1Key: "pl_orbpererr1", err2Key: "pl_orbpererr2", title: "Orbital Period" },
        orbsmax: { valueKey: "pl_orbsmax", err1Key: "pl_orbsmaxerr1", err2Key: "pl_orbsmaxerr2", title: "Orbital Distance" },
        bmasse: { valueKey: "pl_bmasse", err1Key: "pl_bmasseerr1", err2Key: "pl_bmasseerr2", title: "Planet Mass" }
    };

    // Data preparation
    function computeBoxStats(values) {
        const sorted = values.slice().sort(d3.ascending);
        return {
            q1: d3.quantileSorted(sorted, 0.25),
            median: d3.quantileSorted(sorted, 0.5),
            q3: d3.quantileSorted(sorted, 0.75),
            min: d3.quantileSorted(sorted, 0.05), // 5th percentile
            max: d3.quantileSorted(sorted, 0.95)  // 95th percentile
        };
    }

    const parseNumber = value => {
        if (value == null || (typeof value === "string" && value.trim() === "")) return null;
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
    };

    function prepareData(config) {
        const data = rawData.map(d => {
            let m = d.discoverymethod;
            if (m === "Radial Velocity") m = "Radial velocity";
            if (!m || !mainMethods.includes(m)) return null;

            const value = parseNumber(d[config.valueKey]);
            const err1 = parseNumber(d[config.err1Key]);
            const err2 = parseNumber(d[config.err2Key]);

            if (value == null || value <= 0 || err1 == null || err2 == null) return null;

            const absErr = (Math.abs(err1) + Math.abs(err2)) / 2;
            if (!Number.isFinite(absErr) || absErr <= 0) return null;

            const relErr = absErr / value;
            const precision = 1 / relErr;

            if (!Number.isFinite(precision) || precision <= 0) return null;

            return { method: m, precision };
        }).filter(Boolean);

        const grouped = d3.group(data, d => d.method);

        return mainMethods
            .filter(method => grouped.has(method) && grouped.get(method).length > 0)
            .map(method => {
                const values = grouped.get(method).map(d => d.precision);
                return { method, values, ...computeBoxStats(values) };
            });
    }

    const colorScale = (method) => {
        if (method === "Transit") return "var(--color-transit)";
        if (method === "Radial velocity") return "var(--color-radial)";
        if (method === "Microlensing") return "var(--color-microlensing)";
        if (method === "Imaging") return "var(--color-imaging)";
        return "var(--color-other)";
    };

    // Dimensions and lay-out
    const container = document.getElementById("precision-plot-container");
    container.innerHTML = ""; // Clear existing

    const width = 1050;
    const height = 450;
    const margin = { top: 30, right: 20, bottom: 60, left: 85 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select("#precision-plot-container")
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .style("width", "100%")
        .style("height", "auto");

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    let tooltip = d3.select("body").select(".exo-tooltip");
    if (tooltip.empty()) {
        tooltip = d3.select("body").append("div").attr("class", "exo-tooltip").style("pointer-events", "none");
    }

    // Scales
    const x = d3.scaleBand()
        .domain(mainMethods)
        .range([0, innerWidth])
        .padding(0.4);
    
    let y = d3.scaleLog().range([innerHeight, 0]);

    const gridGroup = g.append("g").attr("class", "grid").attr("opacity", 0.08);
    const boxContainer = g.append("g").attr("class", "boxes-container");
    const gx = g.append("g").attr("transform", `translate(0,${innerHeight})`);
    const gy = g.append("g");

    gx.call(d3.axisBottom(x).tickSizeOuter(0));
    gx.select(".domain").attr("stroke", "var(--border-light)");
    gx.selectAll(".tick line").attr("opacity", 0);
    gx.selectAll("text")
        .style("font-family", "var(--font-heading)")
        .style("font-size", "12px")
        .style("font-weight", "600")
        .style("fill", "var(--text-dark)")
        .attr("dy", "1em");

    g.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -innerHeight / 2)
        .attr("y", -65)
        .attr("text-anchor", "middle")
        .style("font-family", "var(--font-heading)")
        .style("font-size", "12px")
        .style("font-weight", "700")
        .style("text-transform", "uppercase")
        .style("letter-spacing", "1px")
        .style("fill", "var(--text-muted)")
        .text(`Precision (1 / Rel. Error)`);

    /// Highlight logic for microlensing
    const highlightMethod = (targetMethod) => {
        boxContainer.selectAll(".box-group").style("opacity", d => d.method === targetMethod ? 1 : 0.1);
        d3.selectAll(".highlight-action").style("opacity", function() {
            return d3.select(this).attr("data-method") === targetMethod ? 1 : 0.4;
        });
    };

    const resetHighlights = () => {
        boxContainer.selectAll(".box-group").style("opacity", 1);
        d3.selectAll(".highlight-action").style("opacity", 1);
    };

    d3.selectAll(".highlight-action")
        .on("mouseenter", function() { highlightMethod(d3.select(this).attr("data-method")); })
        .on("mouseleave", resetHighlights);

    // Dynamic rendering for change between views
    function render(metricKey) {
        const config = metricOptions[metricKey];
        const boxData = prepareData(config);
        if (!boxData || boxData.length === 0) return;

        // Calculate range
        const yMin = d3.min(boxData, d => d.min);
        const yMax = d3.max(boxData, d => d.max);
        
        y.domain([Math.max(0.1, yMin * 0.5), yMax * 2]).nice();

        const getPowersOf10 = (min, max) => {
            const start = Math.floor(Math.log10(min));
            const end = Math.ceil(Math.log10(max));
            return d3.range(start, end + 1).map(p => Math.pow(10, p));
        };
        const yTicks = getPowersOf10(y.domain()[0], y.domain()[1]);

        const t = svg.transition().duration(1000).ease(d3.easeCubicInOut);

        const logFormat = d => d >= 1000 ? window.formatExoNumber(d, 0) : d;

        gridGroup.transition(t)
            .call(d3.axisLeft(y).tickValues(yTicks).tickSize(-innerWidth).tickFormat(""));
        
        gy.transition(t)
            .call(d3.axisLeft(y).tickValues(yTicks).tickFormat(logFormat).tickSizeOuter(0))
            .on("end", function() {
                d3.select(this).select(".domain").attr("stroke", "var(--border-light)");
                d3.select(this).selectAll(".tick line").attr("stroke", "var(--border-light)");
                d3.select(this).selectAll("text").style("font-family", "var(--font-body)").style("font-variant-numeric", "tabular-nums").style("fill", "var(--text-muted)");
            });

        gy.select(".domain").attr("stroke", "var(--border-light)");
        gy.selectAll(".tick line").attr("stroke", "var(--border-light)");
        gy.selectAll("text").style("font-family", "var(--font-body)").style("font-variant-numeric", "tabular-nums").style("fill", "var(--text-muted)");
        
        const boxes = boxContainer.selectAll(".box-group")
            .data(boxData, d => d.method);

        const boxesEnter = boxes.enter().append("g")
            .attr("class", "box-group")
            .attr("data-method", d => d.method)
            .attr("transform", d => `translate(${x(d.method)},0)`);

        boxesEnter.append("line").attr("class", "whisker")
            .attr("x1", x.bandwidth() / 2).attr("x2", x.bandwidth() / 2)
            .attr("y1", innerHeight).attr("y2", innerHeight) // Start at bottom
            .attr("stroke", "var(--text-muted)").attr("stroke-width", 1.5).style("opacity", 0.6);

        boxesEnter.append("rect").attr("class", "iqr-box")
            .attr("x", 0).attr("y", innerHeight).attr("width", x.bandwidth()).attr("height", 0) // Start flat
            .attr("rx", 4).attr("fill", d => colorScale(d.method)).attr("opacity", 0.8);

        boxesEnter.append("line").attr("class", "median-line")
            .attr("x1", 2).attr("x2", x.bandwidth() - 2)
            .attr("y1", innerHeight).attr("y2", innerHeight)
            .attr("stroke", "white").attr("stroke-width", 2.5).style("pointer-events", "none");

        const boxesMerge = boxesEnter.merge(boxes);

        boxesMerge.select(".whisker").transition(t)
            .attr("y1", d => y(d.min))
            .attr("y2", d => y(d.max));

        boxesMerge.select(".iqr-box").transition(t)
            .attr("y", d => y(d.q3))
            .attr("height", d => Math.max(2, y(d.q1) - y(d.q3)));

        boxesMerge.select(".median-line").transition(t)
            .attr("y1", d => y(d.median))
            .attr("y2", d => y(d.median));

        boxesMerge.select(".iqr-box")
            .on("mouseover", function(event, d) {
                d3.select(this).style("filter", "brightness(1.2)");
                tooltip.style("transition", "none").style("opacity", 1).html(`
                    <div class="tt-header">${d.method}</div>
                    <table style="width: 100%; min-width: 160px; font-size: 0.8rem; margin-top: 8px; border-collapse: collapse;">
                        <tr><td style="padding-bottom: 4px; color: var(--text-light);">95th pctl:</td><td style="text-align: right; font-weight: bold; font-variant-numeric: tabular-nums; padding-bottom: 4px;">${window.formatExoNumber(d.max, 1)}</td></tr>
                        <tr><td style="padding-bottom: 4px; color: var(--text-light);">Median:</td><td style="text-align: right; font-weight: bold; font-variant-numeric: tabular-nums; padding-bottom: 4px; color: ${colorScale(d.method)};">${window.formatExoNumber(d.median, 1)}</td></tr>
                        <tr><td style="padding-bottom: 4px; color: var(--text-light);">5th pctl:</td><td style="text-align: right; font-weight: bold; font-variant-numeric: tabular-nums; padding-bottom: 4px;">${window.formatExoNumber(d.min, 1)}</td></tr>
                        <tr style="border-top: 1px solid rgba(255,255,255,0.2);"><td style="padding-top: 6px; color: var(--text-light);">Sample size:</td><td style="text-align: right; padding-top: 6px;">${window.formatExoNumber(d.values.length)}</td></tr>
                    </table>
                `);
            })
            .on("mousemove", event => tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 20) + "px"))
            .on("mouseleave", function() {
                d3.select(this).style("filter", "none");
                tooltip.style("opacity", 0);
            });

        boxes.exit().transition(t).style("opacity", 0).remove();
    }

    // Button controls
    const toggleMetric = (metric) => {
        d3.selectAll("#precision-toggle button").classed("active", false);
        d3.select(`#precision-toggle button[data-metric="${metric}"]`).classed("active", true);
        render(metric);
    };

    d3.selectAll("#precision-toggle button").on("click", function() { toggleMetric(d3.select(this).attr("data-metric")); });
    d3.selectAll(".metric-action").on("click", function() { toggleMetric(d3.select(this).attr("data-metric")); });

    // Initial Load
    toggleMetric("orbper");
}

// Lazy load
function initPrecisionWhenVisible() {
    const container = document.getElementById("precision-plot-container");
    if (!container) return;

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                buildMeasurementPrecisionPlot();
                obs.unobserve(entry.target); 
            }
        });
    }, { rootMargin: "500px 0px" });

    observer.observe(container);
}

if (window.globalExoplanetData && window.globalExoplanetData.length > 0) {
    initPrecisionWhenVisible();
} else {
    document.addEventListener('dataLoaded', initPrecisionWhenVisible);
}