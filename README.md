# Boise Crime Map

An interactive crime density visualization for Boise, Idaho. Hover over the map to explore crime statistics within a customizable focus radius.

## Features

- **Focus Radius Visualization**: Hover anywhere on the map to see crime counts within a configurable radius (0.1 to 2 miles)
- **Real-time Statistics**: View crime counts, felony/misdemeanor breakdown, and top crime types
- **Heat Map Layer**: Visualize crime density patterns across the city
- **Filtering**: Filter by crime type and severity level
- **Responsive Design**: Works on desktop and mobile devices

## Data Source

Crime data is sourced from the [Boise Police Department Open Data Portal](https://city-of-boise.opendata.arcgis.com/datasets/boise::bpd-crimes/), updated daily. The dataset includes:

- Rolling 5-6 year crime history
- Charge-level records with crime codes, severity, and patrol areas
- Locations generalized to block-level for privacy

## Live Demo

View the live dashboard: [https://bkrouse.github.io/boise-crime-map](https://bkrouse.github.io/boise-crime-map)

## Technologies

- [Mapbox GL JS](https://www.mapbox.com/mapbox-gljs) - Interactive WebGL maps
- [Turf.js](https://turfjs.org/) - Geospatial analysis
- [ArcGIS REST API](https://developers.arcgis.com/rest/) - Crime data source
- Vanilla JavaScript (no framework dependencies)

## Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/bkrouse/boise-crime-map.git
   cd boise-crime-map
   ```

2. Serve locally (any static file server works):
   ```bash
   python -m http.server 8000
   # or
   npx serve
   ```

3. Open `http://localhost:8000` in your browser

## Customization

To use your own Mapbox token (recommended for production):

1. Create a free account at [mapbox.com](https://www.mapbox.com/)
2. Generate an access token
3. Replace the `mapboxToken` in `app.js`:
   ```javascript
   mapboxToken: 'your-token-here'
   ```

## License

MIT License - feel free to use and modify for your own projects.

## Credits

- Data: [City of Boise GIS](https://city-of-boise.opendata.arcgis.com/)
- Inspired by [VisQuill](https://visquill.com/)
