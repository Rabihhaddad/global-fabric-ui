"use client";

import React, { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';

export default function Dashboard() {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<any>(null);
    const [facilities, setFacilities] = useState<any[]>([]);
    const [filteredFacilities, setFilteredFacilities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Filter States
    const [searchTerm, setSearchTerm] = useState("");
    const [cloudFilter, setCloudFilter] = useState("All");

    // 1. Fetch Global Data
    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}`);
                const result = await response.json();
                
                const validData = (result.data || []).filter((item: any) => {
                    if (!item?.Coordinates?.Lat || !item?.Coordinates?.Lon) return false;
                    const lat = parseFloat(item.Coordinates.Lat);
                    const lon = parseFloat(item.Coordinates.Lon);
                    return !isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
                });
                
                validData.sort((a: any, b: any) => (a.Operator || '').localeCompare(b.Operator || ''));
                
                setFacilities(validData);
                setFilteredFacilities(validData);
                setLoading(false);
            } catch (error) {
                console.error("Error fetching data:", error);
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // 2. Multi-Layer Filtering Logic
    useEffect(() => {
        const lowercasedSearch = searchTerm.toLowerCase();
        
        const filteredData = facilities.filter(item => {
            // Text Search Match
            const searchMatch = (item.Operator || '').toLowerCase().includes(lowercasedSearch) ||
                                (item.FacilityName || '').toLowerCase().includes(lowercasedSearch);
            
            // Cloud On-Ramp Match
            let cloudMatch = true;
            if (cloudFilter !== "All") {
                const clouds = item.Clouds || [];
                cloudMatch = clouds.some((c: string) => c.toLowerCase().includes(cloudFilter.toLowerCase()));
            }

            return searchMatch && cloudMatch;
        });
        
        setFilteredFacilities(filteredData);
    }, [searchTerm, cloudFilter, facilities]);

    // 3. Initialize Global Map
    useEffect(() => {
        if (typeof window === 'undefined' || !mapContainer.current || loading) return;
        const L = require('leaflet');

        if (map.current) return;

        map.current = L.map(mapContainer.current, { preferCanvas: true }).setView([20, 0], 2);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap &copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map.current);

        return () => {
            if (map.current) {
                map.current.remove();
                map.current = null;
            }
        };
    }, [loading]);

    // 4. Draw Pins
    useEffect(() => {
        if (!map.current || typeof window === 'undefined') return;
        const L = require('leaflet');

        map.current.eachLayer((layer: any) => {
            if (layer instanceof L.CircleMarker) {
                map.current.removeLayer(layer);
            }
        });

        filteredFacilities.forEach((facility) => {
            const lat = parseFloat(facility.Coordinates.Lat);
            const lon = parseFloat(facility.Coordinates.Lon);

            const cloudsHTML = (facility.Clouds && facility.Clouds.length > 0) 
                ? facility.Clouds.map((c: string) => `<span style="background:#003300; border:1px solid #00ff00; padding:2px 6px; border-radius:4px; margin:2px; display:inline-block; font-size:10px;">${c}</span>`).join('') 
                : `<span style="color:#555; font-size:10px;">None</span>`;

            const ispsHTML = (facility.ISPs && facility.ISPs.length > 0)
                ? facility.ISPs.slice(0, 5).map((isp: string) => `<span style="background:#111; border:1px solid #444; padding:2px 6px; border-radius:4px; margin:2px; display:inline-block; font-size:10px;">${isp}</span>`).join('') + (facility.ISPs.length > 5 ? `<span style="color:#888; font-size:10px;"> +${facility.ISPs.length - 5} more...</span>` : '')
                : `<span style="color:#555; font-size:10px;">None</span>`;

            const popupContent = `
                <div style="color: #e0e0e0; padding: 5px; font-family: monospace; min-width: 250px;">
                    <h3 style="margin: 0 0 5px 0; font-size: 16px; color: #00ff00;">${facility.Operator || 'Unknown'}</h3>
                    <div style="font-size: 12px; margin-bottom: 10px; border-bottom: 1px solid #333; padding-bottom: 10px;">
                        <strong>${facility.FacilityName || facility.FacilityCode || 'N/A'}</strong>
                    </div>
                    <div style="margin-bottom: 8px;">
                        <div style="font-size: 10px; color: #88ff88; margin-bottom: 3px;">☁️ CLOUD ON-RAMPS</div>
                        <div>${cloudsHTML}</div>
                    </div>
                    <div>
                        <div style="font-size: 10px; color: #88ff88; margin-bottom: 3px;">🌐 MAJOR NETWORKS</div>
                        <div>${ispsHTML}</div>
                    </div>
                </div>
            `;

            L.circleMarker([lat, lon], {
                radius: 4,
                fillColor: "#00ff00",
                color: "#002200",
                weight: 1,
                opacity: 1,
                fillOpacity: 0.6
            })
            .bindPopup(popupContent, { maxWidth: 300, className: 'custom-dark-popup' })
            .addTo(map.current);
        });
    }, [filteredFacilities]);

    const flyToFacility = (lat: number, lon: number) => {
        if (map.current) {
            map.current.flyTo([lat, lon], 14, { duration: 1.5 });
        }
    };

    return (
        <div className="dashboard-container" style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#0a0a0a', color: '#00ff00', fontFamily: 'monospace' }}>
            
            {/* LEFT SIDEBAR */}
            <div className="sidebar" style={{ width: '350px', display: 'flex', flexDirection: 'column', borderRight: '1px solid #00ff00', zIndex: 10, backgroundColor: '#000' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid #00ff00' }}>
                    <h1 style={{ fontSize: '18px', margin: '0 0 5px 0' }}>GLOBAL FABRIC</h1>
                    <p style={{ margin: '0 0 15px 0', color: '#88ff88', fontSize: '12px' }}>Total Nodes: {loading ? '...' : filteredFacilities.length}</p>
                    
                    {/* Search Bar */}
                    <input 
                        type="text" 
                        placeholder="Search Operator or Facility..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: '100%', padding: '10px', backgroundColor: '#111', color: '#00ff00', border: '1px solid #00ff00', outline: 'none', marginBottom: '10px' }}
                    />

                    {/* Cloud Filter Dropdown */}
                    <select 
                        value={cloudFilter} 
                        onChange={(e) => setCloudFilter(e.target.value)}
                        style={{ width: '100%', padding: '10px', backgroundColor: '#111', color: '#00ff00', border: '1px solid #00ff00', outline: 'none', cursor: 'pointer' }}
                    >
                        <option value="All">All Cloud Ramps</option>
                        <option value="AWS">AWS Direct Connect</option>
                        <option value="Azure">Azure ExpressRoute</option>
                        <option value="Google">Google Cloud Interconnect</option>
                        <option value="Oracle">Oracle FastConnect</option>
                        <option value="IBM">IBM Cloud Direct Link</option>
                    </select>
                </div>
                
                <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
                    {loading ? (
                        <div style={{ padding: '20px', textAlign: 'center' }} className="animate-pulse">Extracting Global Data...</div>
                    ) : (
                        filteredFacilities.slice(0, 100).map((f, i) => ( // Show top 100 in sidebar to prevent DOM lag
                            <div 
                                key={i} 
                                onClick={() => flyToFacility(parseFloat(f.Coordinates.Lat), parseFloat(f.Coordinates.Lon))}
                                style={{ padding: '15px', marginBottom: '10px', backgroundColor: '#050505', border: '1px solid #003300', cursor: 'pointer', transition: 'all 0.2s' }}
                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#002200'}
                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#050505'}
                            >
                                <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{f.Operator || 'Unknown'}</div>
                                <div style={{ fontSize: '11px', color: '#88ff88', marginTop: '5px' }}>{f.FacilityName || f.FacilityCode || 'N/A'}</div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* RIGHT MAP AREA */}
            <div className="map-area" style={{ flex: 1, position: 'relative' }}>
                <div ref={mapContainer} style={{ width: '100%', height: '100%', zIndex: 1 }} />
            </div>

            {/* Global CSS for Mobile Responsiveness & Dark Popups */}
            <style jsx global>{`
                .leaflet-popup-content-wrapper, .leaflet-popup-tip {
                    background: #111 !important;
                    color: #fff !important;
                    border: 1px solid #333;
                }
                .leaflet-container a.leaflet-popup-close-button { color: #00ff00 !important; }
                
                /* Mobile Layout Switch */
                @media (max-width: 768px) {
                    .dashboard-container { flex-direction: column !important; }
                    .sidebar { width: 100% !important; height: 50vh !important; border-right: none !important; border-bottom: 2px solid #00ff00 !important; }
                    .map-area { height: 50vh !important; }
                }
            `}</style>
        </div>
    );
}
