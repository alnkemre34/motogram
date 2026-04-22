import Supercluster from 'supercluster';
import type { NearbyRider } from '@motogram/shared';

// Spec 2.3.1 - Supercluster ile pin kumeleme (puhre fonksiyon, Jest testlenebilir)

export interface ClusterFeature {
  type: 'Feature';
  id?: number;
  properties: {
    cluster?: boolean;
    cluster_id?: number;
    point_count?: number;
    userId?: string;
  };
  geometry: { type: 'Point'; coordinates: [number, number] };
}

export function buildClusterIndex(riders: NearbyRider[]): Supercluster {
  const index = new Supercluster({ radius: 60, maxZoom: 16, minPoints: 3 });
  const features: ClusterFeature[] = riders.map((r) => ({
    type: 'Feature',
    properties: { cluster: false, userId: r.userId },
    geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
  }));
  index.load(features);
  return index;
}

export function getClusters(
  index: Supercluster,
  bbox: [number, number, number, number],
  zoom: number,
): ClusterFeature[] {
  return index.getClusters(bbox, Math.floor(zoom)) as unknown as ClusterFeature[];
}
