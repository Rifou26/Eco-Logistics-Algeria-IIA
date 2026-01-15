import React, { useState, useEffect } from 'react';
import {
  MapPin, Truck, Train, Leaf, DollarSign, BarChart3,
  Play, RefreshCw, Settings, Info, ChevronRight, Zap, Route, Navigation, Brain,
  Download, FileSpreadsheet, FileText, Sun, Moon, Menu, X, ChevronDown,
  Home, ArrowRight, Globe, Target, TrendingDown, Cpu, GitBranch, Award
} from 'lucide-react';

// Contexts
import { useTheme } from './contexts/ThemeContext';
import { useToast } from './components/ui/Toast';

// Components
import AlgeriaMap from './components/AlgeriaMap';
import AlgeriaMapReal from './components/AlgeriaMapReal';
import TSPMapAlgeria from './components/TSPMapAlgeria';
import {
  ParetoChart,
  EvolutionChart,
  ClusterDistributionChart,
  TransportComparisonChart,
  ZoneDistributionChart
} from './components/Charts';
import {
  AlphaSlider, StatCard, SolutionPanel, LoadingSpinner, ErrorMessage, TransportBadge
} from './components/Controls';
import { Tooltip } from './components/ui/Tooltip';

// API
import api from './utils/api';

// Export utilities
import { exportPredictionToPDF, exportToExcel, exportOptimizationToPDF } from './utils/exportUtils';

// ============================================================================
// Main App Component
// ============================================================================

function App() {
  // Theme & Toast
  const { isDark, toggleTheme } = useTheme();
  const { showToast } = useToast();

  // État global
  const [activeTab, setActiveTab] = useState('home');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Données
  const [wilayas, setWilayas] = useState([]);
  const [clusters, setClusters] = useState([]);

  // Paramètres d'optimisation
  const [alpha, setAlpha] = useState(0.5);
  const [nRequests, setNRequests] = useState(15);
  const [nClusters, setNClusters] = useState(6);

  // Résultats
  const [optimizationResult, setOptimizationResult] = useState(null);
  const [selectedSolutionIndex, setSelectedSolutionIndex] = useState(0);
  const [selectedWilaya, setSelectedWilaya] = useState(null);
  const [transportComparison, setTransportComparison] = useState(null);

  // Routes OSRM
  const [clusterRoutes, setClusterRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [routeOrigin, setRouteOrigin] = useState(null);
  const [showRealRoutes, setShowRealRoutes] = useState(true);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);

  // Decision Tree (Module E)
  const [prediction, setPrediction] = useState(null);
  const [modelInfo, setModelInfo] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [explanation, setExplanation] = useState(null);
  const [predictionParams, setPredictionParams] = useState({
    origin: '',
    destination: '',
    cargoTonnes: 20,
    cargoType: 'general',
    priority: 1
  });

  // TSP (Module F)
  const [tspResult, setTspResult] = useState(null);
  const [tspParams, setTspParams] = useState({
    selectedWilayas: [],
    depot: '',
    returnToDepot: true,
    cargoTonnes: 20,
    cargoType: 'general'
  });

  // Charger les wilayas au démarrage
  useEffect(() => {
    loadWilayas();
    loadModelInfo();
  }, []);

  const loadModelInfo = async () => {
    try {
      const data = await api.getModelInfo();
      setModelInfo(data);
    } catch (err) {
      console.error('Erreur chargement modèle:', err);
    }
  };

  const loadWilayas = async () => {
    try {
      const data = await api.getWilayas();
      setWilayas(data.wilayas);
    } catch (err) {
      console.error('Erreur chargement wilayas:', err);
    }
  };

  // Lancer le clustering
  const handleClustering = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.performClustering(nClusters, 0.3);
      setClusters(result.clusters || []);

      // Charger les routes réelles si activé
      if (showRealRoutes) {
        await loadClusterRoutes(nClusters);
      }
    } catch (err) {
      setError('Erreur lors du clustering: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Charger les routes réelles OSRM pour les clusters
  const loadClusterRoutes = async (n = nClusters) => {
    setIsLoadingRoutes(true);
    try {
      const result = await api.getClusterRoutes(n);
      setClusterRoutes(result.routes || []);
    } catch (err) {
      console.error('Erreur chargement routes:', err);
      // Fallback silencieux - on affiche les lignes droites
    } finally {
      setIsLoadingRoutes(false);
    }
  };

  // Obtenir une route spécifique entre deux wilayas
  const handleGetRoute = async (origin, destination) => {
    if (!origin || !destination || origin === destination) return;

    try {
      const result = await api.getRoute(origin, destination);
      setSelectedRoute(result);
    } catch (err) {
      console.error('Erreur route:', err);
    }
  };

  // Lancer l'optimisation
  const handleOptimize = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.generateAndOptimize(nRequests, 42);
      setOptimizationResult(result.optimization_result);
      setSelectedSolutionIndex(0);
    } catch (err) {
      setError('Erreur lors de l\'optimisation: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Comparer les modes de transport
  const handleCompareTransport = async (origin, destination) => {
    if (!origin || !destination) return;
    try {
      const result = await api.compareTransportModes(origin, destination, 20);
      setTransportComparison(result.comparison);
    } catch (err) {
      console.error('Erreur comparaison:', err);
    }
  };

  // Sélectionner une wilaya sur la carte
  const handleWilayaClick = (wilaya) => {
    if (routeOrigin && routeOrigin !== wilaya.name) {
      // Deuxième clic: calculer la route
      handleGetRoute(routeOrigin, wilaya.name);
      handleCompareTransport(routeOrigin, wilaya.name);
      setSelectedWilaya(wilaya.name);
      setRouteOrigin(null);
    } else {
      // Premier clic: définir l'origine
      setRouteOrigin(wilaya.name);
      setSelectedWilaya(wilaya.name);
      setSelectedRoute(null);
    }
  };

  // Prédire le mode de transport
  const handlePredict = async () => {
    if (!predictionParams.origin || !predictionParams.destination) {
      setError('Veuillez sélectionner une origine et une destination');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await api.predictTransportMode(
        predictionParams.origin,
        predictionParams.destination,
        predictionParams.cargoTonnes,
        predictionParams.cargoType,
        predictionParams.priority
      );
      setPrediction(result);
    } catch (err) {
      setError('Erreur lors de la prédiction: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Comparer ML vs Expert
  const handleCompare = async () => {
    if (!predictionParams.origin || !predictionParams.destination) return;

    setIsLoading(true);
    try {
      const result = await api.comparePredictionMethods(
        predictionParams.origin,
        predictionParams.destination,
        predictionParams.cargoTonnes,
        predictionParams.cargoType,
        predictionParams.priority
      );
      setComparison(result);
    } catch (err) {
      setError('Erreur lors de la comparaison: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Expliquer la décision
  const handleExplain = async () => {
    if (!predictionParams.origin || !predictionParams.destination) return;

    setIsLoading(true);
    try {
      const result = await api.explainPrediction(
        predictionParams.origin,
        predictionParams.destination,
        predictionParams.cargoTonnes,
        predictionParams.cargoType,
        predictionParams.priority
      );
      setExplanation(result);
    } catch (err) {
      setError('Erreur lors de l\'explication: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Voir l'empreinte carbone depuis la prédiction
  const handleViewCarbonFromPrediction = async () => {
    if (!prediction) return;

    setIsLoading(true);
    try {
      // Charger la comparaison des modes de transport
      const carbonResult = await api.compareTransportModes(
        predictionParams.origin,
        predictionParams.destination,
        predictionParams.cargoTonnes,
        predictionParams.cargoType
      );
      setTransportComparison(carbonResult);

      // Charger la route réelle
      const routeResult = await api.getRoute(
        predictionParams.origin,
        predictionParams.destination
      );
      setSelectedRoute(routeResult);
      setRouteOrigin(predictionParams.origin);

      // Naviguer vers l'onglet Empreinte CO2
      setActiveTab('carbon');
    } catch (err) {
      setError('Erreur lors du chargement des données carbone: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Optimiser la tournée TSP
  const handleOptimizeTSP = async () => {
    if (tspParams.selectedWilayas.length < 3) {
      setError('Sélectionnez au moins 3 wilayas pour la tournée');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await api.optimizeTSPWithCarbon(
        tspParams.selectedWilayas,
        tspParams.depot || null,
        tspParams.returnToDepot,
        tspParams.cargoTonnes,
        tspParams.cargoType
      );
      setTspResult(result);
    } catch (err) {
      setError('Erreur lors de l\'optimisation de la tournée: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Ajouter/retirer une wilaya de la tournée
  const toggleWilayaInTour = (wilayaName) => {
    setTspParams(prev => {
      const selected = prev.selectedWilayas;
      if (selected.includes(wilayaName)) {
        return { ...prev, selectedWilayas: selected.filter(w => w !== wilayaName) };
      } else {
        return { ...prev, selectedWilayas: [...selected, wilayaName] };
      }
    });
  };

  // Solution recommandée
  const recommendedSolution = optimizationResult?.recommended_solution;
  const paretoFront = optimizationResult?.pareto_front || [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      {/* Header */}
      <header className="gradient-algeria text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 md:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-white rounded-lg flex items-center justify-center shadow-lg animate-float">
                <Leaf className="w-6 h-6 md:w-8 md:h-8 text-green-600" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold">Eco-Logistics Algeria</h1>
                <p className="text-green-200 text-xs md:text-sm hidden sm:block">
                  Optimisation Hybride Multi-Objectif (Coût/Carbone)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
              {/* Stats - Hidden on mobile */}
              <div className="hidden md:flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm text-green-200">Wilayas</p>
                  <p className="text-xl font-bold">{wilayas.length}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-green-200">Hubs</p>
                  <p className="text-xl font-bold">{clusters.length || '-'}</p>
                </div>
              </div>

              {/* Dark Mode Toggle */}
              <Tooltip content={isDark ? 'Mode clair' : 'Mode sombre'}>
                <button
                  onClick={toggleTheme}
                  className="p-2 md:p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-200 hover:scale-105"
                  aria-label="Toggle theme"
                >
                  {isDark ? (
                    <Sun className="w-5 h-5 text-yellow-300" />
                  ) : (
                    <Moon className="w-5 h-5 text-white" />
                  )}
                </button>
              </Tooltip>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-[72px] md:top-[88px] z-40 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4">
          {/* Desktop Navigation */}
          <div className="hidden md:flex gap-1">
            {[
              { id: 'home', label: 'Accueil', icon: Home },
              { id: 'optimize', label: 'Optimisation', icon: Zap },
              { id: 'clustering', label: 'Clustering', icon: MapPin },
              { id: 'carbon', label: 'Empreinte CO2', icon: Leaf },
              { id: 'predict', label: 'Prédiction ML', icon: Brain },
              { id: 'tsp', label: 'Tournée', icon: Route },
              { id: 'stats', label: 'Statistiques', icon: BarChart3 },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 font-medium transition-all duration-200 relative
                  ${activeTab === tab.id
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
              >
                <tab.icon className={`w-5 h-5 transition-transform duration-200 ${activeTab === tab.id ? 'scale-110' : ''}`} />
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-600 dark:bg-green-400 animate-scale-in" />
                )}
              </button>
            ))}
          </div>

          {/* Mobile Navigation - Dropdown */}
          <div className={`md:hidden overflow-hidden transition-all duration-300 ${mobileMenuOpen ? 'max-h-96 py-2' : 'max-h-0'}`}>
            {[
              { id: 'home', label: 'Accueil', icon: Home },
              { id: 'optimize', label: 'Optimisation', icon: Zap },
              { id: 'clustering', label: 'Clustering', icon: MapPin },
              { id: 'carbon', label: 'Empreinte CO2', icon: Leaf },
              { id: 'predict', label: 'Prédiction ML', icon: Brain },
              { id: 'tsp', label: 'Tournée', icon: Route },
              { id: 'stats', label: 'Statistiques', icon: BarChart3 },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setMobileMenuOpen(false);
                }}
                className={`flex items-center gap-3 w-full px-4 py-3 font-medium transition-all duration-200 rounded-lg
                  ${activeTab === tab.id
                    ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Mobile Tab Indicator */}
          <div className="md:hidden flex items-center justify-between py-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium"
            >
              {(() => {
                const currentTab = [
                  { id: 'home', label: 'Accueil', icon: Home },
                  { id: 'optimize', label: 'Optimisation', icon: Zap },
                  { id: 'clustering', label: 'Clustering', icon: MapPin },
                  { id: 'carbon', label: 'Empreinte CO2', icon: Leaf },
                  { id: 'predict', label: 'Prédiction ML', icon: Brain },
                  { id: 'tsp', label: 'Tournée', icon: Route },
                  { id: 'stats', label: 'Statistiques', icon: BarChart3 },
                ].find(t => t.id === activeTab);
                const Icon = currentTab?.icon || Zap;
                return (
                  <>
                    <Icon className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <span>{currentTab?.label}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${mobileMenuOpen ? 'rotate-180' : ''}`} />
                  </>
                );
              })()}
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 md:py-8">
        {error && (
          <div className="animate-fade-in-down">
            <ErrorMessage message={error} onRetry={() => setError(null)} />
          </div>
        )}

        {/* Tab: Home - Page d'Accueil */}
        {activeTab === 'home' && (
          <div className="space-y-8 animate-fade-in">
            {/* Hero Section */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-green-600 via-green-700 to-emerald-800 dark:from-green-700 dark:via-green-800 dark:to-emerald-900 text-white p-8 md:p-12">
              <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-400/20 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl" />

              <div className="relative z-10 flex flex-col lg:flex-row items-center gap-8">
                {/* Text Content */}
                <div className="flex-1 max-w-3xl">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                      <Leaf className="w-8 h-8" />
                    </div>
                    <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium backdrop-blur-sm">
                      Système Intelligent
                    </span>
                  </div>

                  <h1 className="text-3xl md:text-5xl font-bold mb-4 leading-tight">
                    Optimisation Logistique
                    <span className="block text-green-200">Multi-Objectif pour l'Algérie</span>
                  </h1>

                  <p className="text-lg md:text-xl text-green-100 mb-8 max-w-2xl">
                    Réduisez vos coûts de transport et votre empreinte carbone grâce à
                    l'intelligence artificielle. 6 modules IA pour une logistique durable.
                  </p>

                  <div className="flex flex-wrap gap-4">
                    <button
                      onClick={() => setActiveTab('optimize')}
                      className="flex items-center gap-2 px-6 py-3 bg-white text-green-700 rounded-xl font-semibold hover:bg-green-50 transition-all hover:scale-105 shadow-lg"
                    >
                      <Zap className="w-5 h-5" />
                      Commencer l'Optimisation
                      <ArrowRight className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setActiveTab('predict')}
                      className="flex items-center gap-2 px-6 py-3 bg-white/20 backdrop-blur-sm rounded-xl font-semibold hover:bg-white/30 transition-all"
                    >
                      <Brain className="w-5 h-5" />
                      Essayer la Prédiction ML
                    </button>
                  </div>
                </div>

                {/* Hero Image - 16:9 aspect ratio */}
                <div className="flex-shrink-0 lg:flex-1 flex justify-center lg:justify-end w-full lg:w-auto">
                  <div className="relative w-full max-w-md lg:max-w-lg">
                    <div className="absolute inset-0 bg-gradient-to-br from-green-400/30 to-emerald-600/30 rounded-2xl blur-xl transform scale-105" />
                    <div className="relative aspect-video w-full">
                      <img
                        src="/hero-image.jpg"
                        alt="Eco-Logistics Algeria"
                        className="absolute inset-0 w-full h-full object-cover rounded-2xl shadow-2xl border-4 border-white/20"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="card text-center hover-lift">
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Globe className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-3xl font-bold text-gray-800 dark:text-white">{wilayas.length}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Wilayas Couvertes</p>
              </div>
              <div className="card text-center hover-lift">
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Cpu className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-3xl font-bold text-gray-800 dark:text-white">6</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Modules IA</p>
              </div>
              <div className="card text-center hover-lift">
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <Target className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <p className="text-3xl font-bold text-gray-800 dark:text-white">88%</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Précision ML</p>
              </div>
              <div className="card text-center hover-lift">
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <TrendingDown className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
                <p className="text-3xl font-bold text-gray-800 dark:text-white">-23%</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Réduction CO2</p>
              </div>
            </div>

            {/* Features Grid */}
            <div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-3">
                <GitBranch className="w-7 h-7 text-green-600 dark:text-green-400" />
                Les 6 Modules d'Intelligence Artificielle
              </h2>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Module 1: Clustering */}
                <div
                  onClick={() => setActiveTab('clustering')}
                  className="card hover-lift cursor-pointer group border-2 border-transparent hover:border-green-500/50"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900/30 group-hover:scale-110 transition-transform">
                      <MapPin className="w-6 h-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-800 dark:text-white mb-1 flex items-center gap-2">
                        Clustering K-Means
                        <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full">Module A</span>
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Segmentation territoriale intelligente pour positionner les hubs de distribution optimaux.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">3-10 clusters</span>
                    <ChevronRight className="w-4 h-4 text-green-600 dark:text-green-400 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

                {/* Module 2: Expert CO2 */}
                <div
                  onClick={() => setActiveTab('carbon')}
                  className="card hover-lift cursor-pointer group border-2 border-transparent hover:border-emerald-500/50"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 group-hover:scale-110 transition-transform">
                      <Leaf className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-800 dark:text-white mb-1 flex items-center gap-2">
                        Système Expert CO2
                        <span className="text-xs px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full">Module B</span>
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Calcul précis des émissions carbone avec 8 règles métier expertes.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">8 règles ADEME</span>
                    <ChevronRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

                {/* Module 3: NSGA-II */}
                <div
                  onClick={() => setActiveTab('optimize')}
                  className="card hover-lift cursor-pointer group border-2 border-transparent hover:border-blue-500/50"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30 group-hover:scale-110 transition-transform">
                      <Zap className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-800 dark:text-white mb-1 flex items-center gap-2">
                        Optimiseur NSGA-II
                        <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">Module C</span>
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Algorithme génétique multi-objectif pour le compromis coût/carbone.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Front de Pareto</span>
                    <ChevronRight className="w-4 h-4 text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

                {/* Module 4: OSRM */}
                <div
                  onClick={() => setActiveTab('clustering')}
                  className="card hover-lift cursor-pointer group border-2 border-transparent hover:border-cyan-500/50"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-cyan-100 dark:bg-cyan-900/30 group-hover:scale-110 transition-transform">
                      <Navigation className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-800 dark:text-white mb-1 flex items-center gap-2">
                        Routing OSRM
                        <span className="text-xs px-2 py-0.5 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 rounded-full">Module D</span>
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Itinéraires routiers réels avec distances et durées précises.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Routes réelles</span>
                    <ChevronRight className="w-4 h-4 text-cyan-600 dark:text-cyan-400 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

                {/* Module 5: Decision Tree */}
                <div
                  onClick={() => setActiveTab('predict')}
                  className="card hover-lift cursor-pointer group border-2 border-transparent hover:border-purple-500/50"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900/30 group-hover:scale-110 transition-transform">
                      <Brain className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-800 dark:text-white mb-1 flex items-center gap-2">
                        Decision Tree ML
                        <span className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full">Module E</span>
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Prédiction intelligente du mode de transport optimal.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">88.4% précision</span>
                    <ChevronRight className="w-4 h-4 text-purple-600 dark:text-purple-400 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

                {/* Module 6: TSP */}
                <div
                  onClick={() => setActiveTab('tsp')}
                  className="card hover-lift cursor-pointer group border-2 border-transparent hover:border-orange-500/50"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-orange-100 dark:bg-orange-900/30 group-hover:scale-110 transition-transform">
                      <Route className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-800 dark:text-white mb-1 flex items-center gap-2">
                        Optimisation TSP
                        <span className="text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full">Module F</span>
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Optimisation des tournées multi-arrêts par algorithme génétique.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">-23% distance</span>
                    <ChevronRight className="w-4 h-4 text-orange-600 dark:text-orange-400 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            </div>

            {/* Technologies Section */}
            <div className="card bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-3">
                <Award className="w-6 h-6 text-green-600 dark:text-green-400" />
                Technologies Utilisées
              </h2>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">Py</span>
                  </div>
                  <p className="font-medium text-gray-800 dark:text-white">Python</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Backend & ML</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-xl bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                    <span className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">Re</span>
                  </div>
                  <p className="font-medium text-gray-800 dark:text-white">React</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Frontend UI</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                    <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">Sk</span>
                  </div>
                  <p className="font-medium text-gray-800 dark:text-white">Scikit-learn</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Machine Learning</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <span className="text-2xl font-bold text-green-600 dark:text-green-400">Dp</span>
                  </div>
                  <p className="font-medium text-gray-800 dark:text-white">DEAP</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Algorithmes Génétiques</p>
                </div>
              </div>
            </div>

            {/* CTA Section */}
            <div className="text-center py-8">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
                Prêt à optimiser votre logistique?
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-xl mx-auto">
                Commencez par explorer les différents modules ou lancez directement une optimisation multi-objectif.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <button
                  onClick={() => setActiveTab('optimize')}
                  className="btn-primary flex items-center gap-2"
                >
                  <Play className="w-5 h-5" />
                  Lancer une Optimisation
                </button>
                <button
                  onClick={() => setActiveTab('stats')}
                  className="btn-secondary flex items-center gap-2"
                >
                  <BarChart3 className="w-5 h-5" />
                  Voir les Statistiques
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Optimisation Multi-Objectif */}
        {activeTab === 'optimize' && (
          <div className="space-y-6 animate-fade-in">
            {/* Contrôles */}
            <div className="card hover-lift">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <Settings className="w-6 h-6 text-green-600 dark:text-green-400" />
                Paramètres d'Optimisation NSGA-II
              </h2>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <AlphaSlider
                    alpha={alpha}
                    onChange={setAlpha}
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Nombre de demandes de test
                    </label>
                    <input
                      type="range"
                      min="5"
                      max="30"
                      value={nRequests}
                      onChange={(e) => setNRequests(parseInt(e.target.value))}
                      className="w-full"
                      disabled={isLoading}
                    />
                    <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                      <span>5</span>
                      <span className="font-bold">{nRequests} demandes</span>
                      <span>30</span>
                    </div>
                  </div>

                  <button
                    onClick={handleOptimize}
                    disabled={isLoading}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Optimisation en cours...
                      </>
                    ) : (
                      <>
                        <Play className="w-5 h-5" />
                        Lancer l'Optimisation
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Résultats */}
            {isLoading ? (
              <LoadingSpinner message="Algorithme génétique NSGA-II en cours..." />
            ) : optimizationResult ? (
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Front de Pareto */}
                <div className="card hover-lift animate-fade-in-up">
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-green-600 dark:text-green-400" />
                    Front de Pareto ({paretoFront.length} solutions)
                  </h3>
                  <ParetoChart
                    data={paretoFront}
                    selectedIndex={selectedSolutionIndex}
                    onPointClick={setSelectedSolutionIndex}
                  />
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center">
                    Cliquez sur un point pour voir les détails
                  </p>
                </div>

                {/* Solution Recommandée */}
                <div className="card hover-lift animate-fade-in-up">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                      Solution Recommandée (α = {alpha})
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => exportOptimizationToPDF(optimizationResult, clusters)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                        title="Exporter en PDF"
                      >
                        <FileText className="w-4 h-4" />
                        PDF
                      </button>
                      <button
                        onClick={() => exportToExcel(null, null, null, optimizationResult)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                        title="Exporter en Excel"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        Excel
                      </button>
                    </div>
                  </div>
                  <SolutionPanel
                    solution={recommendedSolution}
                    isRecommended={true}
                  />
                </div>

                {/* Évolution de l'algorithme */}
                <div className="card lg:col-span-2 hover-lift">
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">
                    Évolution de l'Algorithme Génétique
                  </h3>
                  <EvolutionChart logbook={optimizationResult.logbook} />
                </div>

                {/* Statistiques */}
                <div className="card lg:col-span-2">
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">
                    Statistiques de l'Optimisation
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard
                      icon={Zap}
                      label="Générations"
                      value={optimizationResult.statistics?.generations || 0}
                      color="purple"
                    />
                    <StatCard
                      icon={BarChart3}
                      label="Population"
                      value={optimizationResult.statistics?.population_size || 0}
                      color="blue"
                    />
                    <StatCard
                      icon={DollarSign}
                      label="Coût Min"
                      value={Math.round((optimizationResult.statistics?.final_min_cost || 0) / 1000)}
                      unit="K DZD"
                      color="green"
                    />
                    <StatCard
                      icon={Leaf}
                      label="CO2 Min"
                      value={Math.round(optimizationResult.statistics?.final_min_co2 || 0)}
                      unit="kg"
                      color="orange"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="card text-center py-12 animate-fade-in">
                <Zap className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-2">
                  Prêt à optimiser
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  Ajustez le curseur α et lancez l'optimisation pour trouver<br />
                  le meilleur compromis entre coût et impact environnemental.
                </p>
                <button onClick={handleOptimize} className="btn-primary">
                  <Play className="w-5 h-5 inline mr-2" />
                  Démarrer
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab: Clustering */}
        {activeTab === 'clustering' && (
          <div className="grid lg:grid-cols-2 gap-6 animate-fade-in">
            <div className="card hover-lift">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">
                Segmentation Territoriale K-Means
              </h3>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nombre de Hubs Régionaux
                  </label>
                  <input
                    type="range"
                    min="3"
                    max="10"
                    value={nClusters}
                    onChange={(e) => setNClusters(parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                    <span>3</span>
                    <span className="font-bold text-green-600 dark:text-green-400">{nClusters} hubs</span>
                    <span>10</span>
                  </div>
                </div>

                <button
                  onClick={handleClustering}
                  disabled={isLoading}
                  className="btn-primary w-full"
                >
                  {isLoading ? 'Calcul...' : 'Lancer le Clustering'}
                </button>
              </div>

              {clusters.length > 0 && (
                <>
                  <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Hubs Identifiés:</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {clusters.map((cluster, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold"
                            style={{ backgroundColor: ['#006233', '#D21034', '#3B82F6', '#F59E0B', '#8B5CF6', '#10B981'][idx % 6] }}
                          >
                            {idx + 1}
                          </div>
                          <div>
                            <p className="font-semibold dark:text-white">{cluster.hub_name}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {cluster.wilayas_covered?.length || 0} wilayas
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-green-600 dark:text-green-400">
                            {cluster.total_demand?.toLocaleString()} t
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">demande/mois</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="card hover-lift">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  <Route className="w-5 h-5 text-green-600 dark:text-green-400" />
                  Carte avec Itinéraires Réels
                </h3>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={showRealRoutes}
                    onChange={(e) => setShowRealRoutes(e.target.checked)}
                    className="rounded text-green-600"
                  />
                  Routes OSRM
                </label>
              </div>
              {isLoadingRoutes && (
                <div className="text-center text-sm text-gray-500 dark:text-gray-400 mb-2">
                  <RefreshCw className="w-4 h-4 inline animate-spin mr-1" />
                  Chargement des itinéraires réels...
                </div>
              )}
              <AlgeriaMapReal
                wilayas={wilayas}
                clusters={clusters}
                routes={clusterRoutes}
                selectedRoute={selectedRoute}
                selectedWilaya={selectedWilaya}
                onWilayaClick={handleWilayaClick}
                showRealRoutes={showRealRoutes && clusterRoutes.length > 0}
              />
              {selectedRoute && (
                <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Navigation className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <span className="font-semibold text-green-700 dark:text-green-300">
                      {selectedRoute.origin} → {selectedRoute.destination}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Distance réelle:</span>
                      <span className="font-bold ml-2 text-gray-800 dark:text-white">{selectedRoute.distance_km} km</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Durée estimée:</span>
                      <span className="font-bold ml-2 text-gray-800 dark:text-white">{Math.round(selectedRoute.duration_minutes)} min</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {clusters.length > 0 && (
              <div className="card lg:col-span-2 hover-lift">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">
                  Répartition par Cluster
                </h3>
                <ClusterDistributionChart clusters={clusters} />
              </div>
            )}
          </div>
        )}

        {/* Tab: Empreinte CO2 */}
        {activeTab === 'carbon' && (
          <div className="grid lg:grid-cols-2 gap-6 animate-fade-in">
            {/* Bandeau de prédiction ML si on vient de la prédiction */}
            {prediction && selectedRoute && (
              <div className="card lg:col-span-2 bg-gradient-to-r from-purple-50 to-green-50 dark:from-purple-900/20 dark:to-green-900/20 border-2 border-purple-200 dark:border-purple-700">
                <div className="flex items-center gap-4">
                  <Brain className="w-10 h-10 text-purple-600 dark:text-purple-400" />
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                      Résultat de la Prédiction ML
                      <span className="px-2 py-1 bg-purple-600 text-white text-xs rounded-full">
                        {prediction.predicted_mode.replace('_', ' ').toUpperCase()}
                      </span>
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 text-sm">
                      {prediction.input_features.origin} → {prediction.input_features.destination} |
                      {prediction.input_features.cargo_tonnes}t de {prediction.input_features.cargo_type} |
                      Distance: {prediction.input_features.distance_km} km |
                      Confiance: {(prediction.confidence * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => exportPredictionToPDF(prediction, transportComparison, selectedRoute)}
                      className="flex items-center gap-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                      title="Exporter en PDF"
                    >
                      <FileText className="w-4 h-4" />
                      PDF
                    </button>
                    <button
                      onClick={() => exportToExcel(prediction, transportComparison, selectedRoute, optimizationResult)}
                      className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                      title="Exporter en Excel"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      Excel
                    </button>
                  </div>
                  <Leaf className="w-10 h-10 text-green-600 dark:text-green-400" />
                </div>
              </div>
            )}

            <div className="card hover-lift">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">
                Calculateur d'Empreinte Carbone
              </h3>

              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Cliquez sur deux wilayas sur la carte pour comparer les modes de transport.
              </p>

              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg mb-4 border border-blue-100 dark:border-blue-800">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <Info className="w-4 h-4 inline mr-1" />
                  <strong>Système Expert:</strong> Les règles prennent en compte la zone
                  géographique (Nord/Hauts-Plateaux/Sud), l'accès ferroviaire, et le
                  taux de chargement pour calculer l'impact CO2 réel.
                </p>
              </div>

              {routeOrigin && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800">
                  <p className="font-medium text-green-700 dark:text-green-300">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    Origine: <strong>{routeOrigin}</strong>
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                    Cliquez sur une destination pour voir l'itinéraire réel
                  </p>
                </div>
              )}

              {selectedRoute && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg mt-4 border border-blue-100 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Navigation className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <span className="font-semibold text-blue-700 dark:text-blue-300">
                      Itinéraire réel OSRM
                    </span>
                  </div>
                  <p className="text-sm text-blue-600 dark:text-blue-400">
                    {selectedRoute.origin} → {selectedRoute.destination}
                  </p>
                  <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Distance:</span>
                      <span className="font-bold ml-2 text-gray-800 dark:text-white">{selectedRoute.distance_km} km</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Durée:</span>
                      <span className="font-bold ml-2 text-gray-800 dark:text-white">{Math.round(selectedRoute.duration_minutes)} min</span>
                    </div>
                  </div>
                </div>
              )}

              {transportComparison && (
                <div className="mt-6">
                  <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Comparaison des Modes (20 tonnes)
                  </h4>
                  <TransportComparisonChart comparison={transportComparison} predictedMode={prediction?.predicted_mode} />
                </div>
              )}
            </div>

            <div className="card hover-lift">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <Route className="w-5 h-5 text-green-600 dark:text-green-400" />
                Carte avec Itinéraire Réel
              </h3>
              <AlgeriaMapReal
                wilayas={wilayas}
                clusters={clusters}
                routes={[]}
                selectedRoute={selectedRoute}
                selectedWilaya={routeOrigin || selectedWilaya}
                onWilayaClick={handleWilayaClick}
                showRealRoutes={false}
              />
            </div>

            <div className="card lg:col-span-2">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">
                Règles du Système Expert
              </h3>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800 hover-lift">
                  <Train className="w-8 h-8 text-green-600 dark:text-green-400 mb-2" />
                  <h4 className="font-semibold text-green-700 dark:text-green-300">Train SNTF</h4>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    Facteur: 0.020 kg CO2/t.km<br />
                    Le plus écologique pour longues distances
                  </p>
                </div>
                <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-100 dark:border-orange-800 hover-lift">
                  <Truck className="w-8 h-8 text-orange-600 dark:text-orange-400 mb-2" />
                  <h4 className="font-semibold text-orange-700 dark:text-orange-300">Camion (Sud)</h4>
                  <p className="text-sm text-orange-600 dark:text-orange-400">
                    Pénalité +40% en zone désertique<br />
                    Chaleur et sable augmentent la consommation
                  </p>
                </div>
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-800 hover-lift">
                  <Leaf className="w-8 h-8 text-red-600 dark:text-red-400 mb-2" />
                  <h4 className="font-semibold text-red-700 dark:text-red-300">Charge Partielle</h4>
                  <p className="text-sm text-red-600 dark:text-red-400">
                    Pénalité x2.5 si charge &lt; 25%<br />
                    Optimiser le remplissage est crucial
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Prédiction ML (Decision Tree) */}
        {activeTab === 'predict' && (
          <div className="space-y-6 animate-fade-in">
            {/* Info du modèle */}
            {modelInfo && (
              <div className="card bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-100 dark:border-purple-800">
                <div className="flex items-center gap-4">
                  <Brain className="w-12 h-12 text-purple-600 dark:text-purple-400 animate-float" />
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-1">
                      Arbre de Décision (Decision Tree)
                    </h2>
                    <p className="text-gray-600 dark:text-gray-300 text-sm">
                      Modèle entraîné sur {modelInfo.training_stats?.n_samples.toLocaleString()} échantillons |
                      Précision: {(modelInfo.training_stats?.test_accuracy * 100).toFixed(1)}% |
                      Profondeur: {modelInfo.training_stats?.tree_depth}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Formulaire de prédiction */}
              <div className="card hover-lift">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  Paramètres de livraison
                </h3>

                <div className="space-y-4">
                  {/* Origine */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Wilaya d'origine
                    </label>
                    <select
                      value={predictionParams.origin}
                      onChange={(e) => setPredictionParams({...predictionParams, origin: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Sélectionnez...</option>
                      {wilayas.map(w => (
                        <option key={w.name} value={w.name}>{w.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Destination */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Wilaya de destination
                    </label>
                    <select
                      value={predictionParams.destination}
                      onChange={(e) => setPredictionParams({...predictionParams, destination: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Sélectionnez...</option>
                      {wilayas.map(w => (
                        <option key={w.name} value={w.name}>{w.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Tonnage */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Tonnage: {predictionParams.cargoTonnes}t
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="100"
                      step="0.5"
                      value={predictionParams.cargoTonnes}
                      onChange={(e) => setPredictionParams({...predictionParams, cargoTonnes: parseFloat(e.target.value)})}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>0.5t</span>
                      <span>100t</span>
                    </div>
                  </div>

                  {/* Type de cargo */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Type de cargo
                    </label>
                    <select
                      value={predictionParams.cargoType}
                      onChange={(e) => setPredictionParams({...predictionParams, cargoType: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="general">Général</option>
                      <option value="refrigerated">Réfrigéré</option>
                      <option value="hazardous">Dangereux</option>
                      <option value="bulk">Vrac</option>
                      <option value="fragile">Fragile</option>
                    </select>
                  </div>

                  {/* Priorité */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Priorité
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 1, label: 'Normal', color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
                        { value: 2, label: 'Urgent', color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' },
                        { value: 3, label: 'Très urgent', color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' }
                      ].map(p => (
                        <button
                          key={p.value}
                          onClick={() => setPredictionParams({...predictionParams, priority: p.value})}
                          className={`px-3 py-2 rounded-lg font-medium transition-all ${
                            predictionParams.priority === p.value
                              ? `${p.color} ring-2 ring-offset-1 ring-purple-500 dark:ring-offset-gray-800`
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Boutons */}
                  <div className="grid grid-cols-2 gap-2 pt-4">
                    <button
                      onClick={handlePredict}
                      disabled={isLoading || !predictionParams.origin || !predictionParams.destination}
                      className="btn-primary flex items-center justify-center gap-2"
                    >
                      <Brain className="w-4 h-4" />
                      Prédire
                    </button>
                    <button
                      onClick={handleCompare}
                      disabled={isLoading || !predictionParams.origin || !predictionParams.destination}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <BarChart3 className="w-4 h-4" />
                      Comparer
                    </button>
                  </div>
                </div>
              </div>

              {/* Résultat de la prédiction */}
              <div className="card hover-lift">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">
                  Résultat de la prédiction
                </h3>

                {isLoading ? (
                  <LoadingSpinner message="Prédiction en cours..." />
                ) : prediction ? (
                  <div className="space-y-4">
                    {/* Mode prédit */}
                    <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-800">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Mode de transport recommandé</p>
                      <div className="flex items-center gap-3">
                        <TransportBadge mode={prediction.predicted_mode} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-gray-800 dark:text-white">
                              {prediction.predicted_mode.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Confiance: {(prediction.confidence * 100).toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Features */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
                        <p className="text-gray-600 dark:text-gray-400">Distance</p>
                        <p className="font-bold dark:text-white">{prediction.input_features.distance_km} km</p>
                      </div>
                      <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
                        <p className="text-gray-600 dark:text-gray-400">Rail disponible</p>
                        <p className="font-bold dark:text-white">{prediction.input_features.rail_available ? 'Oui' : 'Non'}</p>
                      </div>
                      <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
                        <p className="text-gray-600 dark:text-gray-400">Zone origine</p>
                        <p className="font-bold capitalize dark:text-white">{prediction.input_features.origin_zone}</p>
                      </div>
                      <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
                        <p className="text-gray-600 dark:text-gray-400">Zone destination</p>
                        <p className="font-bold capitalize dark:text-white">{prediction.input_features.dest_zone}</p>
                      </div>
                    </div>

                    {/* Probabilités */}
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Probabilités par mode</p>
                      {Object.entries(prediction.all_probabilities || {})
                        .sort((a, b) => b[1] - a[1])
                        .map(([mode, prob]) => (
                          <div key={mode} className="mb-2">
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="capitalize text-gray-700 dark:text-gray-300">{mode.replace('_', ' ')}</span>
                              <span className="font-bold text-purple-600 dark:text-purple-400">{(prob * 100).toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div
                                className="bg-purple-600 dark:bg-purple-500 h-2 rounded-full transition-all"
                                style={{ width: `${prob * 100}%` }}
                              />
                            </div>
                          </div>
                        ))}
                    </div>

                    {/* Bouton explicabilité */}
                    <button
                      onClick={handleExplain}
                      className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center gap-2 transition-colors"
                    >
                      <Info className="w-4 h-4" />
                      Voir le chemin de décision
                    </button>

                    {/* Bouton vers Empreinte CO2 */}
                    <button
                      onClick={handleViewCarbonFromPrediction}
                      disabled={isLoading}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 mt-2 transition-colors"
                    >
                      <Leaf className="w-4 h-4" />
                      Voir Empreinte CO2 & Route
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Brain className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">
                      Sélectionnez les paramètres et cliquez sur "Prédire"
                    </p>
                  </div>
                )}
              </div>

              {/* Comparaison ML vs Expert */}
              {comparison && (
                <div className="card lg:col-span-2 animate-fade-in-up">
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    Comparaison: Machine Learning vs Système Expert
                  </h3>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-800">
                      <h4 className="font-semibold text-purple-700 dark:text-purple-300 mb-2 flex items-center gap-2">
                        <Brain className="w-5 h-5" />
                        Arbre de Décision (ML)
                      </h4>
                      <p className="text-2xl font-bold text-purple-900 dark:text-purple-200 mb-1">
                        {comparison.decision_tree_prediction}
                      </p>
                      <p className="text-sm text-purple-600 dark:text-purple-400">
                        Confiance: {(comparison.decision_tree_confidence * 100).toFixed(1)}%
                      </p>
                    </div>

                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800">
                      <h4 className="font-semibold text-green-700 dark:text-green-300 mb-2 flex items-center gap-2">
                        <Leaf className="w-5 h-5" />
                        Système Expert (Règles)
                      </h4>
                      <p className="text-2xl font-bold text-green-900 dark:text-green-200 mb-1">
                        {comparison.expert_system_recommendation}
                      </p>
                      <p className="text-sm text-green-600 dark:text-green-400">
                        Basé sur 8 règles CO2
                      </p>
                    </div>
                  </div>

                  <div className={`mt-4 p-4 rounded-lg ${
                    comparison.agreement
                      ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-700'
                      : 'bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-200 dark:border-orange-700'
                  }`}>
                    <p className={`font-semibold ${
                      comparison.agreement ? 'text-green-700 dark:text-green-300' : 'text-orange-700 dark:text-orange-300'
                    }`}>
                      {comparison.agreement ? '✓ Les deux méthodes sont en accord' : '⚠ Désaccord entre les méthodes'}
                    </p>
                  </div>
                </div>
              )}

              {/* Explicabilité */}
              {explanation && (
                <div className="card lg:col-span-2 animate-fade-in-up">
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                    <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    Explicabilité: Chemin de décision de l'arbre
                  </h3>

                  <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      L'arbre a appliqué <strong>{explanation.n_rules_applied} règles</strong> pour arriver à la décision:
                      <strong className="ml-2">{explanation.prediction.predicted_mode}</strong>
                    </p>
                  </div>

                  <div className="space-y-2">
                    {explanation.decision_path.map((rule, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {idx + 1}
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 font-mono">{rule}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Importance des features */}
              {modelInfo && (
                <div className="card lg:col-span-2">
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">
                    Importance des Facteurs
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Influence de chaque facteur dans les décisions du modèle
                  </p>
                  <div className="space-y-3">
                    {Object.entries(modelInfo.training_stats?.feature_importance || {})
                      .sort((a, b) => b[1] - a[1])
                      .map(([feature, importance]) => (
                        <div key={feature}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium capitalize text-gray-700 dark:text-gray-300">
                              {feature.replace('_', ' ')}
                            </span>
                            <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
                              {(importance * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                            <div
                              className="bg-gradient-to-r from-purple-500 to-blue-500 h-3 rounded-full transition-all"
                              style={{ width: `${importance * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {/* Tab: Tournée (TSP) */}
        {activeTab === 'tsp' && (
          <div className="space-y-6 animate-fade-in">
            {/* Titre et résumé rapide */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <Route className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                Optimisation de Tournée Multi-Arrêts
              </h2>
              {tspResult && (
                <div className="flex items-center gap-4 text-sm">
                  <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full font-medium">
                    {tspResult.total_distance_km} km
                  </span>
                  {tspResult.total_co2_kg && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full font-medium">
                      {tspResult.total_co2_kg} kg CO2
                    </span>
                  )}
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                    -{tspResult.improvement_percent}% vs direct
                  </span>
                </div>
              )}
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              {/* Contrôles TSP */}
              <div className="lg:col-span-1 space-y-4">
                <div className="card hover-lift">
                  <h3 className="font-bold text-gray-800 dark:text-white mb-3">Configuration</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Sélectionnez les wilayas à visiter pour optimiser l'ordre de passage.
                  </p>

                  <div className="space-y-4">
                    {/* Sélection Wilayas */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Points de passage ({tspParams.selectedWilayas.length})
                      </label>
                      <div className="h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2 space-y-1 bg-gray-50 dark:bg-gray-800">
                        {wilayas.map(w => (
                          <label key={w.name} className="flex items-center p-2 hover:bg-white dark:hover:bg-gray-700 rounded cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={tspParams.selectedWilayas.includes(w.name)}
                              onChange={() => toggleWilayaInTour(w.name)}
                              className="rounded text-purple-600 mr-2"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">{w.name}</span>
                            {tspParams.selectedWilayas.includes(w.name) && (
                              <span className="ml-auto text-xs text-purple-600 dark:text-purple-400">✓</span>
                            )}
                          </label>
                        ))}
                      </div>
                    </div>

                  {/* Dépôt */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Point de départ (Dépôt)
                    </label>
                    <select
                      value={tspParams.depot}
                      onChange={(e) => setTspParams({...tspParams, depot: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Premier point sélectionné</option>
                      {tspParams.selectedWilayas.map(w => (
                        <option key={w} value={w}>{w}</option>
                      ))}
                    </select>
                  </div>

                  {/* Options */}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="returnToDepot"
                      checked={tspParams.returnToDepot}
                      onChange={(e) => setTspParams({...tspParams, returnToDepot: e.target.checked})}
                      className="rounded text-purple-600"
                    />
                    <label htmlFor="returnToDepot" className="text-sm text-gray-700 dark:text-gray-300">
                      Retour au dépôt en fin de tournée
                    </label>
                  </div>

                  {/* Bouton Optimiser */}
                  <button
                    onClick={handleOptimizeTSP}
                    disabled={isLoading || tspParams.selectedWilayas.length < 3}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Optimisation...
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5" />
                        Optimiser la Tournée
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

              {/* Carte avec TSP Routes */}
              <div className="lg:col-span-2">
                <div className="card hover-lift">
                  <h3 className="font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    Carte de la Tournée
                    {tspParams.selectedWilayas.length > 0 && (
                      <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                        ({tspParams.selectedWilayas.length} points sélectionnés)
                      </span>
                    )}
                  </h3>

                  {/* Algeria Map with Official GeoJSON Borders and TSP Routes */}
                  <TSPMapAlgeria
                    wilayas={wilayas}
                    selectedWilayas={tspParams.selectedWilayas}
                    tspResult={tspResult}
                    onWilayaClick={toggleWilayaInTour}
                  />
                </div>
              </div>
            </div>

            {/* Itinéraire détaillé - Affiché en dessous */}
            {tspResult && (
              <div className="card animate-fade-in-up">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  Itinéraire Optimisé Détaillé
                  <span className="ml-auto text-sm font-normal text-gray-500 dark:text-gray-400">
                    {tspResult.optimized_route.length} arrêts • {tspResult.total_distance_km} km total
                  </span>
                </h3>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tspResult.segments.map((segment, idx) => (
                    <div key={idx} className="bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/20 dark:to-gray-800 p-4 rounded-lg border border-purple-100 dark:border-purple-800 hover:shadow-md transition-shadow">
                      <div className="flex items-start gap-3">
                        <div className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-gray-800 dark:text-white truncate">{segment.from}</span>
                            <span className="text-purple-500 dark:text-purple-400">→</span>
                            <span className="font-bold text-gray-800 dark:text-white truncate">{segment.to}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-mono text-purple-700 dark:text-purple-300 font-medium">{segment.distance_km} km</span>
                            {segment.recommended_mode && (
                              <>
                                <span className="text-gray-300 dark:text-gray-600">|</span>
                                <span className="px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium text-xs uppercase">
                                  {segment.recommended_mode.replace('_', ' ')}
                                </span>
                                <span className="text-gray-500 dark:text-gray-400 text-xs">
                                  {segment.co2_kg} kg CO2
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Destination finale */}
                  <div className="bg-gradient-to-br from-green-50 to-white dark:from-green-900/20 dark:to-gray-800 p-4 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-3">
                      <div className="bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg flex-shrink-0">
                        🏁
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Destination Finale</p>
                        <p className="font-bold text-gray-800 dark:text-white">
                          {tspResult.optimized_route[tspResult.optimized_route.length - 1]}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab: Statistiques */}
        {activeTab === 'stats' && (
          <div className="space-y-6 animate-fade-in">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-green-600 dark:text-green-400" />
              Tableau de Bord Logistique
            </h2>

            {/* KPIs */}
            <div className="grid md:grid-cols-3 gap-6">
              <div className="card bg-gradient-to-br from-green-50 to-white dark:from-green-900/20 dark:to-gray-800 hover-lift">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full text-green-600 dark:text-green-400">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Couverture Réseau</p>
                    <p className="text-2xl font-bold text-gray-800 dark:text-white">{wilayas.length} Wilayas</p>
                  </div>
                </div>
              </div>

              <div className="card bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-gray-800 hover-lift">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400">
                    <Truck className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Demande Totale Estimée</p>
                    <p className="text-2xl font-bold text-gray-800 dark:text-white">
                      {wilayas.reduce((acc, w) => acc + (w.demand_tonnes || 0), 0).toLocaleString()} tonnes
                    </p>
                  </div>
                </div>
              </div>

              <div className="card bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/20 dark:to-gray-800 hover-lift">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full text-purple-600 dark:text-purple-400">
                    <Train className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Accès Ferroviaire</p>
                    <p className="text-2xl font-bold text-gray-800 dark:text-white">
                      {wilayas.filter(w => w.rail_access).length} Wilayas
                    </p>
                    <p className="text-xs text-purple-600 dark:text-purple-400">
                      {Math.round((wilayas.filter(w => w.rail_access).length / wilayas.length) * 100)}% du réseau
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Répartition par Zone */}
              <div className="card hover-lift">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Répartition Géographique</h3>
                <ZoneDistributionChart wilayas={wilayas} />
                <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                  <p>• <strong>Nord:</strong> Forte densité, accès rail optimal</p>
                  <p>• <strong>Hauts-Plateaux:</strong> Zone de transit stratégique</p>
                  <p>• <strong>Sud:</strong> Longues distances, contraintes logistiques fortes</p>
                </div>
              </div>

              {/* Facteurs d'émission (Info statique) */}
              <div className="card hover-lift">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Facteurs d'Émission CO2 de Référence</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800">
                    <div className="flex items-center gap-3">
                      <Train className="w-5 h-5 text-green-600 dark:text-green-400" />
                      <span className="font-medium text-gray-700 dark:text-gray-300">Train Diesel</span>
                    </div>
                    <span className="font-bold text-green-700 dark:text-green-400">0.020 kg CO2/t.km</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-100 dark:border-orange-800">
                    <div className="flex items-center gap-3">
                      <Truck className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                      <span className="font-medium text-gray-700 dark:text-gray-300">Camion Lourd (&gt;20t)</span>
                    </div>
                    <span className="font-bold text-orange-700 dark:text-orange-400">0.062 kg CO2/t.km</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-800">
                    <div className="flex items-center gap-3">
                      <Truck className="w-5 h-5 text-red-600 dark:text-red-400" />
                      <span className="font-medium text-gray-700 dark:text-gray-300">Camion Léger (&lt;3.5t)</span>
                    </div>
                    <span className="font-bold text-red-700 dark:text-red-400">0.550 kg CO2/t.km</span>
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-800 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                    <p>
                      <strong>Note:</strong> Ces facteurs sont ajustés dynamiquement par le système expert selon:
                    </p>
                    <ul className="list-disc ml-5 mt-1 space-y-1">
                      <li>La topographie (Nord vs Sud)</li>
                      <li>Le taux de remplissage du véhicule</li>
                      <li>Le type de carburant et l'état du réseau</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 dark:bg-gray-950 text-gray-300 py-8 mt-12 transition-colors">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm">
            Eco-Logistics Algeria - Système d'Optimisation Hybride et Multi-Objectif
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-600 mt-2">
            Modules: K-Means Clustering | Système Expert CO2 | NSGA-II Multi-Objectif | Decision Tree ML
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
