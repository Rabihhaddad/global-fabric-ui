import React, { useState } from 'react';
import Map, { Source, Layer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = pk.eyJ1Ijoicm9iaDg2IiwiYSI6ImNtbmpuMmtzMjBwMjAyc29nZDhtMzZiNTIifQ.MqVA0FxvkGJeUyl0J-dgyA;

// --- LAYER STYLING DEFINITIONS ---
const cableLayerStyle = {
  id: 'cables',
  type: 'line',
  paint: { 'line-color': '#00aaff', 'line-width': 1.5, 'line-opacity': 0.5 }
};

const nodeLayerStyle = (id, color) => ({
  id: id,
  type: 'circle',
  paint: { 'circle-radius': 4, 'circle-color': color, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' }
});

export default function GlobalFabricMap() {
  // 1. State to control which layers are visible
  const [activeLayers, setActiveLayers] = useState({
    cables: true,
    na: true,
    latam: false,
    europe: false,
    africa: false,
    asia: false
  });

  // Toggle function
  const toggleLayer = (layerName) => {
    setActiveLayers(prev => ({ ...prev, [layerName]: !prev[layerName] }));
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#111', position: 'relative' }}>
      
      {/* 2. Floating Control Panel */}
      <div style={{
        position: 'absolute', top: 20, left: 20, zIndex: 1,
        background: 'rgba(15, 15, 20, 0.9)', color: '#00ffcc',
        padding: '20px', fontFamily: 'monospace',
        border: '1px solid #00ffcc', borderRadius: '4px',
        display: 'flex', flexDirection: 'column', gap: '10px'
      }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>FABRIC CONTROL</h3>
        
        {Object.keys(activeLayers).map((layer) => (
          <label key={layer} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={activeLayers[layer]} 
              onChange={() => toggleLayer(layer)}
              style={{ marginRight: '10px' }}
            />
            {layer.toUpperCase()}
          </label>
        ))}
      </div>

      {/* 3. The Map Component */}
      <Map
        initialViewState={{ longitude: -40, latitude: 35, zoom: 2.5 }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        mapboxAccessToken={MAPBOX_TOKEN}
        projection="globe"
        fog={{ color: 'rgb(10, 10, 25)', 'high-color': 'rgb(20, 20, 40)', 'space-color': 'rgb(0, 0, 0)' }}
      >
        {/* Render sources conditionally based on state */}
        {activeLayers.cables && (
          <Source id="src-cables" type="geojson" data="/global_submarine_cables.geojson">
            <Layer {...cableLayerStyle} />
          </Source>
        )}
        {activeLayers.na && (
          <Source id="src-na" type="geojson" data="/na_fabric_nodes.geojson">
            <Layer {...nodeLayerStyle('layer-na', '#ff0055')} />
          </Source>
        )}
        {activeLayers.europe && (
          <Source id="src-eu" type="geojson" data="/europe_fabric_nodes.geojson">
            <Layer {...nodeLayerStyle('layer-eu', '#00ffaa')} />
          </Source>
        )}
        {activeLayers.latam && (
          <Source id="src-latam" type="geojson" data="/latam_fabric_nodes.geojson">
            <Layer {...nodeLayerStyle('layer-latam', '#ffaa00')} />
          </Source>
        )}
        {activeLayers.africa && (
          <Source id="src-africa" type="geojson" data="/africa_fabric_nodes.geojson">
            <Layer {...nodeLayerStyle('layer-africa', '#aa00ff')} />
          </Source>
        )}
        {activeLayers.asia && (
          <Source id="src-asia" type="geojson" data="/asia_fabric_nodes.geojson">
            <Layer {...nodeLayerStyle('layer-asia', '#ffff00')} />
          </Source>
        )}
      </Map>
    </div>
  );
}
