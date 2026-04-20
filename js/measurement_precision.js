/**
 * Builds an interactive boxplot comparing measurement precision
 * across exoplanet discovery methods.
 *
 * - Supports multiple metrics (orbital period, distance, mass) via a segmented control
 * - Uses relative error to compute precision (higher is better)
 * - Displays Q1, median, Q3, and 5–95% whiskers on a log scale
 * - Includes tooltip interaction for detailed values
 */
async function buildMeasurementPrecisionPlot() {
    const rawData = await getExoplanetData();
    if (!rawData || rawData.length === 0) return;

    const mainMethods = ["Transit", "Radial Velocity", "Microlensing", "Imaging"];

    const metricOptions = {
        orbper: {
            valueKey: "pl_orbper",
            err1Key: "pl_orbpererr1",
            err2Key: "pl_orbpererr2"
        },
        orbsmax: {
            valueKey: "pl_orbsmax",
            err1Key: "pl_orbsmaxerr1",
            err2Key: "pl_orbsmaxerr2"
        },
        bmasse: {
            valueKey: "pl_bmasse",
            err1Key: "pl_bmasseerr1",
            err2Key: "pl_bmasseerr2"
        }
    };

    function computeBoxStats(values) {
        const sorted = values.slice().sort(d3.ascending);

        const q1 = d3.quantileSorted(sorted, 0.25);
        const median = d3.quantileSorted(sorted, 0.5);
        const q3 = d3.quantileSorted(sorted, 0.75);

        const min = d3.quantileSorted(sorted, 0.05);
        const max = d3.quantileSorted(sorted, 0.95);

        return {
            q1,
            median,
            q3,
            min,
            max
        };
    }

    const parseNumber = value => {
        if (value == null) return null;
        if (typeof value === "string" && value.trim() === "") return null;

        const num = Number(value);
        return Number.isFinite(num) ? num : null;
    };

    function prepareData(config) {
        const data = rawData
            .map(d => {
                if (!d.discoverymethod || !mainMethods.includes(d.discoverymethod)) {
                    return null;
                }

                const value = parseNumber(d[config.valueKey]);
                const err1 = parseNumber(d[config.err1Key]);
                const err2 = parseNumber(d[config.err2Key]);

                if (value == null || value <= 0) return null;
                if (err1 == null || err2 == null) return null;

                const absErr = (Math.abs(err1) + Math.abs(err2)) / 2;
                if (!Number.isFinite(absErr) || absErr <= 0) return null;

                const relErr = absErr / value;
                const precision = 1 / relErr;

                if (!Number.isFinite(precision) || precision <= 0) return null;

                return {
                    method: d.discoverymethod,
                    precision
                };
            })
            .filter(d => d != null);

        const grouped = d3.group(data, d => d.method);

        return mainMethods
            .filter(method => grouped.has(method) && grouped.get(method).length > 0)
            .map(method => {
                const values = grouped.get(method).map(d => d.precision);
                const stats = computeBoxStats(values);

                return {
                    method,
                    values,
                    ...stats
                };
            });
    }

    function formatPrecision(x) {
        if (x == null || !Number.isFinite(x)) return "Unknown";
        if (x >= 1000) return d3.format(",.0f")(x);
        if (x >= 10) return d3.format(",.1f")(x);
        return d3.format(".2f")(x);
    }

    const methodColors = {
        "Transit": "var(--color-transit, #2563eb)",
        "Radial Velocity": "var(--color-radial, #ea580c)",
        "Microlensing": "var(--color-microlensing, #16a34a)",
        "Imaging": "var(--color-imaging, #9333ea)"
    };

    function render(metricKey) {
        const config = metricOptions[metricKey];
        const boxData = prepareData(config);

        d3.select("#precision-plot-container").selectAll("*").remove();

        if (!boxData || boxData.length === 0) {
            d3.select("#precision-plot-container")
                .append("p")
                .style("color", "var(--text-muted)")
                .text("No valid data available for this metric.");
            return;
        }

        const container = document.getElementById("precision-plot-container");
        const width = container.clientWidth || 900;
        const height = 500;
        const margin = { top: 30, right: 30, bottom: 80, left: 110 };

        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        const svg = d3.select("#precision-plot-container")
            .append("svg")
            .attr("width", width)
            .attr("height", height);

        const g = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const x = d3.scaleBand()
            .domain(boxData.map(d => d.method))
            .range([0, innerWidth])
            .padding(0.35);

        const yMin = d3.min(boxData, d => d.min);
        const yMax = d3.max(boxData, d => d.max);

        if (!Number.isFinite(yMin) || !Number.isFinite(yMax) || yMin <= 0 || yMax <= 0) {
            d3.select("#precision-plot-container").selectAll("*").remove();
            d3.select("#precision-plot-container")
                .append("p")
                .style("color", "var(--text-muted)")
                .text("The selected metric cannot be shown on a log scale.");
            return;
        }

        const y = d3.scaleLog()
            .domain([yMin * 0.9, yMax * 1.1])
            .range([innerHeight, 0])
            .nice();

        const xAxis = g.append("g")
            .attr("transform", `translate(0,${innerHeight})`)
            .call(d3.axisBottom(x));

        xAxis.selectAll("text")
            .style("font-size", "12px")
            .style("fill", "var(--text-main)")
            .style("text-anchor", "middle")
            .attr("dy", "0.8em");

        const yAxis = g.append("g")
            .call(
                d3.axisLeft(y)
                    .tickValues(
                        y.ticks().filter(d => Number.isInteger(Math.log10(d)))
                    )
                    .tickFormat(d => d3.format(",")(d))
            );

        yAxis.selectAll("text")
            .style("fill", "var(--text-main)")
            .style("font-size", "12px");

        g.append("text")
            .attr("class", "axis-label")
            .attr("transform", "rotate(-90)")
            .attr("x", -innerHeight / 2)
            .attr("y", -78)
            .attr("text-anchor", "middle")
            .text("Measurement precision (higher is better)");

        const tooltip = d3.select("body")
            .selectAll(".d3-tooltip-precision")
            .data([null])
            .join("div")
            .attr("class", "d3-tooltip d3-tooltip-precision")
            .style("opacity", 0);

        const boxGroups = g.selectAll(".box-group")
            .data(boxData)
            .join("g")
            .attr("class", "box-group")
            .attr("transform", d => `translate(${x(d.method)},0)`);

        boxGroups.append("line")
            .attr("x1", x.bandwidth() / 2)
            .attr("x2", x.bandwidth() / 2)
            .attr("y1", d => y(d.min))
            .attr("y2", d => y(d.max))
            .attr("stroke", "var(--text-muted, #64748b)")
            .attr("stroke-width", 1.5);

        boxGroups.append("line")
            .attr("x1", x.bandwidth() * 0.25)
            .attr("x2", x.bandwidth() * 0.75)
            .attr("y1", d => y(d.min))
            .attr("y2", d => y(d.min))
            .attr("stroke", "var(--text-muted, #64748b)")
            .attr("stroke-width", 1.5);

        boxGroups.append("line")
            .attr("x1", x.bandwidth() * 0.25)
            .attr("x2", x.bandwidth() * 0.75)
            .attr("y1", d => y(d.max))
            .attr("y2", d => y(d.max))
            .attr("stroke", "var(--text-muted, #64748b)")
            .attr("stroke-width", 1.5);

        boxGroups.append("rect")
            .attr("x", 0)
            .attr("y", d => y(d.q3))
            .attr("width", x.bandwidth())
            .attr("height", d => Math.max(1, y(d.q1) - y(d.q3)))
            .attr("rx", 5)
            .attr("fill", d => methodColors[d.method])
            .attr("opacity", 0.85)
            .on("mouseover", function(event, d) {
                tooltip
                    .style("opacity", 1)
                    .html(`
                        <strong>${d.method}</strong>
                        Q1: ${formatPrecision(d.q1)}<br>
                        Median: ${formatPrecision(d.median)}<br>
                        Q3: ${formatPrecision(d.q3)}<br>
                        Planets: ${d3.format(",")(d.values.length)}
                    `)
            })
            .on("mousemove", function(event) {
                tooltip
                    .style("left", `${event.pageX + 15}px`)
                    .style("top", `${event.pageY - 20}px`);
            })
            .on("mouseleave", function() {
                tooltip.style("opacity", 0);
            });

        boxGroups.append("line")
            .attr("x1", 0)
            .attr("x2", x.bandwidth())
            .attr("y1", d => y(d.median))
            .attr("y2", d => y(d.median))
            .attr("stroke", "white")
            .attr("stroke-width", 2)
            .style("pointer-events", "none");
    }

    const toggle = document.getElementById("precision-toggle");
    if (!toggle) {
        render("orbper");
        return;
    }

    const buttons = toggle.querySelectorAll("button");

    buttons.forEach(btn => {
        btn.addEventListener("click", () => {
            buttons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            render(btn.dataset.metric);
        });
    });

    const activeButton = toggle.querySelector("button.active");
    render(activeButton ? activeButton.dataset.metric : "orbper");
}

buildMeasurementPrecisionPlot();