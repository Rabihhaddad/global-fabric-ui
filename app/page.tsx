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
    const [filterType, setFilterType] = useState("Clouds"); // Toggles between Clouds, ISPs, and IXPs
    const [filterValue, setFilterValue] = useState("All");

    // 1. Fetch & Hardened GPS Deduplication
    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}?t=${new Date().getTime()}`);
                const result = await response.json();
                
                // SAFETY: Filter out records missing vital GPS data to prevent UI crashes
                const valid = (result.data || []).filter((f: any) => 
                    f.Coordinates && f.Coordinates.Lat && f.Coordinates.Lon
                );

                const unique = new Map();
                valid.forEach((f: any) => {
                    const op = (f.Operator || 'Unknown').toLowerCase();
                    const lat = parseFloat(f.Coordinates.Lat).toFixed(3);
                    const lon = parseFloat(f.Coordinates.Lon).toFixed(3);
                    const key = `${op}::${lat},${lon}`;
                    
                    if (!unique.has(key)) unique.set(key, f);
                });

                const sorted = Array.from(unique.values()).sort((a,b) => (a.Operator || '').localeCompare(b.Operator || ''));
                setFacilities(sorted);
                setFilteredFacilities(sorted);
                setLoading(false);
            } catch (e) { 
                console.error("Data Fetch Error:", e); 
                setLoading(false); 
            }
        };
        fetchData();
    }, []);

    // 2. Fuzzy Multi-Category Filter Logic (The "Cogent Fix")
    useEffect(() => {
        const term = searchTerm.toLowerCase();
        const filtered = facilities.filter(f => {
            const matchesSearch = (f.Operator || '').toLowerCase().includes(term) || 
                                 (f.FacilityName || '').toLowerCase().includes(term);
            
            const categoryData = f[filterType] || [];
            let matchesFilter = filterValue === "All" || categoryData.some((v: string) => 
                v.toLowerCase().includes(filterValue.toLowerCase())
            );

            return matchesSearch && matchesFilter;
        });
        setFilteredFacilities(filtered);
    }, [searchTerm, filterType, filterValue, facilities]);

    // 3. Map Init & High-Visibility Subsea Cables
    useEffect(() => {
        if (typeof window === 'undefined' || !mapContainer.current || loading) return;
        const L = require('leaflet');
        if (!map.current) {
            map.current = L.map(mapContainer.current, { preferCanvas: true }).setView([20, 0], 2);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; CARTO',
                maxZoom: 18
            }).addTo(map.current);
            
            // Draw Submarine Cables with "Glow" styling
            fetch('https://raw.githubusercontent.com/telegeography/www.submarinecablemap.com/master/web/public/api/v3/cable/cable-geo.json')
                .then(r => r.json()).then(d => {
                    L.geoJSON(d, { 
                        style: { 
                            color: "#00ffff", 
                            weight: 2, 
                            opacity: 0.5,
                            lineCap: 'round'
                        }, 
                        interactive: false 
                    }).addTo(map.current);
                }).catch(e => console.error("Cable Layer Error:", e));
        }
    }, [loading]);

    // 4. Enhanced Interactive Popups
    useEffect(() => {
        if (!map.current || typeof window === 'undefined') return;
        const L = require('leaflet');

        map.current.eachLayer((l: any) => { if (l instanceof L.CircleMarker) map.current.removeLayer(l); });
        
        filteredFacilities.forEach(f => {
            const popup = `
                <div style="background:#111; color:#eee; font-family:monospace; min-width:240px;">
                    <b style="color:#00ff00; font-size:14px;">${f.Operator}</b><br/>
                    <small style="color:#888;">${f.FacilityName}</small>
                    <hr style="border:0; border-top:1px solid #333; margin:8px 0;"/>
                    <div style="margin-bottom:8px;">
                        <div style="font-size:9px; color:#aaa; text-transform:uppercase; margin-bottom:4px;">☁️ Cloud On-Ramps</div>
                        ${(f.Clouds||[]).map((c:string) => `<span style="background:#002200; border:1px solid #00ff00; color:#00ff00; padding:1px 4px; border-radius:3px; margin:2px; display:inline-block; font-size:9px;">${c}</span>`).join('') || 'None'}
                    </div>
                    <div style="margin-bottom:8px;">
                        <div style="font-size:9px; color:#00ffff; text-transform:uppercase; margin-bottom:4px;">⚡ Internet Exchanges</div>
                        ${(f.IXPs||[]).map((ix:string) => `<span style="background:#001a33; border:1px solid #0088ff; color:#88ccff; padding:1px 4px; border-radius:3px; margin:2px; display:inline-block; font-size:9px;">${ix}</span>`).join('') || 'None'}
                    </div>
                    <div>
                        <div style="font-size:9px; color:#aaa; text-transform:uppercase; margin-bottom:4px;">Network Connectivity</div>
                        <div style="font-size:10px; color:#ccc;">${(f.ISPs||[]).slice(0,8).join(', ')}${(f.ISPs||[]).length > 8 ? '...' : ''}</div>
                    </div>
                </div>`;

            L.circleMarker([f.Coordinates.Lat, f.Coordinates.Lon], { 
                radius: 4, 
                fillColor: "#00ff00", 
                color: "#000", 
                weight: 1, 
                fillOpacity: 0.7 
            }).bindPopup(popup).addTo(map.current);
        });
    }, [filteredFacilities]);

    return (
        <div style={{ display: 'flex', height: '100vh', background: '#000', color: '#00ff00', fontFamily: 'monospace' }}>
            {/* Sidebar Controls */}
            <div style={{ width: '360px', borderRight: '1px solid #00ff00', display: 'flex', flexDirection: 'column', padding: '20px', zIndex: 10, background: '#000' }}>
                <h2 style={{ margin: 0 }}>GLOBAL FABRIC</h2>
                <div style={{ color: '#88ff88', fontSize: '12px', marginBottom: '20px' }}>ACTIVE NODES: {filteredFacilities.length}</div>
                
                <input 
                    placeholder="Search Operator or Building..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    style={{ background: '#111', border: '1px solid #00ff00', color: '#00ff00', padding: '12px', marginBottom: '10px', outline: 'none' }} 
                />
                
                {/* Category Toggles */}
                <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
                    {['Clouds', 'IXPs', 'ISPs'].map(t => (
                        <button 
                            key={t} 
                            onClick={() => { setFilterType(t); setFilterValue("All"); }} 
                            style={{ flex: 1, background: filterType === t ? '#00ff00' : '#111', color: filterType === t ? '#000' : '#00ff00', border: '1px solid #00ff00', cursor: 'pointer', fontSize: '11px', padding: '10px 0', fontWeight: 'bold' }}
                        >
                            {t}
                        </button>
                    ))}
                </div>

                {/* Sub-Filter Dropdown */}
                <select 
                    value={filterValue} 
                    onChange={e => setFilterValue(e.target.value)} 
                    style={{ background: '#111', border: '1px solid #00ff00', color: '#00ff00', padding: '12px', marginBottom: '20px', outline: 'none', cursor: 'pointer' }}
                >
                    <option value="All">All {filterType}</option>
                    {filterType === 'Clouds' && ['AWS', 'Azure', 'Google', 'Oracle', 'IBM', 'Alibaba'].map(v => <option key={v} value={v}>{v}</option>)}
                    {filterType === 'IXPs' && ['DE-CIX', 'Equinix', 'LINX', 'AMS-IX', 'NAP', 'IX'].map(v => <option key={v} value={v}>{v}</option>)}
                    {filterType === 'ISPs' && ['Cogent', 'Lumen', 'Verizon', 'AT&T', 'Comcast', 'Zayo', 'Colt', 'Orange', 'Tata', 'Telefonica', 'NTT'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>

                {/* Facility List */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {filteredFacilities.slice(0, 100).map((f, i) => (
                        <div 
                            key={i} 
                            onClick={() => map.current?.flyTo([f.Coordinates.Lat, f.Coordinates.Lon], 14)} 
                            style={{ padding: '15px', borderBottom: '1px solid #222', cursor: 'pointer', transition: 'background 0.2s' }}
                            onMouseOver={e => e.currentTarget.style.background = '#002200'}
                            onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <b style={{ fontSize: '14px' }}>{f.Operator}</b><br/>
                            <small style={{ color: '#666', fontSize: '11px' }}>{f.FacilityName}</small>
                        </div>
                    ))}
                </div>
            </div>
            
            {/* Map Area */}
            <div ref={mapContainer} style={{ flex: 1 }} />
            
            <style jsx global>{`
                .leaflet-popup-content-wrapper { background: #111 !important; border: 1px solid #333; color: #fff !important; box-shadow: 0 0 15px rgba(0,255,0,0.2); }
                .leaflet-popup-tip { background: #111 !important; }
                .leaflet-container a.leaflet-popup-close-button { color: #00ff00 !important; }
            `}</style>
        </div>
    );
}
