import React from 'react';

/**
 * Carte interactive simplifiée de l'Algérie
 * Affiche les wilayas avec leurs clusters
 */
const AlgeriaMap = ({ wilayas = [], clusters = [], selectedWilaya, onWilayaClick }) => {
  // Limites géographiques de l'Algérie
  const bounds = {
    minLat: 18.5,
    maxLat: 37.5,
    minLon: -9,
    maxLon: 12
  };

  const width = 600;
  const height = 500;
  const padding = 20;

  // Couleurs des clusters
  const clusterColors = [
    '#006233', // Vert Algérie
    '#D21034', // Rouge Algérie
    '#3B82F6', // Bleu
    '#F59E0B', // Orange
    '#8B5CF6', // Violet
    '#10B981', // Émeraude
    '#EC4899', // Rose
    '#6366F1', // Indigo
  ];

  // Convertir les coordonnées GPS en coordonnées SVG
  const toSvgCoords = (lat, lon) => {
    const x = padding + ((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * (width - 2 * padding);
    const y = height - padding - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * (height - 2 * padding);
    return { x, y };
  };

  // Trouver le cluster d'une wilaya
  const getWilayaCluster = (wilayaName) => {
    for (let i = 0; i < clusters.length; i++) {
      if (clusters[i].wilayas_covered?.includes(wilayaName)) {
        return i;
      }
    }
    return 0;
  };

  // Vérifier si c'est un hub
  const isHub = (wilayaName) => {
    return clusters.some(c => c.hub_name === wilayaName);
  };

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto bg-slate-50 rounded-lg">
        {/* Fond de carte simplifié */}
        <defs>
          <linearGradient id="mapGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f1f5f9" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>
        </defs>

        {/* Contour réaliste de l'Algérie basé sur les vraies coordonnées GPS */}
        <path
          d={(() => {
            // Coordonnées GPS réelles des frontières de l'Algérie
            const algeriaCoords = [
              // Côte méditerranéenne (Nord)
              [-1.85, 35.09], [-1.20, 35.08], [-0.52, 35.34], [0.05, 35.90],
              [0.90, 36.45], [1.35, 36.57], [2.20, 36.80], [3.06, 36.75],
              [3.90, 36.90], [4.85, 36.90], [5.50, 36.95], [6.60, 37.10],
              [7.50, 37.08], [8.20, 36.95], [8.60, 36.94],
              // Frontière Tunisie
              [8.25, 36.50], [8.40, 35.20], [8.30, 34.65], [8.20, 33.20],
              [9.05, 32.10], [9.55, 30.10], [9.90, 29.20], [9.40, 28.05],
              // Frontière Libye
              [9.40, 26.50], [9.85, 25.00], [9.40, 24.20], [10.00, 23.00],
              [11.50, 23.50], [11.98, 23.52],
              // Frontière Niger
              [11.98, 22.00], [8.70, 21.10], [7.50, 20.80], [5.80, 19.45],
              [4.25, 19.15], [3.20, 19.82], [1.80, 20.35], [0.95, 21.45],
              // Frontière Mali
              [-0.05, 21.85], [-1.20, 22.75], [-1.95, 23.15], [-4.85, 24.68],
              // Frontière Mauritanie/Sahara
              [-5.65, 25.95], [-8.68, 27.29], [-8.68, 27.67],
              // Frontière Maroc
              [-8.68, 28.72], [-7.10, 29.50], [-5.15, 29.80], [-3.65, 29.55],
              [-2.95, 29.95], [-2.20, 30.25], [-1.30, 32.10], [-1.70, 33.20],
              [-1.22, 34.08], [-1.85, 34.65], [-1.85, 35.09]
            ];
            const points = algeriaCoords.map(([lon, lat]) => {
              const coords = toSvgCoords(lat, lon);
              return `${coords.x},${coords.y}`;
            });
            return `M ${points.join(' L ')} Z`;
          })()}
          fill="url(#mapGradient)"
          stroke="#64748b"
          strokeWidth="2"
        />

        {/* Côte méditerranéenne (bleue) */}
        <path
          d={(() => {
            const coastCoords = [
              [-1.85, 35.09], [-1.20, 35.08], [-0.52, 35.34], [0.05, 35.90],
              [0.90, 36.45], [1.35, 36.57], [2.20, 36.80], [3.06, 36.75],
              [3.90, 36.90], [4.85, 36.90], [5.50, 36.95], [6.60, 37.10],
              [7.50, 37.08], [8.20, 36.95], [8.60, 36.94]
            ];
            const points = coastCoords.map(([lon, lat]) => {
              const coords = toSvgCoords(lat, lon);
              return `${coords.x},${coords.y}`;
            });
            return `M ${points.join(' L ')}`;
          })()}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Lignes de connexion entre hubs et wilayas du cluster */}
        {clusters.map((cluster, clusterIdx) => {
          const hubWilaya = wilayas.find(w => w.name === cluster.hub_name);
          if (!hubWilaya) return null;

          const hubCoords = toSvgCoords(hubWilaya.latitude, hubWilaya.longitude);

          return cluster.wilayas_covered?.map(wilayaName => {
            if (wilayaName === cluster.hub_name) return null;
            const wilaya = wilayas.find(w => w.name === wilayaName);
            if (!wilaya) return null;

            const coords = toSvgCoords(wilaya.latitude, wilaya.longitude);
            return (
              <line
                key={`${cluster.hub_name}-${wilayaName}`}
                x1={hubCoords.x}
                y1={hubCoords.y}
                x2={coords.x}
                y2={coords.y}
                stroke={clusterColors[clusterIdx % clusterColors.length]}
                strokeWidth="1"
                strokeOpacity="0.2"
              />
            );
          });
        })}

        {/* Points des wilayas */}
        {wilayas.map((wilaya) => {
          const coords = toSvgCoords(wilaya.latitude, wilaya.longitude);
          const clusterIdx = getWilayaCluster(wilaya.name);
          const isHubCity = isHub(wilaya.name);
          const isSelected = selectedWilaya === wilaya.name;

          return (
            <g key={wilaya.name}>
              {/* Cercle du point */}
              <circle
                cx={coords.x}
                cy={coords.y}
                r={isHubCity ? 12 : 6}
                fill={clusterColors[clusterIdx % clusterColors.length]}
                stroke={isSelected ? '#000' : '#fff'}
                strokeWidth={isSelected ? 3 : 2}
                className="wilaya-point cursor-pointer"
                onClick={() => onWilayaClick?.(wilaya)}
              />

              {/* Icône pour les hubs */}
              {isHubCity && (
                <text
                  x={coords.x}
                  y={coords.y + 4}
                  textAnchor="middle"
                  fill="white"
                  fontSize="10"
                  fontWeight="bold"
                >
                  H
                </text>
              )}

              {/* Label pour les grandes villes */}
              {(isHubCity || wilaya.demand_tonnes > 1500) && (
                <text
                  x={coords.x}
                  y={coords.y - 15}
                  textAnchor="middle"
                  fill="#374151"
                  fontSize="10"
                  fontWeight={isHubCity ? 'bold' : 'normal'}
                >
                  {wilaya.name}
                </text>
              )}
            </g>
          );
        })}

        {/* Légende des zones */}
        <g transform="translate(20, 20)">
          <rect width="120" height="80" fill="white" rx="8" opacity="0.9" />
          <text x="10" y="20" fontSize="11" fontWeight="bold" fill="#374151">Zones:</text>

          <circle cx="20" cy="35" r="5" fill="#006233" />
          <text x="30" y="38" fontSize="10" fill="#6b7280">Nord</text>

          <circle cx="20" cy="50" r="5" fill="#F59E0B" />
          <text x="30" y="53" fontSize="10" fill="#6b7280">Hauts-Plateaux</text>

          <circle cx="20" cy="65" r="5" fill="#D21034" />
          <text x="30" y="68" fontSize="10" fill="#6b7280">Sud (Sahara)</text>
        </g>

        {/* Légende Hubs */}
        <g transform={`translate(${width - 100}, 20)`}>
          <rect width="90" height="45" fill="white" rx="8" opacity="0.9" />
          <circle cx="20" cy="20" r="10" fill="#3B82F6" stroke="#fff" strokeWidth="2" />
          <text x="20" y="24" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">H</text>
          <text x="40" y="24" fontSize="10" fill="#374151">Hub Régional</text>
        </g>
      </svg>
    </div>
  );
};

export default AlgeriaMap;
