"""
Module d'optimisation TSP (Traveling Salesman Problem) pour Eco-Logistics Algeria

Ce module optimise l'ordre des arrêts pour minimiser la distance totale parcourue.
Utilise un algorithme génétique simplifié pour trouver une solution proche de l'optimale.
"""

import random
import numpy as np
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from data.wilayas_algeria import WILAYAS_DATA, calculate_distance


@dataclass
class TSPResult:
    """Résultat de l'optimisation TSP"""
    success: bool
    optimized_route: List[str]
    total_distance_km: float
    distances_per_leg: List[Dict]
    improvement_percent: float
    original_distance_km: float
    computation_time_ms: float
    error: Optional[str] = None


class TSPOptimizer:
    """
    Optimiseur TSP utilisant un algorithme génétique.

    Trouve l'ordre optimal des wilayas pour minimiser la distance totale.
    """

    def __init__(
        self,
        population_size: int = 50,
        generations: int = 100,
        mutation_rate: float = 0.1,
        elite_size: int = 5
    ):
        """
        Initialise l'optimiseur TSP.

        Args:
            population_size: Taille de la population
            generations: Nombre de générations
            mutation_rate: Taux de mutation
            elite_size: Nombre d'élites à conserver
        """
        self.population_size = population_size
        self.generations = generations
        self.mutation_rate = mutation_rate
        self.elite_size = elite_size

    def _calculate_route_distance(self, route: List[str]) -> float:
        """Calcule la distance totale d'une route."""
        total = 0.0
        for i in range(len(route) - 1):
            total += calculate_distance(route[i], route[i + 1])
        return total

    def _create_distance_matrix(self, wilayas: List[str]) -> np.ndarray:
        """Crée une matrice de distances entre toutes les wilayas."""
        n = len(wilayas)
        matrix = np.zeros((n, n))

        for i in range(n):
            for j in range(i + 1, n):
                dist = calculate_distance(wilayas[i], wilayas[j])
                matrix[i][j] = dist
                matrix[j][i] = dist

        return matrix

    def _fitness(self, route: List[int], distance_matrix: np.ndarray) -> float:
        """Calcule le fitness (inverse de la distance) d'une route."""
        total = 0.0
        for i in range(len(route) - 1):
            total += distance_matrix[route[i]][route[i + 1]]
        return 1.0 / (total + 1)  # +1 pour éviter division par zéro

    def _create_initial_population(
        self,
        n_cities: int,
        start_idx: int,
        end_idx: Optional[int]
    ) -> List[List[int]]:
        """Crée la population initiale."""
        population = []

        # Indices des villes intermédiaires (sans start et end)
        intermediate = [i for i in range(n_cities) if i != start_idx and i != end_idx]

        for _ in range(self.population_size):
            route = intermediate.copy()
            random.shuffle(route)

            # Ajouter start au début
            route = [start_idx] + route

            # Ajouter end à la fin si spécifié
            if end_idx is not None and end_idx != start_idx:
                route.append(end_idx)

            population.append(route)

        return population

    def _tournament_selection(
        self,
        population: List[List[int]],
        fitnesses: List[float],
        tournament_size: int = 3
    ) -> List[int]:
        """Sélection par tournoi."""
        tournament_indices = random.sample(range(len(population)), tournament_size)
        best_idx = max(tournament_indices, key=lambda i: fitnesses[i])
        return population[best_idx].copy()

    def _ordered_crossover(
        self,
        parent1: List[int],
        parent2: List[int],
        start_idx: int,
        end_idx: Optional[int]
    ) -> List[int]:
        """Croisement ordonné (OX1) en préservant start et end."""
        # Extraire les parties intermédiaires
        if end_idx is not None and end_idx != start_idx:
            p1_mid = parent1[1:-1]
            p2_mid = parent2[1:-1]
        else:
            p1_mid = parent1[1:]
            p2_mid = parent2[1:]

        if len(p1_mid) <= 2:
            return parent1.copy()

        # Points de croisement
        size = len(p1_mid)
        cx1, cx2 = sorted(random.sample(range(size), 2))

        # Créer l'enfant
        child_mid = [None] * size
        child_mid[cx1:cx2] = p1_mid[cx1:cx2]

        # Remplir avec parent2
        pos = cx2
        for gene in p2_mid[cx2:] + p2_mid[:cx2]:
            if gene not in child_mid:
                if pos >= size:
                    pos = 0
                while child_mid[pos] is not None:
                    pos += 1
                    if pos >= size:
                        pos = 0
                child_mid[pos] = gene
                pos += 1

        # Reconstruire la route complète
        child = [start_idx] + child_mid
        if end_idx is not None and end_idx != start_idx:
            child.append(end_idx)

        return child

    def _mutate(
        self,
        route: List[int],
        start_idx: int,
        end_idx: Optional[int]
    ) -> List[int]:
        """Mutation par échange de deux villes (sauf start et end)."""
        if random.random() > self.mutation_rate:
            return route

        route = route.copy()

        # Déterminer les indices modifiables
        if end_idx is not None and end_idx != start_idx:
            modifiable = list(range(1, len(route) - 1))
        else:
            modifiable = list(range(1, len(route)))

        if len(modifiable) < 2:
            return route

        # Échanger deux positions
        i, j = random.sample(modifiable, 2)
        route[i], route[j] = route[j], route[i]

        return route

    def optimize(
        self,
        wilayas: List[str],
        start_wilaya: Optional[str] = None,
        end_wilaya: Optional[str] = None,
        return_to_start: bool = False
    ) -> TSPResult:
        """
        Optimise l'ordre des wilayas pour minimiser la distance.

        Args:
            wilayas: Liste des wilayas à visiter
            start_wilaya: Wilaya de départ (optionnelle, sinon première de la liste)
            end_wilaya: Wilaya d'arrivée (optionnelle)
            return_to_start: Si True, retourne au point de départ

        Returns:
            TSPResult avec la route optimisée
        """
        import time
        start_time = time.time()

        # Validation
        for w in wilayas:
            if w not in WILAYAS_DATA:
                return TSPResult(
                    success=False,
                    optimized_route=[],
                    total_distance_km=0,
                    distances_per_leg=[],
                    improvement_percent=0,
                    original_distance_km=0,
                    computation_time_ms=0,
                    error=f"Wilaya '{w}' non trouvée"
                )

        # Cas trivial
        if len(wilayas) <= 2:
            dist = calculate_distance(wilayas[0], wilayas[-1]) if len(wilayas) == 2 else 0
            return TSPResult(
                success=True,
                optimized_route=wilayas,
                total_distance_km=dist,
                distances_per_leg=[{
                    "from": wilayas[0],
                    "to": wilayas[-1],
                    "distance_km": dist
                }] if len(wilayas) == 2 else [],
                improvement_percent=0,
                original_distance_km=dist,
                computation_time_ms=(time.time() - start_time) * 1000
            )

        # Préparer les indices
        if start_wilaya and start_wilaya in wilayas:
            start_idx = wilayas.index(start_wilaya)
        else:
            start_idx = 0
            start_wilaya = wilayas[0]

        if return_to_start:
            end_idx = start_idx
            end_wilaya = start_wilaya
        elif end_wilaya and end_wilaya in wilayas:
            end_idx = wilayas.index(end_wilaya)
        else:
            end_idx = None

        # Calculer la distance originale
        original_distance = self._calculate_route_distance(wilayas)

        # Créer la matrice de distances
        distance_matrix = self._create_distance_matrix(wilayas)

        # Initialiser la population
        population = self._create_initial_population(len(wilayas), start_idx, end_idx)

        # Évolution
        best_route = None
        best_fitness = -1

        for gen in range(self.generations):
            # Calculer les fitness
            fitnesses = [self._fitness(route, distance_matrix) for route in population]

            # Garder le meilleur
            gen_best_idx = max(range(len(population)), key=lambda i: fitnesses[i])
            if fitnesses[gen_best_idx] > best_fitness:
                best_fitness = fitnesses[gen_best_idx]
                best_route = population[gen_best_idx].copy()

            # Nouvelle population
            new_population = []

            # Élitisme
            elite_indices = sorted(range(len(population)), key=lambda i: -fitnesses[i])[:self.elite_size]
            for idx in elite_indices:
                new_population.append(population[idx].copy())

            # Reproduction
            while len(new_population) < self.population_size:
                parent1 = self._tournament_selection(population, fitnesses)
                parent2 = self._tournament_selection(population, fitnesses)

                child = self._ordered_crossover(parent1, parent2, start_idx, end_idx)
                child = self._mutate(child, start_idx, end_idx)

                new_population.append(child)

            population = new_population

        # Convertir les indices en noms
        optimized_route = [wilayas[i] for i in best_route]

        # Calculer les distances par segment
        distances_per_leg = []
        total_distance = 0.0
        for i in range(len(optimized_route) - 1):
            dist = calculate_distance(optimized_route[i], optimized_route[i + 1])
            total_distance += dist
            distances_per_leg.append({
                "from": optimized_route[i],
                "to": optimized_route[i + 1],
                "distance_km": float(round(dist, 2)),
                "leg_number": int(i + 1)
            })

        # Calculer l'amélioration
        improvement = ((original_distance - total_distance) / original_distance) * 100 if original_distance > 0 else 0

        computation_time = (time.time() - start_time) * 1000

        return TSPResult(
            success=True,
            optimized_route=optimized_route,
            total_distance_km=float(round(total_distance, 2)),
            distances_per_leg=distances_per_leg,
            improvement_percent=float(round(improvement, 2)),
            original_distance_km=float(round(original_distance, 2)),
            computation_time_ms=float(round(computation_time, 2))
        )


def optimize_delivery_tour(
    wilayas: List[str],
    depot: Optional[str] = None,
    return_to_depot: bool = True
) -> TSPResult:
    """
    Fonction utilitaire pour optimiser une tournée de livraison.

    Args:
        wilayas: Liste des wilayas à visiter
        depot: Wilaya du dépôt (point de départ/arrivée)
        return_to_depot: Si True, retourne au dépôt

    Returns:
        TSPResult avec la route optimisée
    """
    optimizer = TSPOptimizer(
        population_size=100,
        generations=150,
        mutation_rate=0.15,
        elite_size=10
    )

    return optimizer.optimize(
        wilayas=wilayas,
        start_wilaya=depot,
        end_wilaya=depot if return_to_depot else None,
        return_to_start=return_to_depot
    )


# Test du module
if __name__ == "__main__":
    # Test avec quelques wilayas
    test_wilayas = ["Alger", "Oran", "Constantine", "Annaba", "Sétif", "Blida", "Batna"]

    print("=" * 60)
    print("Test de l'optimiseur TSP")
    print("=" * 60)
    print(f"Wilayas à visiter: {test_wilayas}")
    print()

    result = optimize_delivery_tour(test_wilayas, depot="Alger", return_to_depot=True)

    print(f"Route optimisée: {' → '.join(result.optimized_route)}")
    print(f"Distance totale: {result.total_distance_km} km")
    print(f"Distance originale: {result.original_distance_km} km")
    print(f"Amélioration: {result.improvement_percent}%")
    print(f"Temps de calcul: {result.computation_time_ms} ms")
    print()
    print("Détails par segment:")
    for leg in result.distances_per_leg:
        print(f"  {leg['leg_number']}. {leg['from']} → {leg['to']}: {leg['distance_km']} km")
