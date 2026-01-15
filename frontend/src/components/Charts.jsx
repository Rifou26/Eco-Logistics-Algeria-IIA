import React from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, BarChart, Bar, Cell
} from 'recharts';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Graphique du Front de Pareto (Coût vs CO2)
 */
export const ParetoChart = ({ data, selectedIndex, onPointClick }) => {
  const { isDark } = useTheme();

  const gridColor = isDark ? '#374151' : '#E5E7EB';
  const textColor = isDark ? '#D1D5DB' : '#4B5563';
  const bgColor = isDark ? '#1F2937' : '#FFFFFF';
  const borderColor = isDark ? '#374151' : '#E5E7EB';

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
        Lancez une optimisation pour voir le Front de Pareto
      </div>
    );
  }

  const chartData = data.map((point, idx) => ({
    ...point,
    index: idx,
    isSelected: idx === selectedIndex,
    // Convertir en millions pour lisibilité
    cost_millions: point.total_cost_dzd / 1000000,
    co2_tonnes: point.total_co2_kg / 1000
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis
          type="number"
          dataKey="cost_millions"
          name="Coût"
          unit=" M DZD"
          tick={{ fill: textColor }}
          label={{ value: 'Coût (Millions DZD)', position: 'bottom', offset: 0, fill: textColor }}
        />
        <YAxis
          type="number"
          dataKey="co2_tonnes"
          name="CO2"
          unit=" t"
          tick={{ fill: textColor }}
          label={{ value: 'CO2 (Tonnes)', angle: -90, position: 'insideLeft', fill: textColor }}
        />
        <Tooltip
          cursor={{ strokeDasharray: '3 3' }}
          content={({ payload }) => {
            if (!payload || !payload[0]) return null;
            const point = payload[0].payload;
            return (
              <div className="p-3 rounded-lg shadow-lg border" style={{ backgroundColor: bgColor, borderColor: borderColor }}>
                <p className="font-semibold text-sm" style={{ color: textColor }}>Solution #{point.index + 1}</p>
                <p className="text-sm" style={{ color: textColor }}>
                  Coût: {point.total_cost_dzd?.toLocaleString()} DZD
                </p>
                <p className="text-sm" style={{ color: textColor }}>
                  CO2: {point.total_co2_kg?.toLocaleString()} kg
                </p>
              </div>
            );
          }}
        />
        <Scatter
          name="Solutions"
          data={chartData}
          fill="#006233"
          onClick={(data) => onPointClick?.(data.index)}
        >
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.isSelected ? '#D21034' : '#006233'}
              r={entry.isSelected ? 10 : 6}
            />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
};

/**
 * Graphique d'évolution de l'algorithme génétique
 */
export const EvolutionChart = ({ logbook }) => {
  const { isDark } = useTheme();

  const gridColor = isDark ? '#374151' : '#E5E7EB';
  const textColor = isDark ? '#D1D5DB' : '#4B5563';

  if (!logbook || logbook.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-500 dark:text-gray-400">
        Pas de données d'évolution
      </div>
    );
  }

  const chartData = logbook.map(record => ({
    generation: record.gen,
    cost: record.min_cost / 1000000,
    co2: record.min_co2 / 1000
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis dataKey="generation" tick={{ fill: textColor }} label={{ value: 'Génération', position: 'bottom', offset: -5, fill: textColor }} />
        <YAxis yAxisId="left" orientation="left" stroke="#10B981" tick={{ fill: textColor }} />
        <YAxis yAxisId="right" orientation="right" stroke="#3B82F6" tick={{ fill: textColor }} />
        <Tooltip
          contentStyle={{
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            borderColor: isDark ? '#374151' : '#E5E7EB',
            color: textColor
          }}
          labelStyle={{ color: textColor }}
        />
        <Legend wrapperStyle={{ color: textColor }} />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="cost"
          stroke="#10B981"
          name="Coût Min (M DZD)"
          dot={false}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="co2"
          stroke="#3B82F6"
          name="CO2 Min (t)"
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

/**
 * Graphique de comparaison des modes de transport
 */
export const TransportComparisonChart = ({ comparison, predictedMode }) => {
  const { isDark } = useTheme();

  const gridColor = isDark ? '#374151' : '#E5E7EB';
  const textColor = isDark ? '#D1D5DB' : '#4B5563';
  const bgColor = isDark ? '#1F2937' : '#FFFFFF';
  const borderColor = isDark ? '#374151' : '#E5E7EB';

  if (!comparison) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-500 dark:text-gray-400">
        Sélectionnez un trajet pour voir la comparaison
      </div>
    );
  }

  const chartData = Object.entries(comparison)
    .filter(([_, value]) => !value.error)
    .map(([mode, value]) => ({
      mode: mode.replace('_', ' '),
      rawMode: mode,
      co2: value.total_co2_kg,
      vehicles: value.n_vehicles || 1,
      isPredicted: predictedMode && mode === predictedMode
    }))
    .sort((a, b) => a.co2 - b.co2);

  const colors = {
    'train': '#10B981',
    'multimodal': '#3B82F6',
    'truck large': '#F59E0B',
    'truck medium': '#F97316',
    'truck small': '#EF4444'
  };

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis type="number" tick={{ fill: textColor }} label={{ value: 'CO2 (kg)', position: 'bottom', fill: textColor }} />
        <YAxis type="category" dataKey="mode" tick={{ fill: textColor }} />
        <Tooltip
          content={({ payload }) => {
            if (!payload || !payload[0]) return null;
            const data = payload[0].payload;
            return (
              <div className="p-2 rounded shadow text-sm" style={{ backgroundColor: bgColor, borderColor: borderColor, border: '1px solid' }}>
                <p className="font-semibold" style={{ color: textColor }}>{data.mode} {data.isPredicted ? '⭐ ML' : ''}</p>
                <p style={{ color: textColor }}>CO2: {data.co2.toLocaleString()} kg</p>
                <p style={{ color: textColor }}>Véhicules: {data.vehicles}</p>
                {data.isPredicted && (
                  <p className="text-purple-500 dark:text-purple-400 font-medium">Mode recommandé par ML</p>
                )}
              </div>
            );
          }}
        />
        <Bar dataKey="co2" radius={[0, 4, 4, 0]}>
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.isPredicted ? '#8B5CF6' : (colors[entry.mode] || '#6B7280')}
              stroke={entry.isPredicted ? '#6D28D9' : 'none'}
              strokeWidth={entry.isPredicted ? 3 : 0}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

/**
 * Graphique de répartition par cluster
 */
export const ClusterDistributionChart = ({ clusters }) => {
  const { isDark } = useTheme();

  const gridColor = isDark ? '#374151' : '#E5E7EB';
  const textColor = isDark ? '#D1D5DB' : '#4B5563';

  if (!clusters || clusters.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-500 dark:text-gray-400">
        Effectuez un clustering pour voir la répartition
      </div>
    );
  }

  const chartData = clusters.map((cluster, idx) => ({
    name: cluster.hub_name,
    wilayas: cluster.wilayas_covered?.length || 0,
    demand: cluster.total_demand || 0
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} fontSize={10} tick={{ fill: textColor }} />
        <YAxis yAxisId="left" orientation="left" stroke="#10B981" tick={{ fill: textColor }} />
        <YAxis yAxisId="right" orientation="right" stroke="#3B82F6" tick={{ fill: textColor }} />
        <Tooltip
          contentStyle={{
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            borderColor: isDark ? '#374151' : '#E5E7EB',
            color: textColor
          }}
          labelStyle={{ color: textColor }}
        />
        <Legend wrapperStyle={{ color: textColor }} />
        <Bar yAxisId="left" dataKey="wilayas" fill="#10B981" name="Wilayas" />
        <Bar yAxisId="right" dataKey="demand" fill="#3B82F6" name="Demande (t)" />
      </BarChart>
    </ResponsiveContainer>
  );
};

/**
 * Graphique de répartition par Zone (Nord, Hauts-Plateaux, Sud)
 */
export const ZoneDistributionChart = ({ wilayas }) => {
  const { isDark } = useTheme();

  const gridColor = isDark ? '#374151' : '#E5E7EB';
  const textColor = isDark ? '#D1D5DB' : '#4B5563';

  if (!wilayas || wilayas.length === 0) return null;

  const zones = wilayas.reduce((acc, w) => {
    const zone = w.zone || 'Unknown';
    acc[zone] = (acc[zone] || 0) + 1;
    return acc;
  }, {});

  const data = Object.entries(zones).map(([name, value]) => ({
    name: name.replace('_', ' '),
    value,
    color: name === 'nord' ? '#10B981' : (name === 'hauts_plateaux' ? '#F59E0B' : '#EF4444')
  }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} layout="vertical" margin={{ left: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis type="number" tick={{ fill: textColor }} />
        <YAxis type="category" dataKey="name" width={100} tick={{ fill: textColor }} />
        <Tooltip
          contentStyle={{
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            borderColor: isDark ? '#374151' : '#E5E7EB',
            color: textColor
          }}
          labelStyle={{ color: textColor }}
        />
        <Legend wrapperStyle={{ color: textColor }} />
        <Bar dataKey="value" name="Nombre de Wilayas" radius={[0, 4, 4, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export default {
  ParetoChart,
  EvolutionChart,
  TransportComparisonChart,
  ClusterDistributionChart,
  ZoneDistributionChart
};
