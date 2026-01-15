import React, { useState } from 'react';

/**
 * Carte interactive réaliste de l'Algérie avec itinéraires OSRM
 * Contour basé sur les vraies coordonnées GPS des frontières
 */
const AlgeriaMapReal = ({
  wilayas = [],
  clusters = [],
  routes = [],
  selectedRoute = null,
  selectedWilaya,
  onWilayaClick,
  showRealRoutes = true
}) => {
  const [hoveredWilaya, setHoveredWilaya] = useState(null);

  // Limites géographiques de l'Algérie
  const bounds = {
    minLat: 18.5,
    maxLat: 37.5,
    minLon: -9,
    maxLon: 12
  };

  const width = 700;
  const height = 580;
  const padding = 30;

  // Couleurs des clusters
  const clusterColors = [
    '#006233', '#D21034', '#3B82F6', '#F59E0B',
    '#8B5CF6', '#10B981', '#EC4899', '#6366F1',
  ];

  // Convertir les coordonnées GPS en coordonnées SVG
  const toSvgCoords = (lat, lon) => {
    const x = padding + ((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * (width - 2 * padding);
    const y = height - padding - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * (height - 2 * padding);
    return { x, y };
  };

  // Coordonnées GPS officielles des frontières de l'Algérie (GeoJSON)
  const algeriaCoords = [
    // Frontière Est (Tunisie/Libye) - du nord au sud
    [8.576562, 36.937207], [8.597656, 36.883887], [8.601270, 36.833936], [8.506738, 36.7875],
    [8.444238, 36.760742], [8.369629, 36.632520], [8.230762, 36.545264], [8.207617, 36.518945],
    [8.208789, 36.495117], [8.302734, 36.455615], [8.333984, 36.418164], [8.348730, 36.367969],
    [8.306738, 36.188770], [8.280273, 36.050977], [8.245703, 35.870557], [8.247070, 35.801807],
    [8.282910, 35.719287], [8.318066, 35.654932], [8.329004, 35.582227], [8.316406, 35.403125],
    [8.359863, 35.299609], [8.394238, 35.203857], [8.312109, 35.084619], [8.276855, 34.979492],
    [8.254688, 34.828955], [8.245605, 34.734082], [8.192773, 34.646289], [8.123438, 34.563916],
    [8.045605, 34.512695], [7.949414, 34.468701], [7.838281, 34.410303], [7.748535, 34.254492],
    [7.554492, 34.125], [7.513867, 34.080518], [7.495605, 33.976514], [7.500195, 33.832471],
    [7.534375, 33.717920], [7.627539, 33.548633], [7.709180, 33.362305], [7.731348, 33.268506],
    [7.762695, 33.233105], [7.877246, 33.172119], [8.075586, 33.089063], [8.1125, 33.055323],
    [8.210938, 32.926709], [8.304199, 32.696289], [8.333398, 32.543604], [8.515137, 32.422314],
    [8.682910, 32.310449], [8.844043, 32.212109], [9.018945, 32.105371], [9.044043, 32.072363],
    [9.102344, 31.846143], [9.160254, 31.621338], [9.224023, 31.373682], [9.287891, 31.125342],
    [9.363281, 30.832910], [9.406055, 30.666797], [9.458008, 30.465381], [9.51875, 30.229395],
    [9.420996, 30.179297], [9.310254, 30.115234], [9.391016, 29.993652], [9.546191, 29.795947],
    [9.640137, 29.636426], [9.672656, 29.566992], [9.745898, 29.368945], [9.805273, 29.176953],
    [9.820703, 29.114795], [9.842578, 28.966992], [9.815625, 28.560205], [9.858203, 28.043311],
    [9.916016, 27.785693], [9.825293, 27.552979], [9.747559, 27.330859], [9.752539, 27.219336],
    [9.795410, 27.044775], [9.837109, 26.915820], [9.894434, 26.847949], [9.883203, 26.630811],
    [9.859375, 26.551953], [9.684961, 26.438232], [9.491406, 26.333740], [9.437891, 26.245508],
    [9.422363, 26.147070], [9.448242, 26.067139], [9.58125, 25.890137], [9.781055, 25.624268],
    [10.000684, 25.332080], [10.019043, 25.258545], [10.028125, 25.051025], [10.119531, 24.790234],
    [10.218652, 24.676221], [10.255859, 24.591016], [10.325781, 24.530225], [10.395898, 24.485596],
    [10.438965, 24.480225], [10.686133, 24.551367], [11.108203, 24.434033], [11.507617, 24.314355],
    [11.536914, 24.290820], [11.624219, 24.139697], [11.766992, 23.892578], [11.873047, 23.694824],
    [11.967871, 23.517871],
    // Frontière Sud (Niger/Mali)
    [11.45, 23.212598], [10.932227, 22.907275], [10.414355, 22.602002], [9.896484, 22.296729],
    [9.378711, 21.991406], [8.860938, 21.686133], [8.343066, 21.380859], [7.825195, 21.075586],
    [7.481738, 20.873096], [7.263379, 20.694482], [6.989355, 20.470508], [6.730664, 20.248047],
    [6.527051, 20.072949], [6.263379, 19.846143], [6.130664, 19.731982], [5.836621, 19.479150],
    [5.748340, 19.434229], [5.358691, 19.359522], [5.001367, 19.291064], [4.671289, 19.227783],
    [4.445703, 19.184522], [4.227637, 19.142773], [3.910156, 19.083740], [3.683496, 19.041602],
    [3.438770, 18.996143], [3.400879, 18.988428], [3.356445, 18.986621], [3.323438, 18.988379],
    [3.255957, 19.013281], [3.174219, 19.072900], [3.119727, 19.103174], [3.106055, 19.150098],
    [3.137891, 19.212158], [3.177246, 19.268164], [3.192383, 19.312061], [3.219629, 19.345410],
    [3.254395, 19.372607], [3.255859, 19.410938], [3.227051, 19.473584], [3.201660, 19.560400],
    [3.202734, 19.718311], [3.203418, 19.770752], [3.203711, 19.789697], [3.130273, 19.850195],
    [2.992480, 19.916602], [2.865723, 19.955957], [2.807910, 19.969434], [2.667773, 19.992920],
    [2.474219, 20.035010], [2.406152, 20.063867], [2.280859, 20.210303], [2.219336, 20.247803],
    [1.928809, 20.272705], [1.832422, 20.296875], [1.753223, 20.331592], [1.685449, 20.378369],
    [1.647363, 20.458838], [1.636035, 20.524365], [1.610645, 20.555566], [1.290234, 20.713574],
    [1.208887, 20.767285], [1.165723, 20.817432], [1.164063, 20.891309], [1.172754, 20.981982],
    [1.159180, 21.0625], [1.145508, 21.102246], [0.999414, 21.197754], [0.671875, 21.411865],
    [0.344434, 21.625977], [0.016992, 21.840137],
    // Frontière Ouest (Mauritanie/Maroc)
    [-0.310547, 22.054199], [-0.637988, 22.268311], [-0.965479, 22.482471], [-1.292969, 22.696533],
    [-1.620410, 22.910645], [-1.947900, 23.124805], [-2.275391, 23.338867], [-2.602930, 23.553027],
    [-2.930371, 23.767139], [-3.257861, 23.98125], [-3.585352, 24.195361], [-3.912793, 24.409473],
    [-4.240332, 24.623535], [-4.516992, 24.804492], [-4.822607, 24.995605], [-5.049512, 25.135449],
    [-5.275, 25.274512], [-5.516943, 25.423779], [-5.674512, 25.516406], [-5.862549, 25.627002],
    [-6.050586, 25.737598], [-6.238672, 25.848193], [-6.426709, 25.958789], [-6.614746, 26.069434],
    [-6.802832, 26.179980], [-6.990869, 26.290576], [-7.178906, 26.401172], [-7.366992, 26.511768],
    [-7.555078, 26.622363], [-7.743115, 26.732959], [-7.931152, 26.843555], [-8.119238, 26.954150],
    [-8.307275, 27.064746], [-8.495313, 27.175342], [-8.683350, 27.285938], [-8.683350, 27.490234],
    [-8.683350, 27.656445], [-8.683350, 27.900391], [-8.683350, 28.112012], [-8.683350, 28.323682],
    [-8.683350, 28.469238], [-8.683350, 28.620752], [-8.678418, 28.689404], [-8.659912, 28.718604],
    [-8.558350, 28.767871], [-8.399316, 28.880176], [-8.340479, 28.930176], [-8.265186, 28.980518],
    [-7.998926, 29.132422], [-7.943848, 29.174756], [-7.685156, 29.349512], [-7.624609, 29.375195],
    [-7.485742, 29.392236], [-7.427686, 29.425], [-7.349756, 29.494727], [-7.234912, 29.574902],
    [-7.160205, 29.612646], [-7.142432, 29.619580], [-7.094922, 29.625195], [-6.855566, 29.601611],
    [-6.755127, 29.583838], [-6.635352, 29.568799], [-6.597754, 29.578955], [-6.565674, 29.603857],
    [-6.520557, 29.659863], [-6.510693, 29.726025], [-6.507910, 29.783789], [-6.500879, 29.809131],
    [-6.479736, 29.820361], [-6.427637, 29.816113], [-6.357617, 29.808301], [-6.214795, 29.810693],
    [-6.166504, 29.818945], [-6.004297, 29.83125], [-5.775, 29.869043], [-5.593311, 29.917969],
    [-5.448779, 29.956934], [-5.293652, 30.058643], [-5.180127, 30.166162], [-5.061914, 30.326416],
    [-4.968262, 30.465381], [-4.778516, 30.552393], [-4.619629, 30.604785], [-4.529150, 30.625537],
    [-4.322852, 30.698877], [-4.148779, 30.809570], [-3.985352, 30.913525], [-3.860059, 30.927246],
    [-3.702002, 30.944482], [-3.666797, 30.964014], [-3.626904, 31.000928], [-3.624512, 31.065771],
    [-3.672510, 31.111377], [-3.730176, 31.135400], [-3.770996, 31.161816], [-3.811816, 31.166602],
    [-3.833398, 31.197803], [-3.821387, 31.255469], [-3.815137, 31.308838], [-3.789160, 31.361816],
    [-3.796436, 31.437109], [-3.837109, 31.512354], [-3.849561, 31.566406], [-3.846680, 31.619873],
    [-3.826758, 31.661914], [-3.768164, 31.689551], [-3.700244, 31.700098], [-3.604590, 31.686768],
    [-3.439795, 31.704541], [-3.017383, 31.834277], [-2.988232, 31.874219], [-2.961133, 31.963965],
    [-2.930859, 32.042529], [-2.887207, 32.068848], [-2.863428, 32.074707], [-2.722607, 32.095752],
    [-2.523242, 32.125684], [-2.448389, 32.129980], [-2.23125, 32.121338], [-2.072803, 32.115039],
    [-1.816992, 32.104785], [-1.635156, 32.099561], [-1.477051, 32.094873], [-1.275342, 32.089014],
    [-1.225928, 32.107227], [-1.225928, 32.164551], [-1.262109, 32.271143], [-1.240332, 32.3375],
    [-1.45, 32.784814], [-1.510010, 32.877637], [-1.550733, 33.073584], [-1.625098, 33.183350],
    [-1.679199, 33.318652], [-1.63125, 33.566748], [-1.702979, 33.716846], [-1.714111, 33.781836],
    [-1.714697, 33.858203], [-1.692676, 33.990283], [-1.706934, 34.176074], [-1.791797, 34.367920],
    [-1.751855, 34.433252], [-1.733301, 34.467041], [-1.739453, 34.496094], [-1.816602, 34.557080],
    [-1.849658, 34.607324], [-1.832422, 34.654639], [-1.792188, 34.723193], [-1.795605, 34.751904],
    [-1.920898, 34.835547], [-2.131787, 34.970850], [-2.190771, 35.029785], [-2.219629, 35.104199],
    [-2.017773, 35.085059], [-1.913281, 35.094238], [-1.673633, 35.183105], [-1.483740, 35.303076],
    [-1.335840, 35.364258], [-1.205371, 35.495752], [-1.087695, 35.578857], [-0.917480, 35.668408],
    [-0.426123, 35.861523], [-0.350781, 35.863184], [-0.189160, 35.819092], [-0.048242, 35.832813],
    [0.047949, 35.900537], [0.151660, 36.063135], [0.312207, 36.162354], [0.514941, 36.261816],
    [0.790820, 36.356543], [0.971680, 36.443945], [1.257227, 36.519580], [1.974512, 36.567578],
    [2.342871, 36.610303], [2.593359, 36.600684], [2.846484, 36.738867], [2.972852, 36.784473],
    [3.520508, 36.795117], [3.779004, 36.896191], [4.758105, 36.896338], [4.877832, 36.862402],
    [4.995410, 36.808057], [5.195605, 36.676807], [5.295410, 36.648242], [5.424609, 36.675439],
    [5.725488, 36.799609], [6.064746, 36.864258], [6.249121, 36.938330], [6.327832, 37.046045],
    [6.486523, 37.085742], [6.575879, 37.003027], [6.927539, 36.919434], [7.143457, 36.943359],
    [7.238477, 36.968506], [7.204297, 37.092383], [7.432422, 37.059277], [7.607715, 36.999756],
    [7.791602, 36.880273], [7.910449, 36.856348], [8.127148, 36.910352], [8.576562, 36.937207],
  ];

  // Générer le path SVG du contour
  const algeriaPath = (() => {
    const points = algeriaCoords.map(([lon, lat]) => {
      const coords = toSvgCoords(lat, lon);
      return `${coords.x},${coords.y}`;
    });
    return `M ${points.join(' L ')} Z`;
  })();

  // Côte méditerranéenne (extraite des coordonnées nord de l'Algérie)
  const coastCoords = [
    [-2.219629, 35.104199], [-2.017773, 35.085059], [-1.913281, 35.094238],
    [-1.673633, 35.183105], [-1.483740, 35.303076], [-1.335840, 35.364258],
    [-1.205371, 35.495752], [-1.087695, 35.578857], [-0.917480, 35.668408],
    [-0.426123, 35.861523], [-0.350781, 35.863184], [-0.189160, 35.819092],
    [-0.048242, 35.832813], [0.047949, 35.900537], [0.151660, 36.063135],
    [0.312207, 36.162354], [0.514941, 36.261816], [0.790820, 36.356543],
    [0.971680, 36.443945], [1.257227, 36.519580], [1.974512, 36.567578],
    [2.342871, 36.610303], [2.593359, 36.600684], [2.846484, 36.738867],
    [2.972852, 36.784473], [3.520508, 36.795117], [3.779004, 36.896191],
    [4.758105, 36.896338], [4.877832, 36.862402], [4.995410, 36.808057],
    [5.195605, 36.676807], [5.295410, 36.648242], [5.424609, 36.675439],
    [5.725488, 36.799609], [6.064746, 36.864258], [6.249121, 36.938330],
    [6.327832, 37.046045], [6.486523, 37.085742], [6.575879, 37.003027],
    [6.927539, 36.919434], [7.143457, 36.943359], [7.238477, 36.968506],
    [7.204297, 37.092383], [7.432422, 37.059277], [7.607715, 36.999756],
    [7.791602, 36.880273], [7.910449, 36.856348], [8.127148, 36.910352],
    [8.576562, 36.937207],
  ];

  const coastPath = (() => {
    const points = coastCoords.map(([lon, lat]) => {
      const coords = toSvgCoords(lat, lon);
      return `${coords.x},${coords.y}`;
    });
    return `M ${points.join(' L ')}`;
  })();

  // Convertir une géométrie OSRM en path SVG
  const geometryToPath = (geometry) => {
    if (!geometry || geometry.length === 0) return '';
    const points = geometry.map(([lon, lat]) => {
      const { x, y } = toSvgCoords(lat, lon);
      return `${x},${y}`;
    });
    return `M ${points.join(' L ')}`;
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
  const isHub = (wilayaName) => clusters.some(c => c.hub_name === wilayaName);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto bg-gradient-to-b from-blue-50 to-slate-100 rounded-xl shadow-inner">
        <defs>
          <linearGradient id="mapBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef9c3" />
            <stop offset="50%" stopColor="#fef3c7" />
            <stop offset="100%" stopColor="#fde68a" />
          </linearGradient>
          <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#006233" />
            <stop offset="50%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#D21034" />
          </linearGradient>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="2" dy="2" stdDeviation="3" floodOpacity="0.3"/>
          </filter>
          <pattern id="desertPattern" patternUnits="userSpaceOnUse" width="20" height="20">
            <circle cx="10" cy="10" r="1" fill="#d4a574" opacity="0.3"/>
          </pattern>
        </defs>

        {/* Mer Méditerranée (fond) */}
        <rect x="0" y="0" width={width} height="120" fill="#bfdbfe" opacity="0.5"/>

        {/* Contour de l'Algérie */}
        <path
          d={algeriaPath}
          fill="url(#mapBg)"
          stroke="#92400e"
          strokeWidth="2.5"
        />

        {/* Pattern désert dans le sud */}
        <path
          d={algeriaPath}
          fill="url(#desertPattern)"
          stroke="none"
        />

        {/* Côte méditerranéenne */}
        <path
          d={coastPath}
          fill="none"
          stroke="#2563eb"
          strokeWidth="4"
          strokeLinecap="round"
        />

        {/* Routes réelles OSRM */}
        {showRealRoutes && routes.map((route, idx) => (
          route.geometry && route.geometry.length > 0 && (
            <g key={`route-${idx}`}>
              <path
                d={geometryToPath(route.geometry)}
                fill="none"
                stroke="rgba(0,0,0,0.1)"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={geometryToPath(route.geometry)}
                fill="none"
                stroke={clusterColors[route.cluster_id % clusterColors.length]}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity="0.8"
              />
            </g>
          )
        ))}

        {/* Route sélectionnée */}
        {selectedRoute && selectedRoute.geometry && (
          <g>
            <path
              d={geometryToPath(selectedRoute.geometry)}
              fill="none"
              stroke="#006233"
              strokeWidth="8"
              strokeLinecap="round"
              strokeOpacity="0.3"
            />
            <path
              d={geometryToPath(selectedRoute.geometry)}
              fill="none"
              stroke="url(#routeGradient)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="10 5"
              className="animate-dash"
            />
          </g>
        )}

        {/* Points des wilayas */}
        {wilayas.map((wilaya) => {
          const coords = toSvgCoords(wilaya.latitude, wilaya.longitude);
          const clusterIdx = getWilayaCluster(wilaya.name);
          const isHubCity = isHub(wilaya.name);
          const isSelected = selectedWilaya === wilaya.name;
          const isHovered = hoveredWilaya === wilaya.name;

          return (
            <g
              key={wilaya.name}
              onMouseEnter={() => setHoveredWilaya(wilaya.name)}
              onMouseLeave={() => setHoveredWilaya(null)}
              onClick={() => onWilayaClick?.(wilaya)}
              className="cursor-pointer"
            >
              {isHubCity && (
                <circle
                  cx={coords.x}
                  cy={coords.y}
                  r={22}
                  fill={clusterColors[clusterIdx % clusterColors.length]}
                  fillOpacity="0.15"
                />
              )}

              <circle
                cx={coords.x}
                cy={coords.y}
                r={isHubCity ? 14 : (isHovered ? 10 : 6)}
                fill={clusterColors[clusterIdx % clusterColors.length]}
                stroke={isSelected ? '#000' : '#fff'}
                strokeWidth={isSelected ? 3 : 2}
                filter={isHubCity ? "url(#shadow)" : undefined}
                className="transition-all duration-200"
              />

              {isHubCity && (
                <text
                  x={coords.x}
                  y={coords.y + 5}
                  textAnchor="middle"
                  fill="white"
                  fontSize="11"
                  fontWeight="bold"
                >
                  H
                </text>
              )}

              {(isHubCity || isHovered || wilaya.demand_tonnes > 1500) && (
                <g>
                  <rect
                    x={coords.x - 40}
                    y={coords.y - 30}
                    width="80"
                    height="18"
                    rx="4"
                    fill="white"
                    fillOpacity="0.95"
                    stroke="#d1d5db"
                    strokeWidth="0.5"
                  />
                  <text
                    x={coords.x}
                    y={coords.y - 16}
                    textAnchor="middle"
                    fill="#1f2937"
                    fontSize="10"
                    fontWeight={isHubCity ? 'bold' : 'normal'}
                  >
                    {wilaya.name}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Légende */}
        <g transform="translate(15, 15)">
          <rect width="130" height="130" fill="white" rx="8" fillOpacity="0.95" filter="url(#shadow)" />
          <text x="10" y="20" fontSize="11" fontWeight="bold" fill="#374151">Légende</text>

          <circle cx="18" cy="40" r="6" fill="#006233" />
          <text x="30" y="44" fontSize="9" fill="#6b7280">Nord (Côtier)</text>

          <circle cx="18" cy="58" r="6" fill="#F59E0B" />
          <text x="30" y="62" fontSize="9" fill="#6b7280">Hauts-Plateaux</text>

          <circle cx="18" cy="76" r="6" fill="#D21034" />
          <text x="30" y="80" fontSize="9" fill="#6b7280">Sud (Sahara)</text>

          <line x1="10" y1="92" x2="40" y2="92" stroke="#2563eb" strokeWidth="3" />
          <text x="48" y="96" fontSize="9" fill="#6b7280">Méditerranée</text>

          <circle cx="18" cy="112" r="10" fill="#3B82F6" stroke="#fff" strokeWidth="2" />
          <text x="18" y="116" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">H</text>
          <text x="34" y="116" fontSize="9" fill="#374151">Hub Régional</text>
        </g>

        {/* Info route sélectionnée */}
        {selectedRoute && (
          <g transform={`translate(${width - 175}, 15)`}>
            <rect width="165" height="75" fill="white" rx="8" fillOpacity="0.95" filter="url(#shadow)" />
            <text x="10" y="18" fontSize="10" fontWeight="bold" fill="#006233">
              Itinéraire OSRM
            </text>
            <text x="10" y="34" fontSize="9" fill="#374151">
              {selectedRoute.origin} → {selectedRoute.destination}
            </text>
            <text x="10" y="50" fontSize="9" fill="#6b7280">
              📏 Distance: {selectedRoute.distance_km} km
            </text>
            <text x="10" y="66" fontSize="9" fill="#6b7280">
              ⏱️ Durée: {Math.round(selectedRoute.duration_minutes)} min
            </text>
          </g>
        )}

        {/* Pays voisins (labels) */}
        <text x="60" y="200" fontSize="10" fill="#9ca3af" fontStyle="italic">MAROC</text>
        <text x={width - 60} y="180" fontSize="10" fill="#9ca3af" fontStyle="italic">TUNISIE</text>
        <text x={width - 50} y="350" fontSize="10" fill="#9ca3af" fontStyle="italic">LIBYE</text>
        <text x={width - 80} y="520" fontSize="10" fill="#9ca3af" fontStyle="italic">NIGER</text>
        <text x="200" y="530" fontSize="10" fill="#9ca3af" fontStyle="italic">MALI</text>
        <text x="50" y="400" fontSize="10" fill="#9ca3af" fontStyle="italic">MAURITANIE</text>
        <text x={width/2 - 30} y="35" fontSize="10" fill="#3b82f6" fontStyle="italic">MER MÉDITERRANÉE</text>
      </svg>

      <style>{`
        @keyframes dash {
          to { stroke-dashoffset: -30; }
        }
        .animate-dash {
          animation: dash 1s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default AlgeriaMapReal;
