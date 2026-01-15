"""
API REST FastAPI pour Eco-Logistics Algeria

Cette API expose les trois modules d'IA:
- Module A: Clustering K-Means (segmentation territoriale)
- Module B: Système expert CO2
- Module C: Optimiseur NSGA-II

Routes principales:
- GET /wilayas - Liste des 58 wilayas
- POST /clustering - Segmentation territoriale
- POST /carbon - Calcul empreinte CO2
- POST /optimize - Optimisation multi-objectif
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum
import sys
import os

# Ajouter le chemin parent pour les imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from data.wilayas_algeria import get_all_wilayas, WILAYAS_DATA, calculate_distance
from modules.clustering import TerritorialSegmentation, optimize_n_clusters
from modules.carbon_expert import (
    CarbonExpertSystem, TransportContext, TransportMode, CargoType, Zone
)
from modules.optimizer import (
    MultiObjectiveOptimizer, DeliveryRequest, generate_sample_requests
)
from modules.routing import OSRMRouter
from modules.decision_tree_transport import TransportModePredictor, TransportPredictionInput
from modules.tsp_optimizer import TSPOptimizer, optimize_delivery_tour


# ============================================================================
# Configuration FastAPI
# ============================================================================

app = FastAPI(
    title="Eco-Logistics Algeria API",
    description="""
    API d'optimisation hybride et multi-objectif (Coût/Carbone)
    de la chaîne logistique nationale algérienne.

    ## Modules disponibles:
    - **Clustering**: Segmentation territoriale K-Means
    - **Carbon Expert**: Système expert pour calcul CO2
    - **Optimizer**: Optimisation NSGA-II multi-objectif
    - **Decision Tree**: Prédiction ML du mode de transport optimal
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS pour le frontend React
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# Modèles Pydantic
# ============================================================================

class TransportModeEnum(str, Enum):
    train = "train"
    truck_small = "truck_small"
    truck_medium = "truck_medium"
    truck_large = "truck_large"
    multimodal = "multimodal"


class CargoTypeEnum(str, Enum):
    general = "general"
    refrigerated = "refrigerated"
    hazardous = "hazardous"
    bulk = "bulk"
    fragile = "fragile"


class ClusteringRequest(BaseModel):
    n_clusters: int = Field(6, ge=2, le=15, description="Nombre de hubs régionaux")
    weight_demand: float = Field(0.3, ge=0, le=1, description="Poids de la demande dans le clustering")


class CarbonRequest(BaseModel):
    origin: str = Field(..., description="Wilaya d'origine")
    destination: str = Field(..., description="Wilaya de destination")
    transport_mode: TransportModeEnum = Field(..., description="Mode de transport")
    cargo_tonnes: float = Field(..., gt=0, description="Tonnage à transporter")
    vehicle_capacity: float = Field(25, gt=0, description="Capacité du véhicule")
    cargo_type: CargoTypeEnum = Field(CargoTypeEnum.general, description="Type de cargo")


class CarbonCompareRequest(BaseModel):
    origin: str
    destination: str
    cargo_tonnes: float = Field(..., gt=0)
    cargo_type: CargoTypeEnum = Field(CargoTypeEnum.general)


class RouteRequest(BaseModel):
    route: List[str] = Field(..., min_length=2, description="Liste des wilayas de la route")
    cargo_tonnes: float = Field(..., gt=0)
    transport_mode: TransportModeEnum
    cargo_type: CargoTypeEnum = Field(CargoTypeEnum.general)


class DeliveryRequestModel(BaseModel):
    id: int
    origin: str
    destination: str
    cargo_tonnes: float = Field(..., gt=0)
    cargo_type: CargoTypeEnum = Field(CargoTypeEnum.general)
    priority: int = Field(1, ge=1, le=3)


class OptimizeRequest(BaseModel):
    requests: List[DeliveryRequestModel] = Field(..., min_length=1)
    hubs: Optional[List[str]] = Field(None, description="Hubs disponibles (auto si vide)")
    alpha: float = Field(0.5, ge=0, le=1, description="Curseur coût(1)/CO2(0)")
    population_size: int = Field(50, ge=10, le=200)
    generations: int = Field(30, ge=10, le=100)


class GenerateSampleRequest(BaseModel):
    n_requests: int = Field(20, ge=5, le=100)
    seed: int = Field(42)


class TransportPredictionRequest(BaseModel):
    origin: str = Field(..., description="Wilaya d'origine")
    destination: str = Field(..., description="Wilaya de destination")
    cargo_tonnes: float = Field(..., gt=0, description="Tonnage à transporter")
    cargo_type: CargoTypeEnum = Field(CargoTypeEnum.general, description="Type de cargo")
    priority: int = Field(1, ge=1, le=3, description="Priorité (1=normal, 2=urgent, 3=très urgent)")


class BatchPredictionRequest(BaseModel):
    predictions: List[TransportPredictionRequest] = Field(..., min_length=1, max_length=100)


# ============================================================================
# Routes - Données de base
# ============================================================================

@app.get("/", tags=["Info"])
async def root():
    """Point d'entrée de l'API."""
    return {
        "name": "Eco-Logistics Algeria API",
        "version": "1.0.0",
        "modules": ["clustering", "carbon", "optimize"],
        "wilayas_count": len(WILAYAS_DATA)
    }


@app.get("/health", tags=["Info"])
async def health_check():
    """Vérification de l'état de l'API."""
    return {"status": "healthy", "modules_loaded": True}


@app.get("/wilayas", tags=["Données"])
async def get_wilayas():
    """Retourne la liste des 58 wilayas avec leurs données."""
    return {
        "count": len(WILAYAS_DATA),
        "wilayas": get_all_wilayas()
    }


@app.get("/wilayas/{name}", tags=["Données"])
async def get_wilaya(name: str):
    """Retourne les informations d'une wilaya spécifique."""
    if name not in WILAYAS_DATA:
        raise HTTPException(status_code=404, detail=f"Wilaya '{name}' non trouvée")

    data = WILAYAS_DATA[name]
    return {
        "name": name,
        "latitude": data[0],
        "longitude": data[1],
        "population": data[2],
        "demand_tonnes": data[3],
        "zone": data[4],
        "rail_access": data[5]
    }


@app.get("/distance", tags=["Données"])
async def get_distance(
    origin: str = Query(..., description="Wilaya d'origine"),
    destination: str = Query(..., description="Wilaya de destination")
):
    """Calcule la distance entre deux wilayas."""
    if origin not in WILAYAS_DATA:
        raise HTTPException(status_code=404, detail=f"Origine '{origin}' non trouvée")
    if destination not in WILAYAS_DATA:
        raise HTTPException(status_code=404, detail=f"Destination '{destination}' non trouvée")

    distance = calculate_distance(origin, destination)
    return {
        "origin": origin,
        "destination": destination,
        "distance_km": round(distance, 2)
    }


# ============================================================================
# Routes - Module A: Clustering
# ============================================================================

@app.post("/clustering", tags=["Module A: Clustering"])
async def perform_clustering(request: ClusteringRequest):
    """
    Effectue la segmentation territoriale K-Means.

    Retourne les clusters avec leurs hubs régionaux assignés.
    """
    try:
        segmentation = TerritorialSegmentation(
            n_clusters=request.n_clusters,
            random_state=42
        )
        segmentation.fit(weight_demand=request.weight_demand)

        return {
            "success": True,
            **segmentation.to_json()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/clustering/optimize-k", tags=["Module A: Clustering"])
async def optimize_clusters(
    min_k: int = Query(3, ge=2, le=10),
    max_k: int = Query(10, ge=3, le=15)
):
    """
    Trouve le nombre optimal de clusters (méthode du coude).
    """
    try:
        result = optimize_n_clusters(min_k, max_k)
        return {
            "success": True,
            **result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Routes - Module B: Carbon Expert
# ============================================================================

@app.post("/carbon/calculate", tags=["Module B: Carbon Expert"])
async def calculate_carbon(request: CarbonRequest):
    """
    Calcule l'empreinte carbone d'un transport.
    """
    if request.origin not in WILAYAS_DATA:
        raise HTTPException(status_code=404, detail=f"Origine '{request.origin}' non trouvée")
    if request.destination not in WILAYAS_DATA:
        raise HTTPException(status_code=404, detail=f"Destination '{request.destination}' non trouvée")

    try:
        expert = CarbonExpertSystem()

        context = TransportContext(
            origin=request.origin,
            destination=request.destination,
            transport_mode=TransportMode(request.transport_mode.value),
            cargo_tonnes=request.cargo_tonnes,
            vehicle_capacity=request.vehicle_capacity,
            cargo_type=CargoType(request.cargo_type.value)
        )

        result = expert.calculate_carbon_footprint(context)
        return {"success": True, **result}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/carbon/compare", tags=["Module B: Carbon Expert"])
async def compare_transport_modes(request: CarbonCompareRequest):
    """
    Compare l'empreinte CO2 de tous les modes de transport pour un trajet.
    """
    if request.origin not in WILAYAS_DATA:
        raise HTTPException(status_code=404, detail=f"Origine '{request.origin}' non trouvée")
    if request.destination not in WILAYAS_DATA:
        raise HTTPException(status_code=404, detail=f"Destination '{request.destination}' non trouvée")

    try:
        expert = CarbonExpertSystem()
        result = expert.compare_transport_modes(
            origin=request.origin,
            destination=request.destination,
            cargo_tonnes=request.cargo_tonnes,
            cargo_type=CargoType(request.cargo_type.value)
        )
        return {"success": True, **result}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/carbon/route", tags=["Module B: Carbon Expert"])
async def calculate_route_carbon(request: RouteRequest):
    """
    Calcule l'empreinte carbone d'une route multi-étapes.
    """
    # Valider les wilayas
    for wilaya in request.route:
        if wilaya not in WILAYAS_DATA:
            raise HTTPException(status_code=404, detail=f"Wilaya '{wilaya}' non trouvée")

    try:
        expert = CarbonExpertSystem()
        result = expert.calculate_route_footprint(
            route=request.route,
            cargo_tonnes=request.cargo_tonnes,
            transport_mode=TransportMode(request.transport_mode.value),
            cargo_type=CargoType(request.cargo_type.value)
        )
        return {"success": True, **result}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Routes - Module C: Optimizer
# ============================================================================

@app.post("/optimize", tags=["Module C: Optimizer"])
async def optimize_logistics(request: OptimizeRequest):
    """
    Optimisation multi-objectif NSGA-II (Coût vs CO2).

    Retourne le front de Pareto avec la solution recommandée selon alpha.
    """
    # Valider les wilayas
    for req in request.requests:
        if req.origin not in WILAYAS_DATA:
            raise HTTPException(status_code=404, detail=f"Origine '{req.origin}' non trouvée")
        if req.destination not in WILAYAS_DATA:
            raise HTTPException(status_code=404, detail=f"Destination '{req.destination}' non trouvée")

    try:
        # Convertir les modèles Pydantic en objets DeliveryRequest
        delivery_requests = [
            DeliveryRequest(
                id=req.id,
                origin=req.origin,
                destination=req.destination,
                cargo_tonnes=req.cargo_tonnes,
                cargo_type=CargoType(req.cargo_type.value),
                priority=req.priority
            )
            for req in request.requests
        ]

        optimizer = MultiObjectiveOptimizer(
            requests=delivery_requests,
            hubs=request.hubs,
            population_size=request.population_size,
            generations=request.generations
        )

        result = optimizer.optimize(alpha=request.alpha, verbose=False)

        return {
            "success": True,
            **result
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/optimize/sample", tags=["Module C: Optimizer"])
async def generate_and_optimize(request: GenerateSampleRequest):
    """
    Génère des demandes de test et lance l'optimisation.
    Utile pour la démonstration.
    """
    try:
        # Générer des demandes
        requests = generate_sample_requests(
            n_requests=request.n_requests,
            seed=request.seed
        )

        # Convertir en format JSON
        requests_json = [
            {
                "id": req.id,
                "origin": req.origin,
                "destination": req.destination,
                "cargo_tonnes": req.cargo_tonnes,
                "cargo_type": req.cargo_type.value,
                "priority": req.priority
            }
            for req in requests
        ]

        # Optimiser avec alpha = 0.5
        optimizer = MultiObjectiveOptimizer(
            requests=requests,
            population_size=50,
            generations=30
        )

        result = optimizer.optimize(alpha=0.5, verbose=False)

        return {
            "success": True,
            "generated_requests": requests_json,
            "optimization_result": result
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/optimize/pareto-curve", tags=["Module C: Optimizer"])
async def get_sample_pareto_curve(
    n_requests: int = Query(15, ge=5, le=50),
    alpha_steps: int = Query(5, ge=3, le=10)
):
    """
    Génère une courbe de Pareto en faisant varier alpha.
    Utile pour visualiser le compromis coût/CO2.
    """
    try:
        requests = generate_sample_requests(n_requests=n_requests, seed=42)

        results = []
        for i in range(alpha_steps + 1):
            alpha = i / alpha_steps

            optimizer = MultiObjectiveOptimizer(
                requests=requests,
                population_size=30,
                generations=20
            )

            result = optimizer.optimize(alpha=alpha, verbose=False)

            if result["recommended_solution"]:
                results.append({
                    "alpha": alpha,
                    "cost_dzd": result["recommended_solution"]["total_cost_dzd"],
                    "co2_kg": result["recommended_solution"]["total_co2_kg"]
                })

        return {
            "success": True,
            "curve": results
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Routes - Module D: Routing OSRM (Itinéraires Réels)
# ============================================================================

# Instance globale du routeur
osrm_router = OSRMRouter(timeout=15.0)


class SimpleRouteRequest(BaseModel):
    origin: str = Field(..., description="Wilaya d'origine")
    destination: str = Field(..., description="Wilaya de destination")


class MultiRouteRequest(BaseModel):
    waypoints: List[str] = Field(..., min_length=2, description="Liste des wilayas")


@app.post("/routing/route", tags=["Module D: Routing OSRM"])
async def get_real_route(request: SimpleRouteRequest):
    """
    Obtient l'itinéraire réel entre deux wilayas via OSRM.

    Retourne la géométrie de la route (polyline), la distance réelle
    et le temps de trajet estimé.
    """
    if request.origin not in WILAYAS_DATA:
        raise HTTPException(status_code=404, detail=f"Origine '{request.origin}' non trouvée")
    if request.destination not in WILAYAS_DATA:
        raise HTTPException(status_code=404, detail=f"Destination '{request.destination}' non trouvée")

    try:
        result = await osrm_router.get_route_async(request.origin, request.destination)

        return {
            "success": result.success,
            "origin": result.origin,
            "destination": result.destination,
            "distance_km": result.distance_km,
            "duration_minutes": result.duration_minutes,
            "geometry": result.geometry,
            "waypoints": result.waypoints,
            "error": result.error
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/routing/multi-route", tags=["Module D: Routing OSRM"])
async def get_multi_point_route(request: MultiRouteRequest):
    """
    Obtient l'itinéraire passant par plusieurs wilayas.

    Retourne la géométrie complète de la route avec les détails
    de chaque segment.
    """
    # Valider les wilayas
    for wilaya in request.waypoints:
        if wilaya not in WILAYAS_DATA:
            raise HTTPException(status_code=404, detail=f"Wilaya '{wilaya}' non trouvée")

    try:
        result = await osrm_router.get_multi_route_async(request.waypoints)
        return {"success": True, **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/routing/cluster-routes", tags=["Module D: Routing OSRM"])
async def get_cluster_routes(n_clusters: int = Query(6, ge=2, le=10)):
    """
    Génère les routes réelles entre chaque hub et les wilayas de son cluster.

    Utile pour visualiser le réseau logistique complet sur la carte.
    """
    try:
        # Effectuer le clustering
        segmentation = TerritorialSegmentation(n_clusters=n_clusters)
        segmentation.fit()
        clusters = segmentation.get_clusters()

        routes = []

        for cluster in clusters:
            hub_name = cluster["hub_name"]

            for wilaya_name in cluster["wilayas_covered"]:
                if wilaya_name == hub_name:
                    continue

                route = await osrm_router.get_route_async(hub_name, wilaya_name)

                routes.append({
                    "cluster_id": cluster["cluster_id"],
                    "hub": hub_name,
                    "wilaya": wilaya_name,
                    "distance_km": route.distance_km,
                    "duration_minutes": route.duration_minutes,
                    "geometry": route.geometry,
                    "success": route.success
                })

        return {
            "success": True,
            "n_clusters": n_clusters,
            "total_routes": len(routes),
            "routes": routes
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Routes - Module F: TSP Optimizer (Optimisation Multi-Arrêts)
# ============================================================================

class TSPRequest(BaseModel):
    wilayas: List[str] = Field(..., min_length=3, description="Liste des wilayas à visiter (minimum 3)")
    depot: Optional[str] = Field(None, description="Wilaya du dépôt (point de départ)")
    return_to_depot: bool = Field(True, description="Retourner au dépôt après la tournée")


class TSPWithCarbonRequest(BaseModel):
    wilayas: List[str] = Field(..., min_length=3, description="Liste des wilayas à visiter")
    depot: Optional[str] = Field(None, description="Wilaya du dépôt")
    return_to_depot: bool = Field(True, description="Retourner au dépôt")
    cargo_tonnes: float = Field(20.0, ge=0.5, le=100, description="Tonnage de cargo")
    cargo_type: CargoTypeEnum = Field(CargoTypeEnum.general, description="Type de cargo")


@app.post("/tsp/optimize", tags=["Module F: TSP Optimizer"])
async def optimize_tsp_route(request: TSPRequest):
    """
    Optimise l'ordre des arrêts pour minimiser la distance totale (Traveling Salesman Problem).

    Utilise un algorithme génétique pour trouver l'ordre optimal des wilayas
    à visiter en minimisant la distance totale parcourue.
    """
    # Validation des wilayas
    for w in request.wilayas:
        if w not in WILAYAS_DATA:
            raise HTTPException(status_code=404, detail=f"Wilaya '{w}' non trouvée")

    if request.depot and request.depot not in WILAYAS_DATA:
        raise HTTPException(status_code=404, detail=f"Dépôt '{request.depot}' non trouvé")

    try:
        result = optimize_delivery_tour(
            wilayas=request.wilayas,
            depot=request.depot,
            return_to_depot=request.return_to_depot
        )

        return {
            "success": result.success,
            "optimized_route": result.optimized_route,
            "total_distance_km": result.total_distance_km,
            "original_distance_km": result.original_distance_km,
            "improvement_percent": result.improvement_percent,
            "distances_per_leg": result.distances_per_leg,
            "computation_time_ms": result.computation_time_ms,
            "n_stops": len(result.optimized_route),
            "error": result.error
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/tsp/optimize-with-carbon", tags=["Module F: TSP Optimizer"])
async def optimize_tsp_with_carbon(request: TSPWithCarbonRequest):
    """
    Optimise la tournée ET calcule l'empreinte carbone totale.

    Combine l'optimisation TSP avec le système expert CO2 pour fournir
    une analyse complète de la tournée optimisée.
    """
    # Validation des wilayas
    for w in request.wilayas:
        if w not in WILAYAS_DATA:
            raise HTTPException(status_code=404, detail=f"Wilaya '{w}' non trouvée")

    try:
        # 1. Optimiser la route
        tsp_result = optimize_delivery_tour(
            wilayas=request.wilayas,
            depot=request.depot,
            return_to_depot=request.return_to_depot
        )

        if not tsp_result.success:
            raise HTTPException(status_code=400, detail=tsp_result.error)

        # 2. Calculer le CO2 pour chaque segment avec le mode optimal
        expert = CarbonExpertSystem()
        segments_with_carbon = []
        total_co2 = 0.0

        for leg in tsp_result.distances_per_leg:
            # Comparer les modes pour ce segment
            comparison_result = expert.compare_transport_modes(
                origin=leg["from"],
                destination=leg["to"],
                cargo_tonnes=request.cargo_tonnes,
                cargo_type=request.cargo_type.value
            )

            # Accéder aux résultats de comparaison
            modes_data = comparison_result.get("comparison", {})

            # Trouver le mode le plus écologique
            best_mode = min(
                [(mode, data) for mode, data in modes_data.items() if not data.get("error")],
                key=lambda x: x[1]["total_co2_kg"],
                default=(None, None)
            )

            if best_mode[0]:
                segment_co2 = best_mode[1]["total_co2_kg"]
                total_co2 += segment_co2
                segments_with_carbon.append({
                    **leg,
                    "recommended_mode": str(best_mode[0]),
                    "co2_kg": float(round(segment_co2, 2)),
                    "all_modes": {k: float(v["total_co2_kg"]) for k, v in modes_data.items() if not v.get("error")}
                })

        return {
            "success": True,
            "optimized_route": tsp_result.optimized_route,
            "total_distance_km": float(tsp_result.total_distance_km),
            "total_co2_kg": float(round(total_co2, 2)),
            "improvement_percent": float(tsp_result.improvement_percent),
            "segments": segments_with_carbon,
            "cargo_tonnes": float(request.cargo_tonnes),
            "cargo_type": request.cargo_type.value,
            "computation_time_ms": float(tsp_result.computation_time_ms)
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Routes - Module E: Decision Tree (Prédiction Mode de Transport)
# ============================================================================

# Instance globale du prédicteur (entraîné au démarrage)
transport_predictor = TransportModePredictor(max_depth=12, min_samples_split=10, min_samples_leaf=5)

# Entraîner le modèle au démarrage
@app.on_event("startup")
async def train_decision_tree():
    """Entraîne le modèle d'arbre de décision au démarrage de l'API."""
    print("Entrainement du modele Decision Tree...")
    transport_predictor.train(n_samples=5000, verbose=False)
    print("Modele Decision Tree pret!")


@app.post("/predict/transport-mode", tags=["Module E: Decision Tree"])
async def predict_transport_mode(request: TransportPredictionRequest):
    """
    Prédit le mode de transport optimal en utilisant un arbre de décision.

    Le modèle a été entraîné sur des données simulées basées sur les règles
    du système expert et prend en compte: distance, zones, tonnage, type de cargo,
    urgence et disponibilité du rail.
    """
    if request.origin not in WILAYAS_DATA:
        raise HTTPException(status_code=404, detail=f"Origine '{request.origin}' non trouvée")
    if request.destination not in WILAYAS_DATA:
        raise HTTPException(status_code=404, detail=f"Destination '{request.destination}' non trouvée")

    try:
        input_data = TransportPredictionInput(
            origin=request.origin,
            destination=request.destination,
            cargo_tonnes=request.cargo_tonnes,
            cargo_type=request.cargo_type.value,
            priority=request.priority
        )

        result = transport_predictor.predict(input_data)
        return {"success": True, **result}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/predict/transport-mode/batch", tags=["Module E: Decision Tree"])
async def predict_transport_mode_batch(request: BatchPredictionRequest):
    """
    Prédit le mode de transport optimal pour plusieurs livraisons en batch.
    """
    # Valider toutes les wilayas
    for pred in request.predictions:
        if pred.origin not in WILAYAS_DATA:
            raise HTTPException(status_code=404, detail=f"Origine '{pred.origin}' non trouvée")
        if pred.destination not in WILAYAS_DATA:
            raise HTTPException(status_code=404, detail=f"Destination '{pred.destination}' non trouvée")

    try:
        inputs = [
            TransportPredictionInput(
                origin=pred.origin,
                destination=pred.destination,
                cargo_tonnes=pred.cargo_tonnes,
                cargo_type=pred.cargo_type.value,
                priority=pred.priority
            )
            for pred in request.predictions
        ]

        results = transport_predictor.predict_batch(inputs)
        return {
            "success": True,
            "count": len(results),
            "predictions": results
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/predict/compare-methods", tags=["Module E: Decision Tree"])
async def compare_prediction_methods(request: TransportPredictionRequest):
    """
    Compare la prédiction de l'arbre de décision avec le système expert.

    Permet de voir si les deux approches (ML vs règles) arrivent à la même
    conclusion et d'analyser les différences.
    """
    if request.origin not in WILAYAS_DATA:
        raise HTTPException(status_code=404, detail=f"Origine '{request.origin}' non trouvée")
    if request.destination not in WILAYAS_DATA:
        raise HTTPException(status_code=404, detail=f"Destination '{request.destination}' non trouvée")

    try:
        comparison = transport_predictor.compare_with_expert_system(
            origin=request.origin,
            destination=request.destination,
            cargo_tonnes=request.cargo_tonnes,
            cargo_type=request.cargo_type.value
        )

        return {"success": True, **comparison}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/predict/explain", tags=["Module E: Decision Tree"])
async def explain_prediction(request: TransportPredictionRequest):
    """
    Explique le chemin de décision de l'arbre pour une prédiction.

    Retourne les règles successives appliquées pour arriver à la décision,
    permettant une interprétation complète du modèle (explicabilité IA).
    """
    if request.origin not in WILAYAS_DATA:
        raise HTTPException(status_code=404, detail=f"Origine '{request.origin}' non trouvée")
    if request.destination not in WILAYAS_DATA:
        raise HTTPException(status_code=404, detail=f"Destination '{request.destination}' non trouvée")

    try:
        input_data = TransportPredictionInput(
            origin=request.origin,
            destination=request.destination,
            cargo_tonnes=request.cargo_tonnes,
            cargo_type=request.cargo_type.value,
            priority=request.priority
        )

        # Prédiction
        prediction = transport_predictor.predict(input_data)

        # Chemin de décision
        decision_path = transport_predictor.get_decision_path(input_data)

        return {
            "success": True,
            "prediction": prediction,
            "decision_path": decision_path,
            "n_rules_applied": len(decision_path)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/predict/model-info", tags=["Module E: Decision Tree"])
async def get_model_info():
    """
    Retourne les informations sur le modèle d'arbre de décision entraîné.

    Inclut les métriques de performance, l'importance des features,
    et la structure de l'arbre.
    """
    if not transport_predictor.is_trained:
        raise HTTPException(status_code=503, detail="Le modèle n'est pas encore entraîné")

    return {
        "success": True,
        "model_type": "DecisionTreeClassifier",
        "is_trained": transport_predictor.is_trained,
        "training_stats": transport_predictor.training_stats
    }


# ============================================================================
# Point d'entrée
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
