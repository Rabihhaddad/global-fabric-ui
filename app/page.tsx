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
    const [cloudFilter, setCloudFilter] = useState("All");

    // 1. Fetch & Deduplicate (GPS-based)
    useEffect(() => {
        const fetchData = async () => {
            try {
                const cacheBuster = new Date().getTime();
                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}?t=${cacheBuster}`);
                const result = await response.json();
                
                const rawData = result.data || [];
                const uniqueFacilities = new Map();

                rawData.forEach((item: any) => {
                    if (!item?.Coordinates?.Lat || !item?.Coordinates?.Lon) return;
                    
                    const op = (item.Operator || 'Unknown').trim().toLowerCase();
                    const lat = parseFloat(item.Coordinates.Lat).toFixed(3);
                    const lon = parseFloat(item.Coordinates.Lon).toFixed(3);
                    const key = `${op}::${lat},${lon}`;
                    
                    if (!uniqueFacilities.has(key)) {
                        uniqueFacilities.set(key, item);
                    }
                });
                
                const cleanData = Array.from(uniqueFacilities.values());
                cleanData.sort((a: any, b: any) => (a.Operator || '').localeCompare(b.Operator || ''));
                
                setFacilities(cleanData);
                setFilteredFacilities(cleanData);
                setLoading(false);
            } catch (error) {
                console.error("Fetch error:", error);
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // 2. Filter Logic
    useEffect(() => {
        const term = searchTerm.toLowerCase();
        const filtered = facilities.filter(f => {
            const matchesSearch = (f.Operator || '').toLowerCase().includes(term) || 
                                 (f.FacilityName || '').toLowerCase().includes(term);
            const matchesCloud = cloudFilter === "All" || 
                                (f.Clouds || []).some((c: string) => c.toLowerCase().includes(cloudFilter.toLowerCase()));
            return matchesSearch && matchesCloud;
        });
        setFilteredFacilities(filtered);
    }, [searchTerm, cloudFilter, facilities]);

    // 3. Map Init
    useEffect(() => {
        if (typeof window === 'undefined' || !mapContainer.current || loading) return;
        const L = require('leaflet');
        if (map.current) return;

        map.current = L.map(mapContainer.current, { preferCanvas: true }).setView([20, 0], 2);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; CARTO',
            maxZoom: 18
        }).addTo(map.current);

        // 4. Submarine Cables Layer
        fetch('https://raw.githubusercontent.com/telegeography/www.submarinecablemap.com/master/web/public/api/v3/cable/cable-geo.json')
            .then(res => res.json())
            .then(data => {
                L.geoJSON(data, {
                    style: { color: "#00ffff", weight: 1, opacity: 0.2 }
                }).addTo(map.current);
            });
    }, [loading]);

    // 5. Draw Pins & Enhanced Popups
    useEffect(() => {
        if (!map.current || typeof window === 'undefined') return;
        const L = require('leaflet');

        map.current.eachLayer((layer: any) => {
            if (layer instanceof L.CircleMarker) map.current.removeLayer(layer);
        });

        filteredFacilities.forEach((f) => {
            const lat = parseFloat(f.Coordinates.Lat);
            const lon = parseFloat(f.Coordinates.Lon);

            const clouds = (f.Clouds || []).map((c: string) => 
                `<span style="background:#002200; border:1px solid #00ff00; color:#00ff00; padding:2px 5px; border-radius:3px; margin:2px; display:inline-block; font-size:10px;">${c}</span>`
            ).join('') || '<span style="color:#444; font-size:10px;">None</span>';

            const ixps = (f.IXPs || []).map((ix: string) => 
                `<span style="background:#001a33; border:1px solid #0088ff; color:#88ccff; padding:2px 5px; border-radius:3px; margin:2px; display:inline-block; font-size:10px;">${ix}</span>`
            ).join('') || '<span style="color:#444; font-size:10px;">None</span>';

            const popup = `
                <div style="background:#111; color:#eee; font-family:monospace; min-width:200px;">
                    <b style="color:#00ff00; font-size:14px;">${f.Operator}</b><br/>
                    <small style="color:#888;">${f.FacilityName}</small>
                    <hr style="border:0; border-top:1px solid #333; margin:8px 0;"/>
                    <div style="margin-bottom:8px;">
                        <div style="font-size:9px; color:#aaa; text-transform:uppercase;">Cloud On-Ramps</div>
                        ${clouds}
                    </div>
                    <div>
                        <div style="font-size:9px; color:#aaa; text-transform:uppercase;">Internet Exchanges</div>
                        ${ixps}
                    </div>
                </div>
            `;

            L.circleMarker([lat, lon], {
                radius: 4, fillColor: "#00ff00", color: "#000", weight: 1, fillOpacity: 0.7
            }).bindPopup(popup).addTo(map.current);
        });
    }, [filteredFacilities]);

    const fly = (lat: number, lon: number) => {
        map.current?.flyTo([lat, lon], 14);
    };

    return (
        <div style={{ display: 'flex', height: '100vh', background: '#000', color: '#00ff00', fontFamily: 'monospace' }}>
            <div style={{ width: '350px', borderRight: '1px solid #00ff00', display: 'flex', flexDirection: 'column', padding: '20px' }}>
                <h2 style={{ margin: '0 0 10px 0' }}>GLOBAL FABRIC</h2>
                <input 
                    placeholder="Search..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{ background: '#111', border: '1px solid #00ff00', color: '#00ff00', padding: '10px', marginBottom: '10px' }}
                />
                <select 
                    value={cloudFilter} 
                    onChange={e => setCloudFilter(e.target.value)}
                    style={{ background: '#111', border: '1px solid #00ff00', color: '#00ff00', padding: '10px', marginBottom: '20px' }}
                >
                    <option value="All">All Clouds</option>
                    <option value="AWS">AWS</option>
                    <option value="Azure">Azure</option>
                    <option value="Google">Google</option>
                </select>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {filteredFacilities.slice(0, 50).map((f, i) => (
                        <div key={i} onClick={() => fly(f.Coordinates.Lat, f.Coordinates.Lon)} style={{ padding: '10px', borderBottom: '1px solid #222', cursor: 'pointer' }}>
                            <b>{f.Operator}</b><br/><small style={{ color: '#666' }}>{f.FacilityName}</small>
                        </div>
                    ))}
                </div>
            </div>
            <div ref={mapContainer} style={{ flex: 1 }} />
            <style jsx global>{`
                .leaflet-popup-content-wrapper { background: #111 !important; border: 1px solid #333; }
                .leaflet-popup-tip { background: #111 !important; }
            `}</style>
        </div>
    );
}
