-- Faz 4 - PostGIS Radius Sorgu Katmani (Spec 8.1 + 8.11.5)
-- Bu SQL, Prisma migration sonrasi idempotent sekilde calistirilir.
-- "events" ve "communities" tablolarina geography(Point,4326) kolonu + GiST
-- indeks eklenir. Radius sorgulari ST_DWithin ile yapilir.
-- Idempotent: IF NOT EXISTS / IF EXISTS blocklari kullanilir.

-- 1) PostGIS extension (Faz 1'de postgresqlExtensions preview ile tanimlanmisti).
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2) events.meeting_point_geo (geography Point SRID 4326)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'meeting_point_geo'
  ) THEN
    ALTER TABLE events ADD COLUMN meeting_point_geo geography(Point, 4326);
  END IF;
END $$;

-- Mevcut kayitlardaki lat/lng -> geography kolonuna doldur
UPDATE events
SET meeting_point_geo = ST_SetSRID(ST_MakePoint(meeting_point_lng, meeting_point_lat), 4326)::geography
WHERE meeting_point_geo IS NULL AND meeting_point_lat IS NOT NULL AND meeting_point_lng IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_meeting_point_geo
  ON events USING GIST (meeting_point_geo);

-- Trigger: insert/update'te meeting_point_geo otomatik dolsun.
CREATE OR REPLACE FUNCTION sync_event_geo() RETURNS trigger AS $$
BEGIN
  IF NEW.meeting_point_lat IS NOT NULL AND NEW.meeting_point_lng IS NOT NULL THEN
    NEW.meeting_point_geo := ST_SetSRID(
      ST_MakePoint(NEW.meeting_point_lng, NEW.meeting_point_lat), 4326
    )::geography;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_event_geo ON events;
CREATE TRIGGER trg_sync_event_geo
  BEFORE INSERT OR UPDATE OF meeting_point_lat, meeting_point_lng
  ON events FOR EACH ROW EXECUTE FUNCTION sync_event_geo();

-- 3) communities.location_geo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'communities' AND column_name = 'location_geo'
  ) THEN
    ALTER TABLE communities ADD COLUMN location_geo geography(Point, 4326);
  END IF;
END $$;

UPDATE communities
SET location_geo = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE location_geo IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_communities_location_geo
  ON communities USING GIST (location_geo);

CREATE OR REPLACE FUNCTION sync_community_geo() RETURNS trigger AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location_geo := ST_SetSRID(
      ST_MakePoint(NEW.longitude, NEW.latitude), 4326
    )::geography;
  ELSE
    NEW.location_geo := NULL;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_community_geo ON communities;
CREATE TRIGGER trg_sync_community_geo
  BEFORE INSERT OR UPDATE OF latitude, longitude
  ON communities FOR EACH ROW EXECUTE FUNCTION sync_community_geo();

-- 4) Yardimci fonksiyonlar: nearby radius sorgulari icin
-- Kullanim: SELECT * FROM find_events_within(41.0, 29.0, 25000);
CREATE OR REPLACE FUNCTION find_events_within(
  p_lat double precision,
  p_lng double precision,
  p_radius_meters double precision
) RETURNS TABLE (event_id text, distance_m double precision) AS $$
  SELECT e.id, ST_Distance(
    e.meeting_point_geo,
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
  )::double precision AS distance_m
  FROM events e
  WHERE e.deleted_at IS NULL
    AND e.visibility = 'PUBLIC'
    AND e.meeting_point_geo IS NOT NULL
    AND ST_DWithin(
      e.meeting_point_geo,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_meters
    )
  ORDER BY distance_m ASC;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION find_communities_within(
  p_lat double precision,
  p_lng double precision,
  p_radius_meters double precision
) RETURNS TABLE (community_id text, distance_m double precision) AS $$
  SELECT c.id, ST_Distance(
    c.location_geo,
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
  )::double precision AS distance_m
  FROM communities c
  WHERE c.deleted_at IS NULL
    AND c.visibility = 'PUBLIC'
    AND c.location_geo IS NOT NULL
    AND ST_DWithin(
      c.location_geo,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_meters
    )
  ORDER BY distance_m ASC;
$$ LANGUAGE sql STABLE;
