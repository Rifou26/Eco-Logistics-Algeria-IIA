/**
 * Configuration de l'API backend
 */

const API_BASE_URL = 'http://localhost:8000';

/**
 * Client API pour Eco-Logistics Algeria
 */
export const api = {
  /**
   * Récupère toutes les wilayas
   */
  async getWilayas() {
    const response = await fetch(`${API_BASE_URL}/wilayas`);
    if (!response.ok) throw new Error('Erreur lors du chargement des wilayas');
    return response.json();
  },

  /**
   * Effectue le clustering K-Means
   */
  async performClustering(nClusters = 6, weightDemand = 0.3) {
    const response = await fetch(`${API_BASE_URL}/clustering`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        n_clusters: nClusters,
        weight_demand: weightDemand
      })
    });
    if (!response.ok) throw new Error('Erreur lors du clustering');
    return response.json();
  },

  /**
   * Optimise le nombre de clusters
   */
  async optimizeK(minK = 3, maxK = 10) {
    const response = await fetch(
      `${API_BASE_URL}/clustering/optimize-k?min_k=${minK}&max_k=${maxK}`
    );
    if (!response.ok) throw new Error('Erreur lors de l\'optimisation K');
    return response.json();
  },

  /**
   * Calcule l'empreinte carbone
   */
  async calculateCarbon(origin, destination, mode, cargoTonnes, cargoType = 'general') {
    const response = await fetch(`${API_BASE_URL}/carbon/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin,
        destination,
        transport_mode: mode,
        cargo_tonnes: cargoTonnes,
        vehicle_capacity: 25,
        cargo_type: cargoType
      })
    });
    if (!response.ok) throw new Error('Erreur lors du calcul CO2');
    return response.json();
  },

  /**
   * Compare les modes de transport
   */
  async compareTransportModes(origin, destination, cargoTonnes, cargoType = 'general') {
    const response = await fetch(`${API_BASE_URL}/carbon/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin,
        destination,
        cargo_tonnes: cargoTonnes,
        cargo_type: cargoType
      })
    });
    if (!response.ok) throw new Error('Erreur lors de la comparaison');
    return response.json();
  },

  /**
   * Lance l'optimisation multi-objectif
   */
  async optimize(requests, alpha = 0.5, hubs = null, popSize = 50, generations = 30) {
    const response = await fetch(`${API_BASE_URL}/optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests,
        alpha,
        hubs,
        population_size: popSize,
        generations
      })
    });
    if (!response.ok) throw new Error('Erreur lors de l\'optimisation');
    return response.json();
  },

  /**
   * Génère des données de test et optimise
   */
  async generateAndOptimize(nRequests = 20, seed = 42) {
    const response = await fetch(`${API_BASE_URL}/optimize/sample`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        n_requests: nRequests,
        seed
      })
    });
    if (!response.ok) throw new Error('Erreur lors de la génération');
    return response.json();
  },

  /**
   * Génère la courbe de Pareto
   */
  async getParetoCurve(nRequests = 15, alphaSteps = 5) {
    const response = await fetch(
      `${API_BASE_URL}/optimize/pareto-curve?n_requests=${nRequests}&alpha_steps=${alphaSteps}`
    );
    if (!response.ok) throw new Error('Erreur lors de la génération Pareto');
    return response.json();
  },

  // ============================================================================
  // Module D: Routing OSRM (Itinéraires Réels)
  // ============================================================================

  /**
   * Obtient l'itinéraire réel entre deux wilayas
   */
  async getRoute(origin, destination) {
    const response = await fetch(`${API_BASE_URL}/routing/route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, destination })
    });
    if (!response.ok) throw new Error('Erreur lors du calcul de route');
    return response.json();
  },

  /**
   * Obtient l'itinéraire passant par plusieurs wilayas
   */
  async getMultiRoute(waypoints) {
    const response = await fetch(`${API_BASE_URL}/routing/multi-route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ waypoints })
    });
    if (!response.ok) throw new Error('Erreur lors du calcul de route multi-points');
    return response.json();
  },

  /**
   * Obtient les routes réelles pour tous les clusters
   */
  async getClusterRoutes(nClusters = 6) {
    const response = await fetch(
      `${API_BASE_URL}/routing/cluster-routes?n_clusters=${nClusters}`
    );
    if (!response.ok) throw new Error('Erreur lors du chargement des routes');
    return response.json();
  },

  // ============================================================================
  // Module E: Decision Tree (Prédiction Mode de Transport)
  // ============================================================================

  /**
   * Prédit le mode de transport optimal via arbre de décision
   */
  async predictTransportMode(origin, destination, cargoTonnes, cargoType = 'general', priority = 1) {
    const response = await fetch(`${API_BASE_URL}/predict/transport-mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin,
        destination,
        cargo_tonnes: cargoTonnes,
        cargo_type: cargoType,
        priority
      })
    });
    if (!response.ok) throw new Error('Erreur lors de la prédiction');
    return response.json();
  },

  /**
   * Compare la prédiction ML avec le système expert
   */
  async comparePredictionMethods(origin, destination, cargoTonnes, cargoType = 'general', priority = 1) {
    const response = await fetch(`${API_BASE_URL}/predict/compare-methods`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin,
        destination,
        cargo_tonnes: cargoTonnes,
        cargo_type: cargoType,
        priority
      })
    });
    if (!response.ok) throw new Error('Erreur lors de la comparaison');
    return response.json();
  },

  /**
   * Explique le chemin de décision de l'arbre
   */
  async explainPrediction(origin, destination, cargoTonnes, cargoType = 'general', priority = 1) {
    const response = await fetch(`${API_BASE_URL}/predict/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin,
        destination,
        cargo_tonnes: cargoTonnes,
        cargo_type: cargoType,
        priority
      })
    });
    if (!response.ok) throw new Error('Erreur lors de l\'explication');
    return response.json();
  },

  /**
   * Obtient les informations du modèle
   */
  async getModelInfo() {
    const response = await fetch(`${API_BASE_URL}/predict/model-info`);
    if (!response.ok) throw new Error('Erreur lors du chargement des infos');
    return response.json();
  },

  // ============================================================================
  // Module F: TSP Optimizer (Optimisation Multi-Arrêts)
  // ============================================================================

  /**
   * Optimise l'ordre des arrêts (TSP)
   */
  async optimizeTSP(wilayas, depot = null, returnToDepot = true) {
    const response = await fetch(`${API_BASE_URL}/tsp/optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wilayas,
        depot,
        return_to_depot: returnToDepot
      })
    });
    if (!response.ok) throw new Error('Erreur lors de l\'optimisation TSP');
    return response.json();
  },

  /**
   * Optimise la tournée avec calcul CO2
   */
  async optimizeTSPWithCarbon(wilayas, depot = null, returnToDepot = true, cargoTonnes = 20, cargoType = 'general') {
    const response = await fetch(`${API_BASE_URL}/tsp/optimize-with-carbon`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wilayas,
        depot,
        return_to_depot: returnToDepot,
        cargo_tonnes: cargoTonnes,
        cargo_type: cargoType
      })
    });
    if (!response.ok) throw new Error('Erreur lors de l\'optimisation TSP avec CO2');
    return response.json();
  }
};

export default api;
