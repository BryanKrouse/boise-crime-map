// Boise Crime Map - Interactive Dashboard
// Uses Mapbox GL JS with focus radius hover effect

const CONFIG = {
    // Get your free Mapbox token at https://mapbox.com/ and replace below
    mapboxToken: 'YOUR_MAPBOX_TOKEN_HERE',
    apiUrl: 'https://services1.arcgis.com/WHM6qC35aMtyAAlN/arcgis/rest/services/BPD_Crimes_Public/FeatureServer/0/query',
    boiseBounds: [-116.35, 43.52, -116.1, 43.72],
    boiseCenter: [-116.2, 43.615],
    initialZoom: 12,
    defaultRadius: 0.5, // miles
    recordLimit: 10000, // Max records to fetch per request
};

let map;
let crimeData = [];
let filteredData = [];
let focusRadius = CONFIG.defaultRadius;
let currentFilter = { crimeType: 'all', severity: 'all' };

// Initialize the application
document.addEventListener('DOMContentLoaded', init);

async function init() {
    try {
        mapboxgl.accessToken = CONFIG.mapboxToken;

        map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/dark-v11',
            center: CONFIG.boiseCenter,
            zoom: CONFIG.initialZoom,
            minZoom: 10,
            maxZoom: 18,
        });

        map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

        map.on('load', async () => {
            await loadCrimeData();
            setupMapLayers();
            setupEventListeners();
            hideLoading();
        });

    } catch (error) {
        console.error('Initialization error:', error);
        showError('Failed to initialize map');
    }
}

async function loadCrimeData() {
    try {
        // Build query for recent crimes (last 2 years for performance)
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
        const dateString = twoYearsAgo.toISOString().split('T')[0];

        let allFeatures = [];
        let offset = 0;
        let hasMore = true;

        // Paginate through results
        while (hasMore && offset < 50000) {
            const params = new URLSearchParams({
                where: `OccurredDateTime >= '${dateString}'`,
                outFields: 'ChargeDescription,CrimeCodeGroup,Severity,OccurredDateTime,IncidentAddress,PatrolArea',
                outSR: '4326', // WGS84 for lat/lng
                f: 'geojson',
                resultOffset: offset,
                resultRecordCount: CONFIG.recordLimit,
            });

            const response = await fetch(`${CONFIG.apiUrl}?${params}`);
            if (!response.ok) throw new Error('API request failed');

            const data = await response.json();

            if (data.features && data.features.length > 0) {
                allFeatures = allFeatures.concat(data.features);
                offset += data.features.length;
                hasMore = data.features.length === CONFIG.recordLimit;

                // Update loading status
                document.querySelector('#loading p').textContent =
                    `Loading crime data... ${allFeatures.length.toLocaleString()} records`;
            } else {
                hasMore = false;
            }
        }

        crimeData = allFeatures.filter(f =>
            f.geometry && f.geometry.coordinates &&
            f.geometry.coordinates[0] && f.geometry.coordinates[1]
        );

        filteredData = [...crimeData];
        populateFilters();
        updateTotalStats();

        console.log(`Loaded ${crimeData.length} crime records`);

    } catch (error) {
        console.error('Error loading crime data:', error);
        showError('Failed to load crime data');
    }
}

function setupMapLayers() {
    // Add crime points as a GeoJSON source
    map.addSource('crimes', {
        type: 'geojson',
        data: {
            type: 'FeatureCollection',
            features: filteredData
        }
    });

    // Heatmap layer for density visualization
    map.addLayer({
        id: 'crimes-heat',
        type: 'heatmap',
        source: 'crimes',
        maxzoom: 15,
        paint: {
            'heatmap-weight': 1,
            'heatmap-intensity': [
                'interpolate', ['linear'], ['zoom'],
                10, 0.5,
                15, 2
            ],
            'heatmap-color': [
                'interpolate', ['linear'], ['heatmap-density'],
                0, 'rgba(0,0,0,0)',
                0.1, 'rgba(255,107,107,0.2)',
                0.3, 'rgba(255,107,107,0.4)',
                0.5, 'rgba(255,140,0,0.6)',
                0.7, 'rgba(255,165,0,0.8)',
                1, 'rgba(255,69,0,1)'
            ],
            'heatmap-radius': [
                'interpolate', ['linear'], ['zoom'],
                10, 15,
                15, 30
            ],
            'heatmap-opacity': 0.8
        }
    });

    // Point layer for detailed view
    map.addLayer({
        id: 'crimes-point',
        type: 'circle',
        source: 'crimes',
        minzoom: 13,
        paint: {
            'circle-radius': [
                'interpolate', ['linear'], ['zoom'],
                13, 3,
                16, 6
            ],
            'circle-color': [
                'match', ['get', 'Severity'],
                'Felony', '#ff4444',
                'Misdemeanor', '#ffa500',
                '#ff6b6b'
            ],
            'circle-stroke-color': '#fff',
            'circle-stroke-width': 1,
            'circle-opacity': [
                'interpolate', ['linear'], ['zoom'],
                13, 0,
                14, 0.8
            ]
        }
    });

    // Focus circle source (for highlighting radius)
    map.addSource('focus-circle', {
        type: 'geojson',
        data: {
            type: 'FeatureCollection',
            features: []
        }
    });

    map.addLayer({
        id: 'focus-circle-fill',
        type: 'fill',
        source: 'focus-circle',
        paint: {
            'fill-color': 'rgba(255, 107, 107, 0.15)',
            'fill-outline-color': 'rgba(255, 107, 107, 0.8)'
        }
    });

    map.addLayer({
        id: 'focus-circle-line',
        type: 'line',
        source: 'focus-circle',
        paint: {
            'line-color': 'rgba(255, 107, 107, 0.8)',
            'line-width': 2
        }
    });
}

function setupEventListeners() {
    const radiusSlider = document.getElementById('radius-slider');
    const crimeFilter = document.getElementById('crime-filter');
    const severityFilter = document.getElementById('severity-filter');

    // Radius slider
    radiusSlider.addEventListener('input', (e) => {
        focusRadius = parseFloat(e.target.value);
        document.getElementById('radius-display').textContent = focusRadius.toFixed(1);
    });

    // Crime type filter
    crimeFilter.addEventListener('change', (e) => {
        currentFilter.crimeType = e.target.value;
        applyFilters();
    });

    // Severity filter
    severityFilter.addEventListener('change', (e) => {
        currentFilter.severity = e.target.value;
        applyFilters();
    });

    // Map mouse move - update focus circle and stats
    map.on('mousemove', handleMouseMove);
    map.on('mouseleave', handleMouseLeave);

    // Point hover for tooltip
    map.on('mouseenter', 'crimes-point', handlePointHover);
    map.on('mouseleave', 'crimes-point', hideTooltip);
}

function handleMouseMove(e) {
    const center = [e.lngLat.lng, e.lngLat.lat];

    // Create focus circle
    const circle = turf.circle(center, focusRadius, { units: 'miles', steps: 64 });

    map.getSource('focus-circle').setData({
        type: 'FeatureCollection',
        features: [circle]
    });

    // Find crimes within radius
    const crimesInRadius = getCrimesInRadius(center, focusRadius);
    updateFocusStats(crimesInRadius);
}

function handleMouseLeave() {
    map.getSource('focus-circle').setData({
        type: 'FeatureCollection',
        features: []
    });

    // Reset to total stats
    updateTotalStats();
}

function getCrimesInRadius(center, radiusMiles) {
    const centerPoint = turf.point(center);

    return filteredData.filter(feature => {
        if (!feature.geometry || !feature.geometry.coordinates) return false;
        const point = turf.point(feature.geometry.coordinates);
        const distance = turf.distance(centerPoint, point, { units: 'miles' });
        return distance <= radiusMiles;
    });
}

function updateFocusStats(crimes) {
    const count = crimes.length;
    const felonies = crimes.filter(c => c.properties.Severity === 'Felony').length;
    const misdemeanors = crimes.filter(c => c.properties.Severity === 'Misdemeanor').length;

    document.getElementById('crime-count').textContent = count.toLocaleString();
    document.getElementById('felony-count').textContent = felonies.toLocaleString();
    document.getElementById('misdemeanor-count').textContent = misdemeanors.toLocaleString();

    // Update crime types breakdown
    updateCrimeBreakdown(crimes);
}

function updateTotalStats() {
    const count = filteredData.length;
    const felonies = filteredData.filter(c => c.properties.Severity === 'Felony').length;
    const misdemeanors = filteredData.filter(c => c.properties.Severity === 'Misdemeanor').length;

    document.getElementById('crime-count').textContent = count.toLocaleString();
    document.getElementById('felony-count').textContent = felonies.toLocaleString();
    document.getElementById('misdemeanor-count').textContent = misdemeanors.toLocaleString();

    updateCrimeBreakdown(filteredData);
}

function updateCrimeBreakdown(crimes) {
    const typeCounts = {};

    crimes.forEach(crime => {
        const type = crime.properties.CrimeCodeGroup || 'Unknown';
        typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    // Sort by count and take top 5
    const sorted = Object.entries(typeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const maxCount = sorted.length > 0 ? sorted[0][1] : 1;
    const container = document.getElementById('crime-types-list');

    container.innerHTML = sorted.map(([type, count]) => `
        <div class="crime-type-item">
            <span class="crime-type-count">${count}</span>
            <div class="crime-type-bar" style="width: ${(count / maxCount) * 100}px"></div>
            <span class="crime-type-name" title="${type}">${formatCrimeType(type)}</span>
        </div>
    `).join('');
}

function formatCrimeType(type) {
    if (!type) return 'Unknown';
    return type
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
        .substring(0, 25);
}

function handlePointHover(e) {
    if (!e.features || e.features.length === 0) return;

    const feature = e.features[0];
    const props = feature.properties;

    const tooltip = document.getElementById('tooltip');
    tooltip.innerHTML = `
        <div class="tooltip-title">${props.ChargeDescription || 'Unknown Crime'}</div>
        <div class="tooltip-detail">
            ${props.Severity || 'N/A'} | ${props.PatrolArea || 'Unknown Area'}<br>
            ${props.IncidentAddress || 'Address redacted'}
        </div>
    `;

    tooltip.style.display = 'block';
    tooltip.style.left = `${e.point.x + 15}px`;
    tooltip.style.top = `${e.point.y - 10}px`;

    map.getCanvas().style.cursor = 'pointer';
}

function hideTooltip() {
    document.getElementById('tooltip').style.display = 'none';
    map.getCanvas().style.cursor = '';
}

function populateFilters() {
    const crimeTypes = new Set();

    crimeData.forEach(crime => {
        const type = crime.properties.CrimeCodeGroup;
        if (type) crimeTypes.add(type);
    });

    const select = document.getElementById('crime-filter');
    const sortedTypes = Array.from(crimeTypes).sort();

    sortedTypes.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = formatCrimeType(type);
        select.appendChild(option);
    });
}

function applyFilters() {
    filteredData = crimeData.filter(crime => {
        const props = crime.properties;

        if (currentFilter.crimeType !== 'all' && props.CrimeCodeGroup !== currentFilter.crimeType) {
            return false;
        }

        if (currentFilter.severity !== 'all' && props.Severity !== currentFilter.severity) {
            return false;
        }

        return true;
    });

    // Update map source
    map.getSource('crimes').setData({
        type: 'FeatureCollection',
        features: filteredData
    });

    updateTotalStats();
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

function showError(message) {
    const loading = document.getElementById('loading');
    loading.innerHTML = `
        <p style="color: #ff6b6b;">Error: ${message}</p>
        <p style="margin-top: 10px; font-size: 0.8rem;">Please refresh the page to try again.</p>
    `;
}
