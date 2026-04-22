// Spec 9.4 - Canli Harita (read-only placeholder).
// Gercek harita icin Mapbox/Leaflet entegrasyonu backend'in /admin/live-map/snapshot
// endpoint'i eklendiginde devreye girecek.
export default function LiveMapPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Canli Harita</h1>
        <p className="text-sm text-textMuted">
          Aktif SOS cagrilari, partiler ve canli konum paylasimi PostGIS GeoJSON uzerinden gerceklenir.
        </p>
      </div>

      <div className="card flex h-[480px] items-center justify-center border-dashed text-center">
        <div>
          <div className="mb-2 text-textMuted">Harita kartografi bileseni</div>
          <div className="text-xs text-textMuted">
            Mapbox GL JS + /admin/live-map/snapshot entegrasyonu v1.1'de aktiflesecek.
          </div>
        </div>
      </div>
    </div>
  );
}
