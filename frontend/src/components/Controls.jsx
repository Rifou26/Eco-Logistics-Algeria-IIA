import React from 'react';
import { Leaf, DollarSign, Truck, Train, Factory, MapPin, TrendingDown, TrendingUp } from 'lucide-react';

/**
 * Curseur Alpha interactif (Économie vs Écologie)
 */
export const AlphaSlider = ({ alpha, onChange, disabled = false }) => {
  return (
    <div className="p-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/30 dark:to-blue-900/30 rounded-xl">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <Leaf className="w-5 h-5 text-green-600 dark:text-green-400" />
          <span className="text-sm font-medium text-green-700 dark:text-green-400">Écologie</span>
        </div>
        <div className="text-center">
          <span className="text-2xl font-bold text-gray-800 dark:text-white">α = {alpha.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-blue-700 dark:text-blue-400">Économie</span>
          <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
      </div>

      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={alpha}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        disabled={disabled}
        className="w-full h-3 rounded-lg appearance-none cursor-pointer
                   bg-gradient-to-r from-green-500 via-yellow-500 to-blue-500
                   disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: `linear-gradient(to right,
            #10B981 0%,
            #F59E0B ${alpha * 100}%,
            #3B82F6 100%)`
        }}
      />

      <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
        <span>0 - Minimiser CO2</span>
        <span>0.5 - Équilibré</span>
        <span>1 - Minimiser Coût</span>
      </div>
    </div>
  );
};

/**
 * Carte de statistique avec icône
 */
export const StatCard = ({ icon: Icon, label, value, unit, trend, color = 'green' }) => {
  const colorClasses = {
    green: 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-700',
    blue: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-700',
    red: 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-700',
    orange: 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-700',
    purple: 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-700',
  };

  return (
    <div className={`p-4 rounded-xl border-2 ${colorClasses[color]}`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
          <p className="text-xl font-bold text-gray-800 dark:text-white">
            {typeof value === 'number' ? value.toLocaleString() : value}
            {unit && <span className="text-sm font-normal ml-1">{unit}</span>}
          </p>
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 ${trend >= 0 ? 'text-red-500' : 'text-green-500'}`}>
            {trend >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span className="text-sm font-medium">{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Badge du mode de transport
 */
export const TransportBadge = ({ mode }) => {
  const config = {
    train: { icon: Train, label: 'Train SNTF', color: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' },
    truck_small: { icon: Truck, label: 'Petit Camion', color: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300' },
    truck_medium: { icon: Truck, label: 'Camion Moyen', color: 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300' },
    truck_large: { icon: Truck, label: 'Gros Porteur', color: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300' },
    multimodal: { icon: Factory, label: 'Multimodal', color: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' },
  };

  const { icon: Icon, label, color } = config[mode] || config.truck_large;

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${color}`}>
      <Icon className="w-4 h-4" />
      {label}
    </span>
  );
};

/**
 * Carte de décision de transport
 */
export const DecisionCard = ({ decision, index }) => {
  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">#{index + 1}</span>
        <TransportBadge mode={decision.transport_mode} />
      </div>

      <div className="flex items-center gap-2 mb-2">
        <MapPin className="w-4 h-4 text-green-600 dark:text-green-400" />
        <span className="font-medium text-gray-800 dark:text-white">{decision.origin}</span>
        <span className="text-gray-400 dark:text-gray-500">→</span>
        <MapPin className="w-4 h-4 text-red-600 dark:text-red-400" />
        <span className="font-medium text-gray-800 dark:text-white">{decision.destination}</span>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
        <span>{decision.cargo_tonnes} tonnes</span>
        {decision.via_hub && (
          <span className="text-blue-600 dark:text-blue-400">
            via Hub: {decision.via_hub}
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * Panneau de solution Pareto
 */
export const SolutionPanel = ({ solution, isRecommended = false }) => {
  if (!solution) return null;

  return (
    <div className={`p-6 rounded-xl border-2 ${
      isRecommended
        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
    }`}>
      {isRecommended && (
        <div className="flex items-center gap-2 mb-4">
          <span className="px-3 py-1 bg-green-500 text-white text-sm font-semibold rounded-full">
            Solution Recommandée
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-4">
        <StatCard
          icon={DollarSign}
          label="Coût Total"
          value={Math.round(solution.total_cost_dzd / 1000)}
          unit="K DZD"
          color="blue"
        />
        <StatCard
          icon={Leaf}
          label="Émissions CO2"
          value={Math.round(solution.total_co2_kg)}
          unit="kg"
          color="green"
        />
      </div>

      {solution.decisions && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Détail des {solution.decisions.length} livraisons:
          </h4>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {solution.decisions.slice(0, 5).map((decision, idx) => (
              <DecisionCard key={idx} decision={decision} index={idx} />
            ))}
            {solution.decisions.length > 5 && (
              <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-2">
                ... et {solution.decisions.length - 5} autres livraisons
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Indicateur de chargement
 */
export const LoadingSpinner = ({ message = 'Chargement...' }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div className="w-12 h-12 border-4 border-green-200 dark:border-green-800 border-t-green-600 dark:border-t-green-400 rounded-full animate-spin mb-4"></div>
      <p className="text-gray-600 dark:text-gray-400">{message}</p>
    </div>
  );
};

/**
 * Message d'erreur
 */
export const ErrorMessage = ({ message, onRetry }) => {
  return (
    <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-center">
      <p className="text-red-700 dark:text-red-400 mb-4">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary">
          Réessayer
        </button>
      )}
    </div>
  );
};

export default {
  AlphaSlider,
  StatCard,
  TransportBadge,
  DecisionCard,
  SolutionPanel,
  LoadingSpinner,
  ErrorMessage
};
