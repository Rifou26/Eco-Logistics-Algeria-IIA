"""
Module B : Système Expert pour le Calcul d'Empreinte Carbone

Ce module implémente un système à base de règles (IA Symbolique) pour
estimer l'impact CO2 réel du transport logistique en fonction des
contraintes spécifiques à l'Algérie.

Facteurs pris en compte:
- Type de transport (train SNTF vs camion)
- Zone géographique (Nord, Hauts-Plateaux, Sud/Désert)
- Taux de chargement du véhicule
- Conditions climatiques (chaleur, sable)
- Type de marchandise
"""

from enum import Enum
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from data.wilayas_algeria import WILAYAS_DATA, calculate_distance, get_rail_distance


class TransportMode(Enum):
    """Modes de transport disponibles."""
    TRAIN = "train"
    TRUCK_SMALL = "truck_small"      # < 3.5 tonnes
    TRUCK_MEDIUM = "truck_medium"     # 3.5 - 12 tonnes
    TRUCK_LARGE = "truck_large"       # > 12 tonnes
    MULTIMODAL = "multimodal"         # Train + Camion (dernier km)


class Zone(Enum):
    """Zones géographiques de l'Algérie."""
    NORD = "nord"
    HAUTS_PLATEAUX = "hauts_plateaux"
    SUD = "sud"


class CargoType(Enum):
    """Types de marchandises."""
    GENERAL = "general"
    REFRIGERATED = "refrigerated"     # Produits frais (surcoût CO2)
    HAZARDOUS = "hazardous"           # Matières dangereuses
    BULK = "bulk"                     # Vrac (céréales, etc.)
    FRAGILE = "fragile"               # Nécessite vitesse réduite


@dataclass
class TransportContext:
    """Contexte d'une opération de transport."""
    origin: str
    destination: str
    transport_mode: TransportMode
    cargo_tonnes: float
    vehicle_capacity: float  # Capacité max en tonnes
    cargo_type: CargoType = CargoType.GENERAL
    is_return_trip: bool = False  # Trajet retour (potentiellement à vide)


class CarbonExpertSystem:
    """
    Système expert à base de règles pour le calcul d'empreinte carbone.
    Implémente des règles spécifiques au contexte algérien.
    """

    # Facteurs de base CO2 (kg CO2 par tonne.km)
    BASE_FACTORS = {
        TransportMode.TRAIN: 0.020,         # Train très efficace
        TransportMode.TRUCK_SMALL: 0.180,    # Petit camion peu efficace
        TransportMode.TRUCK_MEDIUM: 0.100,   # Camion moyen
        TransportMode.TRUCK_LARGE: 0.062,    # Gros porteur efficace
        TransportMode.MULTIMODAL: 0.040,     # Combiné (moyenne pondérée)
    }

    # Multiplicateurs par zone
    ZONE_MULTIPLIERS = {
        Zone.NORD: 1.0,           # Conditions normales
        Zone.HAUTS_PLATEAUX: 1.15, # Altitude, routes sinueuses
        Zone.SUD: 1.40,           # Chaleur extrême, sable, usure
    }

    # Pénalités de chargement (efficacité réduite si charge partielle)
    LOAD_EFFICIENCY = {
        (0, 25): 2.5,      # Quasi-vide: très inefficace
        (25, 50): 1.6,     # Demi-charge: inefficace
        (50, 75): 1.2,     # Charge correcte
        (75, 100): 1.0,    # Charge optimale
    }

    # Multiplicateurs par type de cargo
    CARGO_MULTIPLIERS = {
        CargoType.GENERAL: 1.0,
        CargoType.REFRIGERATED: 1.35,   # Climatisation = +35% CO2
        CargoType.HAZARDOUS: 1.10,      # Vitesse réduite, détours
        CargoType.BULK: 0.90,           # Efficace en vrac
        CargoType.FRAGILE: 1.05,        # Conduite prudente
    }

    def __init__(self):
        """Initialise le système expert."""
        self.rules_applied: List[str] = []
        self.calculation_details: Dict = {}

    def _get_zone(self, wilaya: str) -> Zone:
        """Détermine la zone géographique d'une wilaya."""
        if wilaya not in WILAYAS_DATA:
            return Zone.NORD  # Défaut

        zone_str = WILAYAS_DATA[wilaya][4]
        return Zone(zone_str)

    def _get_load_factor(self, load_percentage: float) -> float:
        """Calcule le facteur de pénalité basé sur le taux de chargement."""
        for (min_load, max_load), factor in self.LOAD_EFFICIENCY.items():
            if min_load <= load_percentage < max_load:
                return factor
        return 1.0

    def _apply_rules(self, context: TransportContext) -> List[Tuple[str, float]]:
        """
        Applique les règles du système expert et retourne les facteurs.

        Returns:
            Liste de tuples (règle_description, facteur_multiplicateur)
        """
        rules_applied = []

        # Règle 1: Facteur de base selon le mode de transport
        base = self.BASE_FACTORS[context.transport_mode]
        rules_applied.append((
            f"R1: Mode {context.transport_mode.value} → Base: {base:.3f} kg CO2/t.km",
            base
        ))

        # Règle 2: Zone de destination
        dest_zone = self._get_zone(context.destination)
        zone_mult = self.ZONE_MULTIPLIERS[dest_zone]
        rules_applied.append((
            f"R2: Zone {dest_zone.value} → Multiplicateur: ×{zone_mult:.2f}",
            zone_mult
        ))

        # Règle 3: Zone d'origine (si différente)
        origin_zone = self._get_zone(context.origin)
        if origin_zone != dest_zone:
            # Prendre la moyenne des deux zones
            origin_mult = self.ZONE_MULTIPLIERS[origin_zone]
            avg_zone_mult = (zone_mult + origin_mult) / 2
            rules_applied.append((
                f"R3: Traversée {origin_zone.value}→{dest_zone.value} → Moyenne: ×{avg_zone_mult:.2f}",
                avg_zone_mult / zone_mult  # Ajustement relatif
            ))

        # Règle 4: Taux de chargement
        load_percentage = (context.cargo_tonnes / context.vehicle_capacity) * 100
        load_factor = self._get_load_factor(load_percentage)
        rules_applied.append((
            f"R4: Chargement {load_percentage:.0f}% → Pénalité: ×{load_factor:.2f}",
            load_factor
        ))

        # Règle 5: Type de cargo
        cargo_mult = self.CARGO_MULTIPLIERS[context.cargo_type]
        rules_applied.append((
            f"R5: Cargo {context.cargo_type.value} → Multiplicateur: ×{cargo_mult:.2f}",
            cargo_mult
        ))

        # Règle 6: Trajet retour à vide
        if context.is_return_trip and load_percentage < 10:
            empty_penalty = 0.7  # On compte 70% du trajet aller
            rules_applied.append((
                f"R6: Retour à vide → CO2 additionnel: +{empty_penalty*100:.0f}% du trajet",
                1 + empty_penalty
            ))

        # Règle 7: Bonus train pour longue distance
        distance = calculate_distance(context.origin, context.destination)
        if context.transport_mode == TransportMode.TRAIN and distance > 300:
            efficiency_bonus = 0.85  # 15% de réduction pour longue distance
            rules_applied.append((
                f"R7: Train longue distance ({distance:.0f} km) → Bonus: ×{efficiency_bonus:.2f}",
                efficiency_bonus
            ))

        # Règle 8: Pénalité Sud extrême (Tamanrasset, In Guezzam, etc.)
        extreme_south = ["Tamanrasset", "In Guezzam", "Djanet", "Illizi", "Bordj Badji Mokhtar"]
        if context.destination in extreme_south or context.origin in extreme_south:
            extreme_penalty = 1.25
            rules_applied.append((
                f"R8: Destination extrême Sud → Pénalité: ×{extreme_penalty:.2f}",
                extreme_penalty
            ))

        return rules_applied

    def calculate_carbon_footprint(
        self,
        context: TransportContext,
        verbose: bool = False
    ) -> Dict:
        """
        Calcule l'empreinte carbone totale pour un transport.

        Args:
            context: Contexte du transport
            verbose: Afficher les détails des règles

        Returns:
            Dictionnaire avec les résultats et détails
        """
        self.rules_applied = []

        # Calculer la distance
        distance = calculate_distance(context.origin, context.destination)

        # Vérifier si le train est possible
        rail_distance = get_rail_distance(context.origin, context.destination)
        can_use_rail = (
            context.transport_mode in [TransportMode.TRAIN, TransportMode.MULTIMODAL]
            and rail_distance is not None
        )

        if context.transport_mode == TransportMode.TRAIN and not can_use_rail:
            # Fallback vers camion si pas de rail
            context.transport_mode = TransportMode.TRUCK_LARGE
            self.rules_applied.append(
                "⚠️ Pas de liaison ferroviaire → Fallback vers camion"
            )

        # Appliquer les règles
        rules = self._apply_rules(context)

        # Calculer le facteur total
        base_factor = rules[0][1]  # Le premier est le facteur de base
        total_multiplier = 1.0
        for rule_desc, factor in rules[1:]:  # Les suivants sont des multiplicateurs
            if factor != base_factor:  # Éviter de re-multiplier la base
                total_multiplier *= factor

        # Calcul final
        effective_factor = base_factor * total_multiplier
        total_co2 = effective_factor * context.cargo_tonnes * distance

        # Calcul comparatif (meilleur cas vs pire cas)
        best_case_factor = self.BASE_FACTORS[TransportMode.TRAIN] * 0.85
        worst_case_factor = self.BASE_FACTORS[TransportMode.TRUCK_SMALL] * 1.4 * 2.5

        best_case_co2 = best_case_factor * context.cargo_tonnes * distance
        worst_case_co2 = worst_case_factor * context.cargo_tonnes * distance

        # Stocker les détails
        result = {
            "origin": context.origin,
            "destination": context.destination,
            "distance_km": round(distance, 2),
            "cargo_tonnes": context.cargo_tonnes,
            "transport_mode": context.transport_mode.value,
            "total_co2_kg": round(total_co2, 2),
            "co2_per_tonne_km": round(effective_factor, 4),
            "efficiency_score": round(
                100 * (1 - (total_co2 - best_case_co2) / (worst_case_co2 - best_case_co2)),
                1
            ),
            "rules_applied": [r[0] for r in rules],
            "comparison": {
                "best_case_co2": round(best_case_co2, 2),
                "worst_case_co2": round(worst_case_co2, 2),
                "savings_vs_worst": round(worst_case_co2 - total_co2, 2)
            }
        }

        if verbose:
            print(f"\n{'='*60}")
            print(f"CALCUL CO2: {context.origin} → {context.destination}")
            print(f"{'='*60}")
            print(f"Distance: {distance:.1f} km")
            print(f"Cargo: {context.cargo_tonnes} tonnes ({context.cargo_type.value})")
            print(f"Mode: {context.transport_mode.value}")
            print(f"\nRègles appliquées:")
            for rule, _ in rules:
                print(f"  • {rule}")
            print(f"\n📊 Résultat:")
            print(f"  CO2 Total: {total_co2:.2f} kg")
            print(f"  Facteur effectif: {effective_factor:.4f} kg CO2/t.km")
            print(f"  Score d'efficacité: {result['efficiency_score']}%")

        return result

    def compare_transport_modes(
        self,
        origin: str,
        destination: str,
        cargo_tonnes: float,
        cargo_type: CargoType = CargoType.GENERAL
    ) -> Dict:
        """
        Compare l'empreinte CO2 de tous les modes de transport possibles.

        Returns:
            Dictionnaire avec la comparaison et la recommandation
        """
        results = {}

        # Capacités typiques par mode
        capacities = {
            TransportMode.TRAIN: 1000,
            TransportMode.TRUCK_SMALL: 2.5,
            TransportMode.TRUCK_MEDIUM: 8,
            TransportMode.TRUCK_LARGE: 25,
            TransportMode.MULTIMODAL: 25,
        }

        for mode in TransportMode:
            capacity = capacities[mode]
            if cargo_tonnes > capacity:
                # Besoin de plusieurs véhicules
                n_vehicles = int(cargo_tonnes / capacity) + 1
                cargo_per_vehicle = cargo_tonnes / n_vehicles
            else:
                n_vehicles = 1
                cargo_per_vehicle = cargo_tonnes

            context = TransportContext(
                origin=origin,
                destination=destination,
                transport_mode=mode,
                cargo_tonnes=cargo_per_vehicle,
                vehicle_capacity=capacity,
                cargo_type=cargo_type
            )

            try:
                result = self.calculate_carbon_footprint(context)
                # Multiplier par le nombre de véhicules
                result["total_co2_kg"] *= n_vehicles
                result["n_vehicles"] = n_vehicles
                results[mode.value] = result
            except Exception as e:
                results[mode.value] = {"error": str(e)}

        # Trouver le meilleur mode
        valid_results = {k: v for k, v in results.items() if "error" not in v}
        if valid_results:
            best_mode = min(valid_results.keys(), key=lambda k: valid_results[k]["total_co2_kg"])
            worst_mode = max(valid_results.keys(), key=lambda k: valid_results[k]["total_co2_kg"])

            return {
                "comparison": results,
                "recommendation": {
                    "best_mode": best_mode,
                    "best_co2": valid_results[best_mode]["total_co2_kg"],
                    "worst_mode": worst_mode,
                    "worst_co2": valid_results[worst_mode]["total_co2_kg"],
                    "potential_savings_kg": round(
                        valid_results[worst_mode]["total_co2_kg"] -
                        valid_results[best_mode]["total_co2_kg"],
                        2
                    ),
                    "potential_savings_percent": round(
                        100 * (valid_results[worst_mode]["total_co2_kg"] -
                               valid_results[best_mode]["total_co2_kg"]) /
                        valid_results[worst_mode]["total_co2_kg"],
                        1
                    )
                }
            }

        return {"comparison": results, "recommendation": None}

    def calculate_route_footprint(
        self,
        route: List[str],
        cargo_tonnes: float,
        transport_mode: TransportMode,
        cargo_type: CargoType = CargoType.GENERAL
    ) -> Dict:
        """
        Calcule l'empreinte carbone totale d'une route multi-étapes.

        Args:
            route: Liste ordonnée des wilayas à traverser
            cargo_tonnes: Tonnes transportées
            transport_mode: Mode de transport
            cargo_type: Type de marchandise

        Returns:
            Empreinte totale avec détails par segment
        """
        if len(route) < 2:
            raise ValueError("La route doit contenir au moins 2 wilayas")

        segments = []
        total_co2 = 0
        total_distance = 0

        capacity = {
            TransportMode.TRAIN: 1000,
            TransportMode.TRUCK_SMALL: 2.5,
            TransportMode.TRUCK_MEDIUM: 8,
            TransportMode.TRUCK_LARGE: 25,
            TransportMode.MULTIMODAL: 25,
        }[transport_mode]

        for i in range(len(route) - 1):
            context = TransportContext(
                origin=route[i],
                destination=route[i + 1],
                transport_mode=transport_mode,
                cargo_tonnes=cargo_tonnes,
                vehicle_capacity=capacity,
                cargo_type=cargo_type
            )

            result = self.calculate_carbon_footprint(context)
            segments.append({
                "from": route[i],
                "to": route[i + 1],
                "distance_km": result["distance_km"],
                "co2_kg": result["total_co2_kg"]
            })
            total_co2 += result["total_co2_kg"]
            total_distance += result["distance_km"]

        return {
            "route": route,
            "total_distance_km": round(total_distance, 2),
            "total_co2_kg": round(total_co2, 2),
            "co2_per_km": round(total_co2 / total_distance, 4) if total_distance > 0 else 0,
            "segments": segments
        }


# Test du module
if __name__ == "__main__":
    print("=" * 60)
    print("TEST: Système Expert Calcul Empreinte Carbone")
    print("=" * 60)

    expert = CarbonExpertSystem()

    # Test 1: Transport simple Alger → Tamanrasset
    print("\n📍 TEST 1: Alger → Tamanrasset (2000 km, zone extrême)")
    context = TransportContext(
        origin="Alger",
        destination="Tamanrasset",
        transport_mode=TransportMode.TRUCK_LARGE,
        cargo_tonnes=20,
        vehicle_capacity=25,
        cargo_type=CargoType.GENERAL
    )
    result = expert.calculate_carbon_footprint(context, verbose=True)

    # Test 2: Comparaison des modes Alger → Constantine
    print("\n\n📍 TEST 2: Comparaison modes Alger → Constantine")
    comparison = expert.compare_transport_modes(
        origin="Alger",
        destination="Constantine",
        cargo_tonnes=50,
        cargo_type=CargoType.GENERAL
    )

    print(f"\n{'Mode':<15} {'CO2 (kg)':<12} {'Véhicules':<10}")
    print("-" * 40)
    for mode, data in comparison["comparison"].items():
        if "error" not in data:
            print(f"{mode:<15} {data['total_co2_kg']:<12.2f} {data.get('n_vehicles', 1):<10}")

    rec = comparison["recommendation"]
    if rec:
        print(f"\n✅ Recommandation: {rec['best_mode']}")
        print(f"   Économie potentielle: {rec['potential_savings_kg']} kg CO2 ({rec['potential_savings_percent']}%)")

    # Test 3: Route multi-étapes
    print("\n\n📍 TEST 3: Route Alger → Sétif → Batna → Biskra")
    route_result = expert.calculate_route_footprint(
        route=["Alger", "Sétif", "Batna", "Biskra"],
        cargo_tonnes=15,
        transport_mode=TransportMode.TRUCK_LARGE
    )

    print(f"\nDistance totale: {route_result['total_distance_km']} km")
    print(f"CO2 total: {route_result['total_co2_kg']} kg")
    print("\nDétail par segment:")
    for seg in route_result["segments"]:
        print(f"  {seg['from']} → {seg['to']}: {seg['distance_km']:.0f} km, {seg['co2_kg']:.2f} kg CO2")
