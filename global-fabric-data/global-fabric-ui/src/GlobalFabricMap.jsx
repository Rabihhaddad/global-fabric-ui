import React, { useState, useRef } from 'react';
import Map, { Source, Layer, Popup } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// --- STYLES ---
const cableLayerStyle = { id: 'cables-layer', type: 'line', paint: { 'line-color': '#00aaff', 'line-width': 2, 'line-opacity': 0.6 }};
const cableLabelStyle = { id: 'cable-labels', type: 'symbol', layout: { 'text-field': ['get', 'name'], 'symbol-placement': 'line', 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], 'text-size': 14, 'text-letter-spacing': 0.1, 'text-transform': 'uppercase', 'text-max-angle': 30, 'text-padding': 30 }, paint: { 'text-color': '#00eaff', 'text-halo-color': '#000', 'text-halo-width': 2 }};
const nodeLayerStyle = (id, color) => ({ id: id, type: 'circle', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 3, 10, 8], 'circle-color': color, 'circle-stroke-width': 1, 'circle-stroke-color': '#ffffff', 'circle-opacity': 0.9 }});

const REGIONS = [
  { id: 'africa', color: '#aa00ff', file: '/africa_fabric_nodes.geojson' },
  { id: 'na',     color: '#ff0055', file: '/na_fabric_nodes.geojson' },
  { id: 'europe', color: '#ffcc00', file: '/europe_fabric_nodes.geojson' },
  { id: 'asia',   color: '#00ff66', file: '/asia_fabric_nodes.geojson' },
  { id: 'latam',  color: '#ff6600', file: '/latam_fabric_nodes.geojson' }
];

export default function GlobalFabricMap() {
  const [selectedNode, setSelectedNode] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const mapRef = useRef(null);

  // --- DYNAMIC FILTER STATE ---
  const [filterISP, setFilterISP] = useState('');
  const [filterCloud, setFilterCloud] = useState('');
  const [filterIX, setFilterIX] = useState('');

  const interactiveLayerIds = REGIONS.map(region => `layer-${region.id}`);

  // --- MAPBOX DYNAMIC GPU FILTER ---
  // Start with a base condition that is always true to prevent initial-load ghosting
  const activeFilters = ['all', ['has', 'name']];
  
  if (filterISP.trim() !== '') {
    activeFilters.push(['!=', ['index-of', filterISP, ['get', 'isps']], -1]);
  }
  if (filterCloud.trim() !== '') {
    activeFilters.push(['!=', ['index-of', filterCloud, ['get', 'cloud_providers']], -1]);
  }
  if (filterIX.trim() !== '') {
    activeFilters.push(['!=', ['index-of', filterIX, ['get', 'ixs']], -1]);
  }

  // We no longer use undefined. We always pass the activeFilters array.

  const currentFilter = activeFilters.length > 1 ? activeFilters : undefined;

  const onMapClick = (event) => {
    const feature = event.features && event.features[0];
    if (feature) {
      setSelectedNode({
        longitude: event.lngLat.lng,
        latitude: event.lngLat.lat,
        properties: feature.properties
      });
    } else {
      setSelectedNode(null);
    }
  };

  const handleSearch = async (e) => {
    if (e.key === 'Enter' && searchQuery.trim() !== '') {
      try {
        const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?access_token=${MAPBOX_TOKEN}`);
        const data = await response.json();
        if (data.features && data.features.length > 0) {
          const [lng, lat] = data.features[0].center;
          mapRef.current?.flyTo({ center: [lng, lat], zoom: 10, duration: 3000, essential: true });
          setSearchQuery(''); 
        } else {
          alert("Location not found.");
        }
      } catch (error) {
        console.error("Geocoding failed:", error);
      }
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      
      {/* --- HUD & CONTROL PANEL --- */}
      <div style={{
        position: 'absolute', top: 20, left: 20, zIndex: 1,
        background: 'rgba(0, 0, 0, 0.85)', color: '#00ffcc',
        padding: '16px', fontFamily: 'monospace',
        border: '1px solid #00ffcc', borderRadius: '8px',
        fontSize: '14px', boxShadow: '0 4px 15px rgba(0, 255, 204, 0.2)',
        width: '320px', backdropFilter: 'blur(4px)'
      }}>
        <div style={{ pointerEvents: 'none', marginBottom: '12px' }}>
          <strong>SYSTEM: FABRIC.PACKETROBASN.COM</strong> <br/>
          <span style={{ fontSize: '11px', color: '#aaa' }}>NODES VERIFIED: 4,916</span>
        </div>
        
        {/* Global Location Search */}
        <input 
          type="text" 
          placeholder="FLY TO CITY OR ADDRESS..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleSearch}
          style={{
            width: '100%', padding: '8px', marginBottom: '16px',
            background: 'rgba(0, 255, 204, 0.1)', border: '1px solid #00ffcc',
            color: '#fff', fontFamily: 'monospace', borderRadius: '4px',
            outline: 'none', boxSizing: 'border-box'
          }}
        />

        {/* Dynamic Telemetry Filters */}
        <div style={{ fontSize: '12px', color: '#fff', borderTop: '1px solid #333', paddingTop: '12px' }}>
          <strong style={{ display: 'block', marginBottom: '12px', color: '#00aaff' }}>TELEMETRY FILTERS (CASE SENSITIVE)</strong>
          
          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'block', marginBottom: '4px', color: '#aaa', fontSize: '10px' }}>FILTER BY ISP PRESENCE</label>
            <input 
              type="text" 
              placeholder="e.g., Lumen, Zayo, Telia" 
              value={filterISP}
              onChange={(e) => setFilterISP(e.target.value)}
              style={{ width: '100%', padding: '6px', background: '#111', border: '1px solid #444', color: '#00ffcc', fontFamily: 'monospace', borderRadius: '4px', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'block', marginBottom: '4px', color: '#aaa', fontSize: '10px' }}>FILTER BY CLOUD ON-RAMP</label>
            <input 
              type="text" 
              placeholder="e.g., AWS, Azure, Google" 
              value={filterCloud}
              onChange={(e) => setFilterCloud(e.target.value)}
              style={{ width: '100%', padding: '6px', background: '#111', border: '1px solid #444', color: '#00ffcc', fontFamily: 'monospace', borderRadius: '4px', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', color: '#aaa', fontSize: '10px' }}>FILTER BY PEERING EXCHANGE (IX)</label>
            <input 
              type="text" 
              placeholder="e.g., DE-CIX, Equinix IX" 
              value={filterIX}
              onChange={(e) => setFilterIX(e.target.value)}
              style={{ width: '100%', padding: '6px', background: '#111', border: '1px solid #444', color: '#00ffcc', fontFamily: 'monospace', borderRadius: '4px', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        </div>
      </div>

      {/* --- MAPBOX ENGINE --- */}
      <Map
        ref={mapRef}
        initialViewState={{ longitude: 17.5, latitude: 1.5, zoom: 2.5 }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        mapboxAccessToken={MAPBOX_TOKEN}
        projection="globe"
        onClick={onMapClick}
        interactiveLayerIds={interactiveLayerIds}
        cursor={selectedNode ? 'pointer' : 'crosshair'}
      >
        <Source id="submarine-cables" type="geojson" data="/global_submarine_cables.geojson">
          <Layer {...cableLayerStyle} />
          <Layer {...cableLabelStyle} />
        </Source>

        {REGIONS.map((region) => (
          <Source key={region.id} id={`src-${region.id}`} type="geojson" data={region.file}>
            <Layer filter={currentFilter} {...nodeLayerStyle(`layer-${region.id}`, region.color)} />
          </Source>
        ))}

        {selectedNode && (
          <Popup longitude={selectedNode.longitude} latitude={selectedNode.latitude} anchor="bottom" onClose={() => setSelectedNode(null)} closeOnClick={false} maxWidth="300px">
            <div style={{ color: '#333', fontFamily: 'sans-serif', fontSize: '12px', padding: '5px' }}>
              <h3 style={{ margin: '0 0 8px 0', borderBottom: '1px solid #ccc', paddingBottom: '4px', fontSize: '14px', color: '#000' }}>
                {selectedNode.properties.name || 'Unknown Facility'}
              </h3>
              <p style={{ margin: '4px 0' }}><strong>Address:</strong> {selectedNode.properties.address}</p>
              <p style={{ margin: '4px 0' }}><strong>ISPs:</strong> {selectedNode.properties.isps}</p>
              <p style={{ margin: '4px 0' }}><strong>IXs:</strong> {selectedNode.properties.ixs}</p>
              <p style={{ margin: '4px 0' }}><strong>Cloud Providers:</strong> {selectedNode.properties.cloud_providers}</p>
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}
