"""
Module A : Segmentation Territoriale par K-Means

Ce module analyse la distribution géographique et économique des 58 wilayas
pour positionner intelligemment des Hubs Régionaux (centres de distribution).

Objectif: Réduire les distances de livraison en évitant les allers-retours
inutiles depuis Alger vers tout le territoire national.
"""

import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from typing import List, Dict, Tuple, Optional
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from data.wilayas_algeria import get_all_wilayas, WILAYAS_DATA


class TerritorialSegmentation:
    """
    Segmentation territoriale de l'Algérie en zones logistiques
    utilisant l'algorithme K-Means.
    """

    def __init__(self, n_clusters: int = 6, random_state: int = 42):
        """
        Initialise le module de segmentation.

        Args:
            n_clusters: Nombre de hubs régionaux à créer (défaut: 6)
            random_state: Graine aléatoire pour la reproductibilité
        """
        self.n_clusters = n_clusters
        self.random_state = random_state
        self.kmeans = None
        self.scaler = StandardScaler()
        self.wilayas = get_all_wilayas()
        self.feature_matrix = None
        self.labels = None
        self.hubs = None

    def _prepare_features(self, weight_demand: float = 0.3) -> np.ndarray:
        """
        Prépare la matrice de features pour le clustering.

        Features utilisées:
        - Latitude (position Nord-Sud)
        - Longitude (position Est-Ouest)
        - Demande pondérée (pour attirer les hubs vers les zones à forte demande)

        Args:
            weight_demand: Poids accordé à la demande (0-1)

        Returns:
            Matrice normalisée des features
        """
        features = []

        for w in self.wilayas:
            lat = w["latitude"]
            lon = w["longitude"]
            # Normalisation de la demande
            demand_normalized = w["demand_tonnes"] / 5000  # Max ~5000 tonnes

            features.append([
                lat,
                lon,
                demand_normalized * weight_demand
            ])

        self.feature_matrix = np.array(features)
        return self.scaler.fit_transform(self.feature_matrix)

    def fit(self, weight_demand: float = 0.3) -> 'TerritorialSegmentation':
        """
        Exécute le clustering K-Means sur les wilayas.

        Args:
            weight_demand: Poids de la demande dans le clustering

        Returns:
            self pour permettre le chaînage
        """
        X = self._prepare_features(weight_demand)

        self.kmeans = KMeans(
            n_clusters=self.n_clusters,
            random_state=self.random_state,
            n_init=10,
            max_iter=300
        )

        self.labels = self.kmeans.fit_predict(X)

        # Identifier les hubs (centres de cluster)
        self._identify_hubs()

        return self

    def _identify_hubs(self) -> None:
        """
        Identifie la wilaya la plus proche du centroïde de chaque cluster
        comme hub régional. Priorise les wilayas avec accès ferroviaire.
        """
        self.hubs = []

        for cluster_id in range(self.n_clusters):
            # Wilayas dans ce cluster
            cluster_wilayas = [
                (i, self.wilayas[i])
                for i, label in enumerate(self.labels)
                if label == cluster_id
            ]

            if not cluster_wilayas:
                continue

            # Centre du cluster (en coordonnées normalisées)
            center = self.kmeans.cluster_centers_[cluster_id]

            # Dénormaliser le centre pour les coordonnées
            center_denorm = self.scaler.inverse_transform([center])[0]

            # Trouver la wilaya la plus proche du centre
            best_hub = None
            best_distance = float('inf')
            best_hub_with_rail = None
            best_distance_rail = float('inf')

            for idx, w in cluster_wilayas:
                dist = np.sqrt(
                    (w["latitude"] - center_denorm[0])**2 +
                    (w["longitude"] - center_denorm[1])**2
                )

                if dist < best_distance:
                    best_distance = dist
                    best_hub = (idx, w)

                # Prioriser les wilayas avec accès ferroviaire
                if w["rail_access"] and dist < best_distance_rail:
                    best_distance_rail = dist
                    best_hub_with_rail = (idx, w)

            # Choisir le hub avec accès rail si disponible et pas trop loin
            if best_hub_with_rail and best_distance_rail < best_distance * 1.5:
                hub = best_hub_with_rail[1]
            else:
                hub = best_hub[1]

            self.hubs.append({
                "cluster_id": cluster_id,
                "hub_name": hub["name"],
                "hub_location": (hub["latitude"], hub["longitude"]),
                "rail_access": hub["rail_access"],
                "wilayas_covered": [w["name"] for _, w in cluster_wilayas],
                "total_demand": sum(w["demand_tonnes"] for _, w in cluster_wilayas),
                "center_coords": (center_denorm[0], center_denorm[1])
            })

    def get_clusters(self) -> List[Dict]:
        """
        Retourne les informations détaillées sur chaque cluster.

        Returns:
            Liste des clusters avec leurs wilayas et hubs
        """
        if self.hubs is None:
            raise ValueError("Le modèle n'a pas encore été entraîné. Appelez fit() d'abord.")

        return self.hubs

    def predict_cluster(self, latitude: float, longitude: float) -> int:
        """
        Prédit le cluster d'appartenance pour une nouvelle localisation.

        Args:
            latitude: Latitude du point
            longitude: Longitude du point

        Returns:
            ID du cluster
        """
        if self.kmeans is None:
            raise ValueError("Le modèle n'a pas encore été entraîné.")

        # Créer le vecteur de features (demande = 0 pour un nouveau point)
        features = np.array([[latitude, longitude, 0]])
        features_scaled = self.scaler.transform(features)

        return self.kmeans.predict(features_scaled)[0]

    def get_nearest_hub(self, wilaya_name: str) -> Dict:
        """
        Trouve le hub le plus proche pour une wilaya donnée.

        Args:
            wilaya_name: Nom de la wilaya

        Returns:
            Informations sur le hub assigné
        """
        for hub in self.hubs:
            if wilaya_name in hub["wilayas_covered"]:
                return hub

        raise ValueError(f"Wilaya '{wilaya_name}' non trouvée dans les clusters")

    def get_segmentation_summary(self) -> Dict:
        """
        Génère un résumé de la segmentation territoriale.

        Returns:
            Dictionnaire avec les statistiques de segmentation
        """
        summary = {
            "n_clusters": self.n_clusters,
            "total_wilayas": len(self.wilayas),
            "hubs": [],
            "zones_coverage": {"nord": 0, "hauts_plateaux": 0, "sud": 0}
        }

        for hub in self.hubs:
            hub_info = {
                "name": hub["hub_name"],
                "n_wilayas": len(hub["wilayas_covered"]),
                "total_demand": hub["total_demand"],
                "rail_access": hub["rail_access"],
                "wilayas": hub["wilayas_covered"]
            }
            summary["hubs"].append(hub_info)

            # Compter les zones
            for w_name in hub["wilayas_covered"]:
                zone = WILAYAS_DATA[w_name][4]
                summary["zones_coverage"][zone] += 1

        return summary

    def to_json(self) -> Dict:
        """Export les résultats au format JSON pour l'API."""
        if self.hubs is None:
            raise ValueError("Le modèle n'a pas encore été entraîné.")

        return {
            "clusters": self.hubs,
            "summary": self.get_segmentation_summary(),
            "wilayas_assignments": [
                {
                    "name": self.wilayas[i]["name"],
                    "cluster_id": int(self.labels[i]),
                    "latitude": self.wilayas[i]["latitude"],
                    "longitude": self.wilayas[i]["longitude"],
                    "demand": self.wilayas[i]["demand_tonnes"],
                    "zone": self.wilayas[i]["zone"]
                }
                for i in range(len(self.wilayas))
            ]
        }


def optimize_n_clusters(min_k: int = 3, max_k: int = 10) -> Dict:
    """
    Utilise la méthode du coude (Elbow) pour déterminer
    le nombre optimal de clusters.

    Args:
        min_k: Nombre minimum de clusters à tester
        max_k: Nombre maximum de clusters à tester

    Returns:
        Dictionnaire avec les scores d'inertie pour chaque k
    """
    results = {"k_values": [], "inertia": [], "recommended_k": None}

    for k in range(min_k, max_k + 1):
        seg = TerritorialSegmentation(n_clusters=k)
        seg.fit()
        results["k_values"].append(k)
        results["inertia"].append(float(seg.kmeans.inertia_))

    # Trouver le "coude" (changement de pente le plus marqué)
    inertias = np.array(results["inertia"])
    diffs = np.diff(inertias)
    second_diffs = np.diff(diffs)

    if len(second_diffs) > 0:
        elbow_idx = np.argmax(second_diffs) + 1  # +1 car diff réduit la taille
        results["recommended_k"] = results["k_values"][elbow_idx]
    else:
        results["recommended_k"] = 5  # Valeur par défaut

    return results


# Test du module
if __name__ == "__main__":
    print("=" * 60)
    print("TEST: Module de Segmentation Territoriale K-Means")
    print("=" * 60)

    # Créer et entraîner le modèle avec 6 hubs
    segmentation = TerritorialSegmentation(n_clusters=6)
    segmentation.fit(weight_demand=0.3)

    # Afficher le résumé
    summary = segmentation.get_segmentation_summary()

    print(f"\nNombre de clusters: {summary['n_clusters']}")
    print(f"Wilayas totales: {summary['total_wilayas']}")
    print(f"\nCouverture par zone:")
    for zone, count in summary["zones_coverage"].items():
        print(f"  - {zone}: {count} wilayas")

    print("\n" + "-" * 60)
    print("HUBS RÉGIONAUX IDENTIFIÉS:")
    print("-" * 60)

    for hub in summary["hubs"]:
        rail = "🚂" if hub["rail_access"] else "🚛"
        print(f"\n{rail} Hub: {hub['name']}")
        print(f"   Wilayas couvertes: {hub['n_wilayas']}")
        print(f"   Demande totale: {hub['total_demand']:.0f} tonnes/mois")
        print(f"   Wilayas: {', '.join(hub['wilayas'][:5])}...")

    # Test de la méthode du coude
    print("\n" + "-" * 60)
    print("OPTIMISATION DU NOMBRE DE CLUSTERS:")
    print("-" * 60)
    elbow = optimize_n_clusters(3, 8)
    print(f"Nombre optimal recommandé: {elbow['recommended_k']} clusters")
