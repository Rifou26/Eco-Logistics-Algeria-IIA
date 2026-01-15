"""
Module C : Optimiseur Multi-Objectif NSGA-II

Ce module implémente l'algorithme génétique NSGA-II (Non-dominated Sorting
Genetic Algorithm II) pour l'optimisation multi-objectif de la chaîne logistique.

Objectifs à minimiser simultanément:
1. Coût total (carburant, péages, usure)
2. Émissions CO2 (impact environnemental)

Le résultat est un Front de Pareto permettant au décideur de choisir
le meilleur compromis entre économie et écologie.
"""

import random
import numpy as np
from typing import List, Dict, Tuple, Callable, Optional
from dataclasses import dataclass
from deap import base, creator, tools, algorithms
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from data.wilayas_algeria import (
    WILAYAS_DATA, calculate_distance, get_rail_distance, get_all_wilayas
)
from modules.carbon_expert import (
    CarbonExpertSystem, TransportContext, TransportMode, CargoType
)


@dataclass
class DeliveryRequest:
    """Représente une demande de livraison."""
    id: int
    origin: str
    destination: str
    cargo_tonnes: float
    cargo_type: CargoType = CargoType.GENERAL
    priority: int = 1  # 1 = normal, 2 = urgent, 3 = très urgent


@dataclass
class RouteGene:
    """Représente un gène dans le chromosome (un segment de route)."""
    request_id: int
    transport_mode: TransportMode
    via_hub: Optional[str] = None  # Hub intermédiaire optionnel


class MultiObjectiveOptimizer:
    """
    Optimiseur multi-objectif utilisant NSGA-II pour trouver
    le front de Pareto des solutions (coût vs CO2).
    """

    # Coûts de base (DZD par km)
    COST_PER_KM = {
        TransportMode.TRAIN: 15,           # Train: économique
        TransportMode.TRUCK_SMALL: 45,     # Petit camion: cher par km
        TransportMode.TRUCK_MEDIUM: 35,    # Moyen: intermédiaire
        TransportMode.TRUCK_LARGE: 28,     # Gros porteur: économies d'échelle
        TransportMode.MULTIMODAL: 22,      # Combiné: optimal
    }

    # Coût fixe par véhicule (DZD)
    FIXED_COST = {
        TransportMode.TRAIN: 50000,        # Réservation wagon
        TransportMode.TRUCK_SMALL: 5000,
        TransportMode.TRUCK_MEDIUM: 8000,
        TransportMode.TRUCK_LARGE: 12000,
        TransportMode.MULTIMODAL: 15000,   # Coordination
    }

    def __init__(
        self,
        requests: List[DeliveryRequest],
        hubs: List[str] = None,
        population_size: int = 100,
        generations: int = 50,
        random_seed: int = 42
    ):
        """
        Initialise l'optimiseur.

        Args:
            requests: Liste des demandes de livraison
            hubs: Liste des hubs régionaux disponibles
            population_size: Taille de la population génétique
            generations: Nombre de générations
            random_seed: Graine pour reproductibilité
        """
        self.requests = requests
        self.hubs = hubs or ["Alger", "Oran", "Constantine", "Sétif", "Ouargla", "Béchar"]
        # NSGA-II selTournamentDCD requires population divisible by 4
        self.population_size = ((population_size + 3) // 4) * 4
        self.generations = generations
        self.random_seed = random_seed

        self.carbon_expert = CarbonExpertSystem()
        self.pareto_front = []
        self.all_solutions = []

        # Configuration DEAP
        self._setup_deap()

    def _setup_deap(self):
        """Configure les structures DEAP pour l'algorithme génétique."""
        # Créer les types (minimiser les deux objectifs)
        if not hasattr(creator, "FitnessMulti"):
            creator.create("FitnessMulti", base.Fitness, weights=(-1.0, -1.0))
        if not hasattr(creator, "Individual"):
            creator.create("Individual", list, fitness=creator.FitnessMulti)

        self.toolbox = base.Toolbox()

        # Générateur d'individu (chromosome)
        self.toolbox.register("individual", self._create_individual)
        self.toolbox.register("population", tools.initRepeat, list, self.toolbox.individual)

        # Opérateurs génétiques
        self.toolbox.register("evaluate", self._evaluate)
        self.toolbox.register("mate", self._crossover)
        self.toolbox.register("mutate", self._mutate)
        self.toolbox.register("select", tools.selNSGA2)

    def _create_individual(self) -> 'creator.Individual':
        """
        Crée un individu (solution candidate).

        Un individu est une liste de décisions pour chaque demande:
        [mode_transport_0, hub_ou_none_0, mode_transport_1, hub_ou_none_1, ...]
        """
        chromosome = []

        for req in self.requests:
            # Choisir un mode de transport aléatoire
            available_modes = list(TransportMode)

            # Vérifier si le train est possible
            if not self._can_use_rail(req.origin, req.destination):
                available_modes = [m for m in available_modes
                                   if m not in [TransportMode.TRAIN, TransportMode.MULTIMODAL]]

            mode = random.choice(available_modes)
            chromosome.append(mode.value)

            # Décider si passer par un hub (30% de chance)
            if random.random() < 0.3:
                # Choisir un hub qui réduit potentiellement la distance
                valid_hubs = [h for h in self.hubs
                              if h != req.origin and h != req.destination]
                if valid_hubs:
                    hub = random.choice(valid_hubs)
                    chromosome.append(hub)
                else:
                    chromosome.append(None)
            else:
                chromosome.append(None)

        return creator.Individual(chromosome)

    def _can_use_rail(self, origin: str, destination: str) -> bool:
        """Vérifie si le transport ferroviaire est possible."""
        origin_data = WILAYAS_DATA.get(origin)
        dest_data = WILAYAS_DATA.get(destination)

        if not origin_data or not dest_data:
            return False

        return origin_data[5] and dest_data[5]  # Les deux ont accès au rail

    def _decode_individual(self, individual: List) -> List[Dict]:
        """Décode un chromosome en liste de décisions de transport."""
        decisions = []
        idx = 0

        for req in self.requests:
            mode_str = individual[idx]
            hub = individual[idx + 1]

            decisions.append({
                "request": req,
                "transport_mode": TransportMode(mode_str),
                "via_hub": hub
            })
            idx += 2

        return decisions

    def _evaluate(self, individual: List) -> Tuple[float, float]:
        """
        Évalue un individu sur les deux objectifs.

        Returns:
            (coût_total, co2_total)
        """
        decisions = self._decode_individual(individual)
        total_cost = 0
        total_co2 = 0

        for decision in decisions:
            req = decision["request"]
            mode = decision["transport_mode"]
            hub = decision["via_hub"]

            # Calculer le trajet (direct ou via hub)
            if hub and hub != req.origin and hub != req.destination:
                # Route via hub
                segments = [
                    (req.origin, hub),
                    (hub, req.destination)
                ]
            else:
                # Route directe
                segments = [(req.origin, req.destination)]

            segment_cost = 0
            segment_co2 = 0

            for origin, dest in segments:
                try:
                    distance = calculate_distance(origin, dest)

                    # Calcul du coût
                    cost = (
                        self.FIXED_COST[mode] +
                        self.COST_PER_KM[mode] * distance
                    )
                    # Ajuster pour le tonnage
                    if req.cargo_tonnes > 10:
                        cost *= 1 + (req.cargo_tonnes - 10) * 0.02

                    # Calcul du CO2
                    capacity = {
                        TransportMode.TRAIN: 1000,
                        TransportMode.TRUCK_SMALL: 2.5,
                        TransportMode.TRUCK_MEDIUM: 8,
                        TransportMode.TRUCK_LARGE: 25,
                        TransportMode.MULTIMODAL: 25,
                    }[mode]

                    context = TransportContext(
                        origin=origin,
                        destination=dest,
                        transport_mode=mode,
                        cargo_tonnes=req.cargo_tonnes,
                        vehicle_capacity=capacity,
                        cargo_type=req.cargo_type
                    )

                    co2_result = self.carbon_expert.calculate_carbon_footprint(context)
                    co2 = co2_result["total_co2_kg"]

                    segment_cost += cost
                    segment_co2 += co2

                except Exception:
                    # Pénalité pour route invalide
                    segment_cost += 1000000
                    segment_co2 += 10000

            # Bonus/Pénalité priorité
            if req.priority > 1:
                # Les urgents préfèrent les camions (plus rapides)
                if mode == TransportMode.TRAIN:
                    segment_cost *= 1.2  # Pénalité train pour urgent

            total_cost += segment_cost
            total_co2 += segment_co2

        return (total_cost, total_co2)

    def _crossover(self, ind1: List, ind2: List) -> Tuple[List, List]:
        """Croisement à deux points entre deux individus."""
        size = len(ind1)
        if size < 4:
            return ind1, ind2

        # Points de croisement (par paires: mode + hub)
        cx_points = sorted(random.sample(range(0, size, 2), 2))

        # Échange des segments
        for i in range(cx_points[0], cx_points[1]):
            ind1[i], ind2[i] = ind2[i], ind1[i]

        return ind1, ind2

    def _mutate(self, individual: List, mutation_prob: float = 0.1) -> Tuple[List]:
        """Mutation d'un individu."""
        for i in range(0, len(individual), 2):
            if random.random() < mutation_prob:
                # Muter le mode de transport
                req_idx = i // 2
                req = self.requests[req_idx]

                available_modes = list(TransportMode)
                if not self._can_use_rail(req.origin, req.destination):
                    available_modes = [m for m in available_modes
                                       if m not in [TransportMode.TRAIN, TransportMode.MULTIMODAL]]

                individual[i] = random.choice(available_modes).value

            if random.random() < mutation_prob:
                # Muter le hub
                if random.random() < 0.5:
                    individual[i + 1] = None
                else:
                    valid_hubs = self.hubs.copy()
                    individual[i + 1] = random.choice(valid_hubs)

        return (individual,)

    def optimize(self, alpha: float = 0.5, verbose: bool = True) -> Dict:
        """
        Exécute l'optimisation NSGA-II.

        Args:
            alpha: Poids du coût vs CO2 (0 = que CO2, 1 = que coût)
            verbose: Afficher la progression

        Returns:
            Dictionnaire avec le front de Pareto et les statistiques
        """
        random.seed(self.random_seed)
        np.random.seed(self.random_seed)

        # Créer la population initiale
        population = self.toolbox.population(n=self.population_size)

        # Évaluer la population initiale
        fitnesses = list(map(self.toolbox.evaluate, population))
        for ind, fit in zip(population, fitnesses):
            ind.fitness.values = fit

        # Statistiques
        stats = tools.Statistics(lambda ind: ind.fitness.values)
        stats.register("min_cost", lambda x: min(f[0] for f in x))
        stats.register("min_co2", lambda x: min(f[1] for f in x))
        stats.register("avg_cost", lambda x: np.mean([f[0] for f in x]))
        stats.register("avg_co2", lambda x: np.mean([f[1] for f in x]))

        logbook = tools.Logbook()

        if verbose:
            print(f"\n{'='*60}")
            print("OPTIMISATION NSGA-II - Eco-Logistics Algeria")
            print(f"{'='*60}")
            print(f"Population: {self.population_size}, Générations: {self.generations}")
            print(f"Demandes: {len(self.requests)}, Hubs: {len(self.hubs)}")
            print(f"Curseur α (coût/CO2): {alpha}")

        # Évolution
        for gen in range(self.generations):
            # Sélection des parents (tournoi binaire)
            offspring = tools.selTournament(population, len(population), tournsize=2)
            offspring = list(map(self.toolbox.clone, offspring))

            # Croisement
            for child1, child2 in zip(offspring[::2], offspring[1::2]):
                if random.random() < 0.8:  # Probabilité de croisement
                    self.toolbox.mate(child1, child2)
                    del child1.fitness.values
                    del child2.fitness.values

            # Mutation
            for mutant in offspring:
                if random.random() < 0.2:  # Probabilité de mutation
                    self.toolbox.mutate(mutant)
                    del mutant.fitness.values

            # Évaluer les nouveaux individus
            invalid_ind = [ind for ind in offspring if not ind.fitness.valid]
            fitnesses = map(self.toolbox.evaluate, invalid_ind)
            for ind, fit in zip(invalid_ind, fitnesses):
                ind.fitness.values = fit

            # Sélection pour la prochaine génération (NSGA-II)
            population = self.toolbox.select(population + offspring, self.population_size)

            # Enregistrer les statistiques
            record = stats.compile(population)
            logbook.record(gen=gen, **record)

            if verbose and (gen % 10 == 0 or gen == self.generations - 1):
                print(f"Gen {gen:3d}: Coût min = {record['min_cost']:,.0f} DZD, "
                      f"CO2 min = {record['min_co2']:,.0f} kg")

        # Extraire le front de Pareto
        pareto_front = tools.sortNondominated(population, len(population), first_front_only=True)[0]

        # Décoder les solutions du front de Pareto
        pareto_solutions = []
        for ind in pareto_front:
            cost, co2 = ind.fitness.values
            decisions = self._decode_individual(ind)

            solution = {
                "total_cost_dzd": round(cost, 0),
                "total_co2_kg": round(co2, 2),
                "decisions": [
                    {
                        "request_id": d["request"].id,
                        "origin": d["request"].origin,
                        "destination": d["request"].destination,
                        "cargo_tonnes": d["request"].cargo_tonnes,
                        "transport_mode": d["transport_mode"].value,
                        "via_hub": d["via_hub"]
                    }
                    for d in decisions
                ]
            }
            pareto_solutions.append(solution)

        # Trier par coût
        pareto_solutions.sort(key=lambda x: x["total_cost_dzd"])

        # Sélectionner la solution selon alpha
        if len(pareto_solutions) > 0:
            # Normaliser les objectifs
            costs = [s["total_cost_dzd"] for s in pareto_solutions]
            co2s = [s["total_co2_kg"] for s in pareto_solutions]

            min_cost, max_cost = min(costs), max(costs)
            min_co2, max_co2 = min(co2s), max(co2s)

            # Calculer le score pondéré pour chaque solution
            for s in pareto_solutions:
                if max_cost > min_cost:
                    norm_cost = (s["total_cost_dzd"] - min_cost) / (max_cost - min_cost)
                else:
                    norm_cost = 0

                if max_co2 > min_co2:
                    norm_co2 = (s["total_co2_kg"] - min_co2) / (max_co2 - min_co2)
                else:
                    norm_co2 = 0

                s["weighted_score"] = alpha * norm_cost + (1 - alpha) * norm_co2

            # Recommandation basée sur alpha
            recommended = min(pareto_solutions, key=lambda x: x["weighted_score"])
        else:
            recommended = None

        self.pareto_front = pareto_solutions

        result = {
            "pareto_front": pareto_solutions,
            "n_solutions": len(pareto_solutions),
            "recommended_solution": recommended,
            "alpha": alpha,
            "statistics": {
                "generations": self.generations,
                "population_size": self.population_size,
                "final_min_cost": logbook[-1]["min_cost"],
                "final_min_co2": logbook[-1]["min_co2"]
            },
            "logbook": [
                {"gen": rec["gen"], "min_cost": rec["min_cost"], "min_co2": rec["min_co2"]}
                for rec in logbook
            ]
        }

        if verbose and recommended:
            print(f"\n{'='*60}")
            print("SOLUTION RECOMMANDÉE (α = {:.1f})".format(alpha))
            print(f"{'='*60}")
            print(f"Coût total: {recommended['total_cost_dzd']:,.0f} DZD")
            print(f"CO2 total: {recommended['total_co2_kg']:,.0f} kg")
            print(f"\nFront de Pareto: {len(pareto_solutions)} solutions non-dominées")

        return result

    def get_solution_details(self, solution_index: int) -> Dict:
        """
        Retourne les détails complets d'une solution du front de Pareto.

        Args:
            solution_index: Index de la solution dans le front de Pareto

        Returns:
            Détails de la solution avec analyse
        """
        if not self.pareto_front:
            raise ValueError("Aucune optimisation n'a été effectuée. Appelez optimize() d'abord.")

        if solution_index >= len(self.pareto_front):
            raise ValueError(f"Index {solution_index} invalide. Front contient {len(self.pareto_front)} solutions.")

        solution = self.pareto_front[solution_index]

        # Analyse par mode de transport
        mode_stats = {}
        for decision in solution["decisions"]:
            mode = decision["transport_mode"]
            if mode not in mode_stats:
                mode_stats[mode] = {"count": 0, "total_tonnes": 0}
            mode_stats[mode]["count"] += 1
            mode_stats[mode]["total_tonnes"] += decision["cargo_tonnes"]

        # Analyse par hub
        hub_usage = {}
        for decision in solution["decisions"]:
            hub = decision["via_hub"]
            if hub:
                hub_usage[hub] = hub_usage.get(hub, 0) + 1

        return {
            **solution,
            "analysis": {
                "mode_distribution": mode_stats,
                "hub_usage": hub_usage,
                "direct_routes": sum(1 for d in solution["decisions"] if not d["via_hub"]),
                "hub_routes": sum(1 for d in solution["decisions"] if d["via_hub"])
            }
        }


def generate_sample_requests(n_requests: int = 20, seed: int = 42) -> List[DeliveryRequest]:
    """Génère des demandes de livraison de test."""
    random.seed(seed)
    np.random.seed(seed)

    wilayas = list(WILAYAS_DATA.keys())

    # Pondérer par la demande
    weights = [WILAYAS_DATA[w][3] for w in wilayas]
    total = sum(weights)
    weights = [w / total for w in weights]

    requests = []
    for i in range(n_requests):
        # Origine souvent depuis les grandes villes
        origin = np.random.choice(wilayas, p=weights)

        # Destination aléatoire (différente de l'origine)
        dest_candidates = [w for w in wilayas if w != origin]
        destination = random.choice(dest_candidates)

        cargo = random.uniform(2, 50)
        priority = random.choices([1, 2, 3], weights=[0.7, 0.2, 0.1])[0]
        cargo_type = random.choice(list(CargoType))

        requests.append(DeliveryRequest(
            id=i,
            origin=origin,
            destination=destination,
            cargo_tonnes=round(cargo, 1),
            cargo_type=cargo_type,
            priority=priority
        ))

    return requests


# Test du module
if __name__ == "__main__":
    print("=" * 60)
    print("TEST: Optimiseur Multi-Objectif NSGA-II")
    print("=" * 60)

    # Générer des demandes de test
    requests = generate_sample_requests(n_requests=15, seed=42)

    print(f"\nDemandes générées: {len(requests)}")
    for req in requests[:5]:
        print(f"  #{req.id}: {req.origin} → {req.destination}, "
              f"{req.cargo_tonnes}t ({req.cargo_type.value})")
    print("  ...")

    # Créer et exécuter l'optimiseur
    optimizer = MultiObjectiveOptimizer(
        requests=requests,
        population_size=50,
        generations=30
    )

    # Test avec différentes valeurs de alpha
    print("\n" + "=" * 60)
    print("Test avec α = 0.3 (Privilégier l'écologie)")
    print("=" * 60)
    result_eco = optimizer.optimize(alpha=0.3, verbose=True)

    print("\n" + "=" * 60)
    print("Test avec α = 0.7 (Privilégier l'économie)")
    print("=" * 60)
    result_cost = optimizer.optimize(alpha=0.7, verbose=True)

    # Afficher le front de Pareto
    print("\n" + "=" * 60)
    print("FRONT DE PARETO COMPLET")
    print("=" * 60)
    print(f"{'#':<3} {'Coût (DZD)':<15} {'CO2 (kg)':<12} {'Score':<8}")
    print("-" * 40)
    for i, sol in enumerate(result_eco["pareto_front"][:10]):
        print(f"{i:<3} {sol['total_cost_dzd']:>12,.0f}   {sol['total_co2_kg']:>10,.0f}   "
              f"{sol.get('weighted_score', 0):.3f}")
