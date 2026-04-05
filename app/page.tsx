"use client";

import React, { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';

export default function Dashboard() {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<any>(null);
    const [facilities, setFacilities] = useState<any[]>([]);
    const [filteredFacilities, setFilteredFacilities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [searchTerm, setSearchTerm] = useState("");
    const [filterType, setFilterType] = useState("Clouds");
    const [filterValue, setFilterValue] = useState("All");

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}?t=${new Date().getTime()}`);
                const result = await response.json();
                
                // HARDENED CHECK: Only allow facilities that actually have Coordinates
                const valid = (result.data || []).filter((f: any) => 
                    f.Coordinates && f.Coordinates.Lat && f.Coordinates.Lon
                );

                const unique = new Map();
                valid.forEach((f: any) => {
                    const key = `${(f.Operator||'').toLowerCase()}::${parseFloat(f.Coordinates.Lat).toFixed(3)}`;
                    if (!unique.has(key)) unique.set(key, f);
                });

                const sorted = Array.from(unique.values()).sort((a,b) => (a.Operator||'').localeCompare(b.Operator||''));
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

    useEffect(() => {
        const term = searchTerm.toLowerCase();
        const filtered = facilities.filter(f => {
            const matchesSearch = (f.Operator || '').toLowerCase().includes(term) || (f.FacilityName || '').toLowerCase().includes(term);
            const categoryData = f[filterType] || [];
            const matchesFilter = filterValue === "All" || categoryData.some((v: string) => v.toLowerCase().includes(filterValue.toLowerCase()));
            return matchesSearch && matchesFilter;
        });
        setFilteredFacilities(filtered);
    }, [searchTerm, filterType, filterValue, facilities]);

    useEffect(() => {
        if (typeof window === 'undefined' || !mapContainer.current || loading) return;
        const L = require('leaflet');
        if (!map.current) {
            map.current = L.map(mapContainer.current, { preferCanvas: true }).setView([20, 0], 2);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map.current);
            
            fetch('https://raw.githubusercontent.com/telegeography/www.submarinecablemap.com/master/web/public/api/v3/cable/cable-geo.json')
                .then(r => r.json()).then(d => {
                    L.geoJSON(d, { style: { color: "#00ffff", weight: 1, opacity: 0.15 }, interactive: false }).addTo(map.current);
                }).catch(e => console.error("Cable Load Error:", e));
        }
    }, [loading]);

    useEffect(() => {
        if (!map.current || typeof window === 'undefined') return;
        const L = require('leaflet');
        map.current.eachLayer((l: any) => { if (l instanceof L.CircleMarker) map.current.removeLayer(l); });
        
        filteredFacilities.forEach(f => {
            // Triple-check coordinates before drawing to prevent crashes
            if (!f.Coordinates?.Lat || !f.Coordinates?.Lon) return;

            const popup = `
                <div style="background:#111; color:#eee; font-family:monospace; min-width:200px;">
                    <b style="color:#00ff00;">${f.Operator}</b><br/><small>${f.FacilityName}</small>
                    <div style="margin-top:8px; font-size:10px;">
                        <span style="color:#00ff00;">☁️</span> ${(f.Clouds||[]).slice(0,3).join(', ') || 'None'}<br/>
                        <span style="color:#0088ff;">⚡</span> ${(f.IXPs||[]).slice(0,3).join(', ') || 'None'}<br/>
                        <span style="color:#888;">🌐</span> ${(f.ISPs||[]).slice(0,2).join(', ')}...
                    </div>
                </div>`;
            L.circleMarker([f.Coordinates.Lat, f.Coordinates.Lon], { radius: 4, fillColor: "#00ff00", color: "#000", weight: 1, fillOpacity: 0.7 }).bindPopup(popup).addTo(map.current);
        });
    }, [filteredFacilities]);

    return (
        <div style={{ display: 'flex', height: '100vh', background: '#000', color: '#00ff00', fontFamily: 'monospace' }}>
            <div style={{ width: '360px', borderRight: '1px solid #00ff00', display: 'flex', flexDirection: 'column', padding: '20px', zIndex: 10, background: '#000' }}>
                <h2 style={{ margin: 0 }}>GLOBAL FABRIC</h2>
                <div style={{ color: '#88ff88', fontSize: '12px', marginBottom: '20px' }}>Active Nodes: {filteredFacilities.length}</div>
                
                <input placeholder="Search Operator..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ background: '#111', border: '1px solid #00ff00', color: '#00ff00', padding: '10px', marginBottom: '10px' }} />
                
                <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
                    {['Clouds', 'IXPs', 'ISPs'].map(t => (
                        <button key={t} onClick={() => { setFilterType(t); setFilterValue("All"); }} style={{ flex: 1, background: filterType === t ? '#00ff00' : '#111', color: filterType === t ? '#000' : '#00ff00', border: '1px solid #00ff00', cursor: 'pointer', fontSize: '10px', padding: '5px' }}>{t}</button>
                    ))}
                </div>

                <select value={filterValue} onChange={e => setFilterValue(e.target.value)} style={{ background: '#111', border: '1px solid #00ff00', color: '#00ff00', padding: '10px', marginBottom: '20px' }}>
                    <option value="All">All {filterType}</option>
                    {filterType === 'Clouds' && ['AWS', 'Azure', 'Google', 'Oracle'].map(v => <option key={v} value={v}>{v}</option>)}
                    {filterType === 'IXPs' && ['DE-CIX', 'Equinix', 'LINX', 'AMS-IX'].map(v => <option key={v} value={v}>{v}</option>)}
                    {filterType === 'ISPs' && ['Cogent', 'Lumen', 'Verizon', 'AT&T', 'Comcast'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {filteredFacilities.slice(0, 100).map((f, i) => (
                        <div key={i} onClick={() => map.current?.flyTo([f.Coordinates.Lat, f.Coordinates.Lon], 14)} style={{ padding: '10px', borderBottom: '1px solid #222', cursor: 'pointer' }}>
                            <b>{f.Operator}</b><br/><small style={{ color: '#666' }}>{f.FacilityName}</small>
                        </div>
                    ))}
                </div>
            </div>
            <div ref={mapContainer} style={{ flex: 1 }} />
            <style jsx global>{`.leaflet-popup-content-wrapper { background: #111 !important; border: 1px solid #333; } .leaflet-popup-tip { background: #111 !important; }`}</style>
        </div>
    );
}
