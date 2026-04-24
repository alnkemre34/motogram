// Dynamic Expo config: wires EAS/CI Mapbox *download* token into the config plugin
// (gradle.properties MAPBOX_DOWNLOADS_TOKEN). The plugin ignores empty/missing values.
// Set: eas secret:create --scope project --name RNMAPBOX_MAPS_DOWNLOAD_TOKEN --value "..."
// Optional fallback: MAPBOX_DOWNLOADS_TOKEN.
module.exports = ({ config }) => {
  const downloadToken =
    process.env.RNMAPBOX_MAPS_DOWNLOAD_TOKEN ||
    process.env.MAPBOX_DOWNLOADS_TOKEN;

  const nextPlugins = (config.plugins || []).map((p) => {
    if (Array.isArray(p) && p[0] === '@rnmapbox/maps/app.plugin.js') {
      const options = p[1] && typeof p[1] === 'object' ? p[1] : {};
      return [
        p[0],
        {
          ...options,
          ...(downloadToken
            ? { RNMapboxMapsDownloadToken: downloadToken }
            : {}),
        },
      ];
    }
    return p;
  });

  return { ...config, plugins: nextPlugins };
};
