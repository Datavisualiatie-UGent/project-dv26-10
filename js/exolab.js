function initExolab() {
    const data = window.globalExoplanetData;
    let currentMatches = [];
    let currentIndex = 0;

    // Sliders
    let bounds = {
        mass: { min: Infinity, max: -Infinity },
        rad: { min: Infinity, max: -Infinity },
        dist: { min: Infinity, max: -Infinity }
    };

    data.forEach(d => {
        if (d.pl_bmasse) { bounds.mass.min = Math.min(bounds.mass.min, +d.pl_bmasse); bounds.mass.max = Math.max(bounds.mass.max, +d.pl_bmasse); }
        if (d.pl_rade) { bounds.rad.min = Math.min(bounds.rad.min, +d.pl_rade); bounds.rad.max = Math.max(bounds.rad.max, +d.pl_rade); }
        if (d.pl_orbsmax) { bounds.dist.min = Math.min(bounds.dist.min, +d.pl_orbsmax); bounds.dist.max = Math.max(bounds.dist.max, +d.pl_orbsmax); }
    });

    function initSlider(idMin, idMax, idFill, idDisplay, minVal, maxVal) {
        const minIn = document.getElementById(idMin);
        const maxIn = document.getElementById(idMax);
        const fill = document.getElementById(idFill);
        const display = document.getElementById(idDisplay);

        minIn.min = minVal; minIn.max = maxVal; minIn.value = minVal;
        maxIn.min = minVal; maxIn.max = maxVal; maxIn.value = maxVal;

        function update() {
            let v1 = parseFloat(minIn.value);
            let v2 = parseFloat(maxIn.value);
            if (v1 > v2) { let tmp = v1; v1 = v2; v2 = tmp; }
            
            const p1 = ((v1 - minVal) / (maxVal - minVal)) * 100;
            const p2 = ((v2 - minVal) / (maxVal - minVal)) * 100;
            
            fill.style.left = p1 + "%";
            fill.style.width = (p2 - p1) + "%";
            display.innerText = `${window.formatExoNumber(v1, 1)} - ${window.formatExoNumber(v2, 1)}`;
        }

        minIn.addEventListener('input', update);
        maxIn.addEventListener('input', update);
        update();
    }

    initSlider('mass-min', 'mass-max', 'fill-mass', 'display-mass', Math.floor(bounds.mass.min), Math.ceil(bounds.mass.max));
    initSlider('rad-min', 'rad-max', 'fill-rad', 'display-rad', Math.floor(bounds.rad.min), Math.ceil(bounds.rad.max));
    initSlider('dist-min', 'dist-max', 'fill-dist', 'display-dist', Math.floor(bounds.dist.min), Math.ceil(bounds.dist.max));

    // Buttons and search logic
    document.querySelectorAll('.method-btn').forEach(btn => {
        btn.addEventListener('click', () => btn.classList.toggle('active'));
    });

    document.getElementById('search-btn').addEventListener('click', () => {
        const activeMethods = Array.from(document.querySelectorAll('.exolab-controls .method-btn.active')).map(btn => btn.dataset.method);
        const getRange = (minId, maxId) => {
            const v1 = +document.getElementById(minId).value;
            const v2 = +document.getElementById(maxId).value;
            return [Math.min(v1, v2), Math.max(v1, v2)];
        };

        const nameQuery = document.getElementById('planet-search').value.toLowerCase().replace(/\s+/g, '');
        const rMass = getRange('mass-min', 'mass-max');
        const rRad = getRange('rad-min', 'rad-max');
        const rDist = getRange('dist-min', 'dist-max');

        const allowUnkMass = document.getElementById('mass-allow-unknown').checked;
        const allowUnkRad = document.getElementById('rad-allow-unknown').checked;
        const allowUnkDist = document.getElementById('dist-allow-unknown').checked;

        const tMass = (rMass[0] + rMass[1]) / 2;
        const tRad = (rRad[0] + rRad[1]) / 2;
        const tDist = (rDist[0] + rDist[1]) / 2;

        let filtered = data.filter(d => {
            const m = d.pl_bmasse ? +d.pl_bmasse : null;
            const r = d.pl_rade ? +d.pl_rade : null;
            const dist = d.pl_orbsmax ? +d.pl_orbsmax : null;
            const method = d.discoverymethod;

            const pName = d.pl_name.toLowerCase().replace(/\s+/g, '');
            const nameMatch = nameQuery === "" || pName.includes(nameQuery);
            const massMatch = (m === null && allowUnkMass) || (m !== null && m >= rMass[0] && m <= rMass[1]);
            const radMatch = (r === null && allowUnkRad) || (r !== null && r >= rRad[0] && r <= rRad[1]);
            const distMatch = (dist === null && allowUnkDist) || (dist !== null && dist >= rDist[0] && dist <= rDist[1]);
            
            let methodMatch = activeMethods.includes(method);
            if (!methodMatch && activeMethods.includes("Other")) {
                const main = ["Transit", "Radial Velocity", "Microlensing", "Imaging"];
                methodMatch = !main.includes(method);
            }

            return massMatch && radMatch && distMatch && methodMatch && nameMatch;
        });

        const UNKNOWN_PENALTY = 0.75;

        filtered.forEach(d => {
            let score = 0;
            
            score += d.pl_bmasse ? Math.abs(+d.pl_bmasse - tMass) / (rMass[1] - rMass[0] || 1) : UNKNOWN_PENALTY;
            score += d.pl_rade ? Math.abs(+d.pl_rade - tRad) / (rRad[1] - rRad[0] || 1) : UNKNOWN_PENALTY;
            score += d.pl_orbsmax ? Math.abs(+d.pl_orbsmax - tDist) / (rDist[1] - rDist[0] || 1) : UNKNOWN_PENALTY;
            
            d.matchScore = score;
        });

        currentMatches = filtered.sort((a, b) => a.matchScore - b.matchScore);
        currentIndex = 0;
        renderCarousel();
    });

    document.getElementById('planet-search').addEventListener('input', () => {
        document.getElementById('search-btn').click();
    });

    // Render ID carousel
    function renderCarousel() {
        const carousel = document.getElementById('exolab-carousel');
        const controls = document.getElementById('carousel-controls');
        
        if (currentMatches.length === 0) {
            carousel.innerHTML = `<div class="empty-state-centered"><p>No worlds found. Please widen your ranges.</p></div>`;
            controls.style.visibility = 'hidden'; 
            
            window.currentExolabPlanet = null;
            document.dispatchEvent(new Event('planetSelected'));

            return;
        }

        controls.style.visibility = currentMatches.length > 1 ? 'visible' : 'hidden';
        
        document.getElementById('match-counter').innerText = `${currentIndex + 1} / ${window.formatExoNumber(currentMatches.length)}`;
        document.getElementById('match-label').innerText = currentIndex === 0 ? "Best match" : "Alternative";

        carousel.innerHTML = ''; 

        [-1, 0, 1].forEach(offset => {
            // Cyclical logic
            let targetIdx = (currentIndex + offset + currentMatches.length) % currentMatches.length;
            
            if (currentMatches.length === 1 && offset !== 0) return;
            if (currentMatches.length === 2 && offset === 1) return;

            const p = currentMatches[targetIdx];
            if (offset === 0) {
                window.currentExolabPlanet = p;
                document.dispatchEvent(new Event('planetSelected'));
            }
            let methodClass = p.discoverymethod.toLowerCase().replace(' ', '-');
            if (!['transit', 'radial-velocity', 'microlensing', 'imaging'].includes(methodClass)) methodClass = 'other';
            let positionClass = offset === 0 ? 'card-center' : (offset === -1 ? 'card-left' : 'card-right');

            const fMass = p.pl_bmasse ? window.formatExoNumber(p.pl_bmasse, 2) + " M<sub>⊕</sub>" : "Unknown";
            const fRad = p.pl_rade ? window.formatExoNumber(p.pl_rade, 2) + " R<sub>⊕</sub>" : "Unknown";
            const fDist = p.pl_orbsmax ? window.formatExoNumber(p.pl_orbsmax, 2) + " AU" : "Unknown";
            const fPer = p.pl_orbper ? window.formatExoNumber(p.pl_orbper, 1) + " days" : "Unknown";
            const fYear = p.disc_year || "Unknown";

            const family = window.globalExoplanetData.filter(d => d.hostname === p.hostname);
            const familyHTML = renderSystemGraphic(p, family);

            const cardHTML = `
                <div class="horizontal-card ${positionClass}">
                    <div class="card-glow"></div>
                    <div class="card-body">
                        
                        <!-- Top data -->
                        <div class="id-header">
                            <h3 class="planet-title" title="${p.pl_name}">${p.pl_name}</h3>
                        </div>
                        
                        <div class="id-grid">
                            <div class="id-item"><span>Mass</span> ${fMass}</div>
                            <div class="id-item"><span>Radius</span> ${fRad}</div>
                            <div class="id-item"><span>Distance</span> ${fDist}</div>
                            <div class="id-item span-2"><span>Orbital period</span> ${fPer}</div>
                            <div class="id-item"><span>Discovery year</span> ${fYear}</div>
                        </div>

                        ${familyHTML}

                    </div>
                    
                    <!-- Bottom data -->
                    <div class="card-footer">
                        <div class="method-tag tag-${methodClass}" title="${p.discoverymethod}">${p.discoverymethod}</div>
                        <div class="facility-tag" title="${p.disc_facility || 'Unknown Facility'}">${p.disc_facility || "Unknown Facility"}</div>
                    </div>
                </div>
            `;
            carousel.insertAdjacentHTML('beforeend', cardHTML);
        });
    }

    // Render star system graphic
    function renderSystemGraphic(mainPlanet, family) {
        const sRad = mainPlanet.st_rad ? window.formatExoNumber(mainPlanet.st_rad, 2) + " R<sub>☉</sub>" : "Unknown";
        const sRA = mainPlanet.ra ? (+mainPlanet.ra).toFixed(1) + "°" : "Unknown";
        const sDec = mainPlanet.dec ? (+mainPlanet.dec).toFixed(1) + "°" : "Unknown";
        
        const siblingsCount = family.length - 1;
        let sibText = siblingsCount === 1 ? '1 other known sibling' : `${siblingsCount} other known siblings`;
        if (siblingsCount === 0) sibText = 'no other known siblings';

        let html = `
            <div class="tech-system-view">
                <div class="system-desc">
                    <h4>The ${mainPlanet.hostname} System</h4>
                    <p>This planet lives in a system with ${sibText}.</p>
                </div>
                <div class="tech-orbit-line">
                    <div class="tech-star-point"></div>
        `;

        const sortedFamily = family.sort((a,b) => (+a.pl_orbsmax || 0) - (+b.pl_orbsmax || 0));
        
        sortedFamily.forEach(sib => {
            const isMain = sib.pl_name === mainPlanet.pl_name;
            const clickAction = isMain ? "" : `onclick="viewSpecificPlanet('${sib.pl_name.replace(/'/g, "\\'")}')"`;
            html += `<div class="tech-planet-point ${isMain ? 'active' : 'sibling'}" title="${sib.pl_name}" ${clickAction}></div>`;
        });

        html += `
                </div>
                <div class="tech-star-info">Star radius: ${sRad} &nbsp;|&nbsp; RA: ${sRA} &nbsp;|&nbsp; Dec: ${sDec}</div>
            </div>`;
        return html;
    }

    // Navigation of ID's
    window.cycleCard = (dir) => {
        if (currentMatches.length <= 1) return;
        currentIndex = (currentIndex + dir + currentMatches.length) % currentMatches.length;
        renderCarousel();
    };

    window.viewSpecificPlanet = (planetName) => {
        const specific = window.globalExoplanetData.find(d => d.pl_name === planetName);
        if (specific) {
            currentMatches = [specific];
            currentIndex = 0;
            renderCarousel();
        }
    };
}

if (window.globalExoplanetData && window.globalExoplanetData.length > 0) {
    initExolab();
} else {
    document.addEventListener('dataLoaded', initExolab);
}