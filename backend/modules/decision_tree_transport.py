"""
Module D : Arbre de Décision pour la Prédiction du Mode de Transport Optimal

Ce module utilise un arbre de décision (Decision Tree) de scikit-learn pour
prédire le mode de transport optimal en fonction des caractéristiques de la
livraison.

Features utilisées:
- Distance (km)
- Zone d'origine (nord, hauts_plateaux, sud)
- Zone de destination
- Tonnage (tonnes)
- Type de cargo
- Niveau d'urgence (priorité)
- Disponibilité du rail

Remplace les règles fixes par un modèle appris sur des données simulées
basées sur le système expert existant.
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from enum import Enum
import pickle
import os
import sys

from sklearn.tree import DecisionTreeClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report, accuracy_score
import warnings

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from data.wilayas_algeria import WILAYAS_DATA, calculate_distance
from modules.carbon_expert import (
    CarbonExpertSystem, TransportContext, TransportMode, CargoType, Zone
)


@dataclass
class TransportPredictionInput:
    """Entrée pour la prédiction du mode de transport."""
    origin: str
    destination: str
    cargo_tonnes: float
    cargo_type: str  # CargoType value
    priority: int    # 1=normal, 2=urgent, 3=très urgent


class TransportModePredictor:
    """
    Prédicteur de mode de transport basé sur un arbre de décision.

    Apprend à partir de données simulées générées par le système expert
    et prédit le mode de transport optimal pour une nouvelle livraison.
    """

    # Encodage des zones
    ZONE_ENCODING = {
        "nord": 0,
        "hauts_plateaux": 1,
        "sud": 2
    }

    # Encodage des types de cargo
    CARGO_ENCODING = {
        "general": 0,
        "refrigerated": 1,
        "hazardous": 2,
        "bulk": 3,
        "fragile": 4
    }

    # Modes de transport (cibles)
    TRANSPORT_MODES = [
        TransportMode.TRAIN.value,
        TransportMode.TRUCK_SMALL.value,
        TransportMode.TRUCK_MEDIUM.value,
        TransportMode.TRUCK_LARGE.value,
        TransportMode.MULTIMODAL.value
    ]

    def __init__(
        self,
        max_depth: int = 10,
        min_samples_split: int = 5,
        min_samples_leaf: int = 2,
        random_state: int = 42
    ):
        """
        Initialise le prédicteur.

        Args:
            max_depth: Profondeur maximale de l'arbre
            min_samples_split: Nombre minimum d'échantillons pour diviser
            min_samples_leaf: Nombre minimum d'échantillons par feuille
            random_state: Graine pour la reproductibilité
        """
        self.max_depth = max_depth
        self.min_samples_split = min_samples_split
        self.min_samples_leaf = min_samples_leaf
        self.random_state = random_state

        self.model: Optional[DecisionTreeClassifier] = None
        self.label_encoder = LabelEncoder()
        self.is_trained = False
        self.training_stats: Dict = {}
        self.carbon_expert = CarbonExpertSystem()

    def _get_zone(self, wilaya: str) -> str:
        """Récupère la zone d'une wilaya."""
        if wilaya in WILAYAS_DATA:
            return WILAYAS_DATA[wilaya][4]
        return "nord"

    def _has_rail_access(self, wilaya: str) -> bool:
        """Vérifie si une wilaya a un accès ferroviaire."""
        if wilaya in WILAYAS_DATA:
            return WILAYAS_DATA[wilaya][5]
        return False

    def _can_use_rail(self, origin: str, destination: str) -> bool:
        """Vérifie si le rail est disponible entre deux wilayas."""
        return self._has_rail_access(origin) and self._has_rail_access(destination)

    def _determine_optimal_mode(
        self,
        distance: float,
        origin_zone: str,
        dest_zone: str,
        cargo_tonnes: float,
        cargo_type: str,
        priority: int,
        rail_available: bool
    ) -> str:
        """
        Détermine le mode de transport optimal basé sur des règles expertes.

        Cette fonction simule la "connaissance experte" pour générer
        des données d'entraînement.
        """
        # Règles de décision basées sur l'analyse du système expert

        # Priorité très urgente -> camions rapides
        if priority == 3:
            if cargo_tonnes <= 3.5:
                return TransportMode.TRUCK_SMALL.value
            elif cargo_tonnes <= 12:
                return TransportMode.TRUCK_MEDIUM.value
            else:
                return TransportMode.TRUCK_LARGE.value

        # Produits réfrigérés -> camions (contrôle température)
        if cargo_type == "refrigerated":
            if cargo_tonnes <= 3.5:
                return TransportMode.TRUCK_SMALL.value
            elif cargo_tonnes <= 12:
                return TransportMode.TRUCK_MEDIUM.value
            else:
                return TransportMode.TRUCK_LARGE.value

        # Longue distance + rail disponible + pas urgent -> train ou multimodal
        if distance > 300 and rail_available:
            if cargo_type == "bulk":  # Vrac = idéal pour le train
                return TransportMode.TRAIN.value
            elif cargo_tonnes > 20:
                return TransportMode.TRAIN.value
            else:
                return TransportMode.MULTIMODAL.value

        # Distance moyenne avec rail -> multimodal
        if distance > 150 and rail_available and cargo_tonnes > 10:
            return TransportMode.MULTIMODAL.value

        # Zone Sud (conditions difficiles) -> gros porteurs
        if dest_zone == "sud" or origin_zone == "sud":
            if cargo_tonnes > 12:
                return TransportMode.TRUCK_LARGE.value
            elif cargo_tonnes > 3.5:
                return TransportMode.TRUCK_MEDIUM.value
            else:
                return TransportMode.TRUCK_MEDIUM.value  # Éviter petits camions au Sud

        # Petites charges -> petits camions
        if cargo_tonnes <= 3.5:
            return TransportMode.TRUCK_SMALL.value

        # Charges moyennes -> camions moyens
        if cargo_tonnes <= 12:
            return TransportMode.TRUCK_MEDIUM.value

        # Grandes charges -> gros porteurs
        return TransportMode.TRUCK_LARGE.value

    def generate_training_data(
        self,
        n_samples: int = 5000,
        seed: int = 42
    ) -> pd.DataFrame:
        """
        Génère des données d'entraînement synthétiques.

        Args:
            n_samples: Nombre d'échantillons à générer
            seed: Graine aléatoire

        Returns:
            DataFrame avec les features et la cible
        """
        np.random.seed(seed)

        wilayas = list(WILAYAS_DATA.keys())
        cargo_types = list(self.CARGO_ENCODING.keys())

        data = []

        for _ in range(n_samples):
            # Sélection aléatoire origine/destination
            origin = np.random.choice(wilayas)
            destination = np.random.choice([w for w in wilayas if w != origin])

            # Calcul de la distance
            distance = calculate_distance(origin, destination)

            # Zones
            origin_zone = self._get_zone(origin)
            dest_zone = self._get_zone(destination)

            # Caractéristiques aléatoires
            cargo_tonnes = np.random.uniform(0.5, 100)
            cargo_type = np.random.choice(cargo_types)
            priority = np.random.choice([1, 2, 3], p=[0.7, 0.2, 0.1])

            # Disponibilité du rail
            rail_available = self._can_use_rail(origin, destination)

            # Déterminer le mode optimal
            optimal_mode = self._determine_optimal_mode(
                distance=distance,
                origin_zone=origin_zone,
                dest_zone=dest_zone,
                cargo_tonnes=cargo_tonnes,
                cargo_type=cargo_type,
                priority=priority,
                rail_available=rail_available
            )

            # Ajouter un peu de bruit (5% de variations)
            if np.random.random() < 0.05:
                available_modes = self.TRANSPORT_MODES.copy()
                if not rail_available:
                    available_modes = [m for m in available_modes
                                       if m not in ["train", "multimodal"]]
                optimal_mode = np.random.choice(available_modes)

            data.append({
                "distance": distance,
                "origin_zone": self.ZONE_ENCODING[origin_zone],
                "dest_zone": self.ZONE_ENCODING[dest_zone],
                "cargo_tonnes": cargo_tonnes,
                "cargo_type": self.CARGO_ENCODING[cargo_type],
                "priority": priority,
                "rail_available": int(rail_available),
                "optimal_mode": optimal_mode
            })

        return pd.DataFrame(data)

    def train(
        self,
        data: Optional[pd.DataFrame] = None,
        n_samples: int = 5000,
        test_size: float = 0.2,
        verbose: bool = True
    ) -> Dict:
        """
        Entraîne le modèle d'arbre de décision.

        Args:
            data: DataFrame d'entraînement (optionnel, sinon généré)
            n_samples: Nombre d'échantillons si génération automatique
            test_size: Proportion de données pour le test
            verbose: Afficher les détails

        Returns:
            Dictionnaire avec les statistiques d'entraînement
        """
        if verbose:
            print("\n" + "=" * 60)
            print("ENTRAÎNEMENT - Arbre de Décision Transport")
            print("=" * 60)

        # Générer ou utiliser les données fournies
        if data is None:
            if verbose:
                print(f"Génération de {n_samples} échantillons d'entraînement...")
            data = self.generate_training_data(n_samples=n_samples)

        # Features et cible
        feature_cols = [
            "distance", "origin_zone", "dest_zone",
            "cargo_tonnes", "cargo_type", "priority", "rail_available"
        ]
        X = data[feature_cols]
        y = data["optimal_mode"]

        # Encoder les labels
        y_encoded = self.label_encoder.fit_transform(y)

        # Split train/test
        X_train, X_test, y_train, y_test = train_test_split(
            X, y_encoded, test_size=test_size, random_state=self.random_state
        )

        if verbose:
            print(f"Données d'entraînement: {len(X_train)} échantillons")
            print(f"Données de test: {len(X_test)} échantillons")

        # Créer et entraîner le modèle
        self.model = DecisionTreeClassifier(
            max_depth=self.max_depth,
            min_samples_split=self.min_samples_split,
            min_samples_leaf=self.min_samples_leaf,
            random_state=self.random_state,
            class_weight="balanced"  # Gérer les déséquilibres de classes
        )

        self.model.fit(X_train, y_train)

        # Évaluation
        y_pred_train = self.model.predict(X_train)
        y_pred_test = self.model.predict(X_test)

        train_accuracy = accuracy_score(y_train, y_pred_train)
        test_accuracy = accuracy_score(y_test, y_pred_test)

        # Validation croisée
        cv_scores = cross_val_score(self.model, X, y_encoded, cv=5)

        # Importance des features
        feature_importance = dict(zip(
            feature_cols,
            self.model.feature_importances_
        ))

        self.is_trained = True
        self.training_stats = {
            "n_samples": int(len(data)),
            "n_train": int(len(X_train)),
            "n_test": int(len(X_test)),
            "train_accuracy": float(round(train_accuracy, 4)),
            "test_accuracy": float(round(test_accuracy, 4)),
            "cv_mean_accuracy": float(round(cv_scores.mean(), 4)),
            "cv_std_accuracy": float(round(cv_scores.std(), 4)),
            "tree_depth": int(self.model.get_depth()),
            "n_leaves": int(self.model.get_n_leaves()),
            "feature_importance": {k: float(round(v, 4)) for k, v in feature_importance.items()},
            "classes": [str(c) for c in self.label_encoder.classes_]
        }

        if verbose:
            print(f"\n📊 Résultats de l'entraînement:")
            print(f"  Précision (train): {train_accuracy:.2%}")
            print(f"  Précision (test):  {test_accuracy:.2%}")
            print(f"  Validation croisée: {cv_scores.mean():.2%} (±{cv_scores.std():.2%})")
            print(f"\n  Profondeur de l'arbre: {self.model.get_depth()}")
            print(f"  Nombre de feuilles: {self.model.get_n_leaves()}")
            print(f"\n📈 Importance des features:")
            for feat, imp in sorted(feature_importance.items(), key=lambda x: -x[1]):
                print(f"    {feat}: {imp:.3f}")

            # Rapport de classification détaillé
            print(f"\n📋 Rapport de classification (test):")
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                report = classification_report(
                    y_test, y_pred_test,
                    target_names=self.label_encoder.classes_
                )
                print(report)

        return self.training_stats

    def predict(self, input_data: TransportPredictionInput) -> Dict:
        """
        Prédit le mode de transport optimal pour une livraison.

        Args:
            input_data: Données de la livraison

        Returns:
            Dictionnaire avec la prédiction et les détails
        """
        if not self.is_trained:
            raise ValueError("Le modèle n'est pas entraîné. Appelez train() d'abord.")

        # Calculer les features
        origin = input_data.origin
        destination = input_data.destination

        distance = calculate_distance(origin, destination)
        origin_zone = self._get_zone(origin)
        dest_zone = self._get_zone(destination)
        rail_available = self._can_use_rail(origin, destination)

        # Encoder les features
        features = np.array([[
            distance,
            self.ZONE_ENCODING.get(origin_zone, 0),
            self.ZONE_ENCODING.get(dest_zone, 0),
            input_data.cargo_tonnes,
            self.CARGO_ENCODING.get(input_data.cargo_type, 0),
            input_data.priority,
            int(rail_available)
        ]])

        # Prédiction
        pred_encoded = self.model.predict(features)[0]
        predicted_mode = self.label_encoder.inverse_transform([pred_encoded])[0]

        # Probabilités par classe
        probabilities = self.model.predict_proba(features)[0]
        class_probs = {
            self.label_encoder.inverse_transform([i])[0]: round(float(p), 4)
            for i, p in enumerate(probabilities)
        }

        # Filtrer les modes indisponibles (train/multimodal si pas de rail)
        available_modes = self.TRANSPORT_MODES.copy()
        if not rail_available:
            available_modes = [m for m in available_modes
                               if m not in ["train", "multimodal"]]
            # Ajuster la prédiction si nécessaire
            if predicted_mode in ["train", "multimodal"]:
                # Choisir le prochain mode le plus probable parmi les disponibles
                sorted_probs = sorted(class_probs.items(), key=lambda x: -x[1])
                for mode, prob in sorted_probs:
                    if mode in available_modes:
                        predicted_mode = mode
                        break

        return {
            "predicted_mode": str(predicted_mode),
            "confidence": float(round(float(max(probabilities)), 4)),
            "all_probabilities": class_probs,
            "input_features": {
                "origin": origin,
                "destination": destination,
                "distance_km": float(round(distance, 2)),
                "origin_zone": origin_zone,
                "dest_zone": dest_zone,
                "cargo_tonnes": float(input_data.cargo_tonnes),
                "cargo_type": input_data.cargo_type,
                "priority": int(input_data.priority),
                "rail_available": bool(rail_available)
            },
            "available_modes": available_modes
        }

    def predict_batch(self, inputs: List[TransportPredictionInput]) -> List[Dict]:
        """
        Prédit le mode de transport pour plusieurs livraisons.

        Args:
            inputs: Liste des données de livraison

        Returns:
            Liste des prédictions
        """
        return [self.predict(inp) for inp in inputs]

    def compare_with_expert_system(
        self,
        origin: str,
        destination: str,
        cargo_tonnes: float,
        cargo_type: str = "general"
    ) -> Dict:
        """
        Compare la prédiction de l'arbre de décision avec le système expert.

        Args:
            origin: Wilaya d'origine
            destination: Wilaya de destination
            cargo_tonnes: Tonnage
            cargo_type: Type de cargo

        Returns:
            Comparaison des deux approches
        """
        # Prédiction arbre de décision
        input_data = TransportPredictionInput(
            origin=origin,
            destination=destination,
            cargo_tonnes=cargo_tonnes,
            cargo_type=cargo_type,
            priority=1
        )
        dt_prediction = self.predict(input_data)

        # Comparaison système expert (meilleur CO2)
        expert_comparison = self.carbon_expert.compare_transport_modes(
            origin=origin,
            destination=destination,
            cargo_tonnes=cargo_tonnes,
            cargo_type=CargoType(cargo_type)
        )

        expert_best = expert_comparison.get("recommendation", {}).get("best_mode")

        return {
            "decision_tree_prediction": dt_prediction["predicted_mode"],
            "decision_tree_confidence": dt_prediction["confidence"],
            "expert_system_recommendation": expert_best,
            "agreement": dt_prediction["predicted_mode"] == expert_best,
            "details": {
                "decision_tree": dt_prediction,
                "expert_system": expert_comparison
            }
        }

    def get_decision_path(self, input_data: TransportPredictionInput) -> List[str]:
        """
        Retourne le chemin de décision dans l'arbre pour une prédiction.

        Args:
            input_data: Données de la livraison

        Returns:
            Liste des règles appliquées
        """
        if not self.is_trained:
            raise ValueError("Le modèle n'est pas entraîné.")

        # Calculer les features
        distance = calculate_distance(input_data.origin, input_data.destination)
        origin_zone = self._get_zone(input_data.origin)
        dest_zone = self._get_zone(input_data.destination)
        rail_available = self._can_use_rail(input_data.origin, input_data.destination)

        features = np.array([[
            distance,
            self.ZONE_ENCODING.get(origin_zone, 0),
            self.ZONE_ENCODING.get(dest_zone, 0),
            input_data.cargo_tonnes,
            self.CARGO_ENCODING.get(input_data.cargo_type, 0),
            input_data.priority,
            int(rail_available)
        ]])

        # Obtenir le chemin de décision
        feature_names = [
            "distance", "origin_zone", "dest_zone",
            "cargo_tonnes", "cargo_type", "priority", "rail_available"
        ]

        node_indicator = self.model.decision_path(features)
        leaf_id = self.model.apply(features)[0]

        feature = self.model.tree_.feature
        threshold = self.model.tree_.threshold

        node_indices = node_indicator.indices[
            node_indicator.indptr[0]:node_indicator.indptr[1]
        ]

        path_rules = []
        for node_id in node_indices:
            if leaf_id == node_id:
                continue

            feat_idx = feature[node_id]
            thresh = threshold[node_id]
            feat_name = feature_names[feat_idx]
            feat_value = features[0, feat_idx]

            if feat_value <= thresh:
                rule = f"{feat_name} <= {thresh:.2f} (valeur: {feat_value:.2f})"
            else:
                rule = f"{feat_name} > {thresh:.2f} (valeur: {feat_value:.2f})"

            path_rules.append(rule)

        return path_rules

    def save_model(self, filepath: str) -> None:
        """Sauvegarde le modèle entraîné."""
        if not self.is_trained:
            raise ValueError("Le modèle n'est pas entraîné.")

        model_data = {
            "model": self.model,
            "label_encoder": self.label_encoder,
            "training_stats": self.training_stats,
            "config": {
                "max_depth": self.max_depth,
                "min_samples_split": self.min_samples_split,
                "min_samples_leaf": self.min_samples_leaf
            }
        }

        with open(filepath, "wb") as f:
            pickle.dump(model_data, f)

    def load_model(self, filepath: str) -> None:
        """Charge un modèle sauvegardé."""
        with open(filepath, "rb") as f:
            model_data = pickle.load(f)

        self.model = model_data["model"]
        self.label_encoder = model_data["label_encoder"]
        self.training_stats = model_data["training_stats"]
        self.is_trained = True


# Test du module
if __name__ == "__main__":
    print("=" * 60)
    print("TEST: Arbre de Décision - Prédiction Mode de Transport")
    print("=" * 60)

    # Créer et entraîner le prédicteur
    predictor = TransportModePredictor(
        max_depth=12,
        min_samples_split=10,
        min_samples_leaf=5
    )

    # Entraînement
    stats = predictor.train(n_samples=5000, verbose=True)

    # Tests de prédiction
    print("\n" + "=" * 60)
    print("TESTS DE PRÉDICTION")
    print("=" * 60)

    test_cases = [
        # Cas 1: Longue distance, gros tonnage, rail disponible
        TransportPredictionInput(
            origin="Alger",
            destination="Constantine",
            cargo_tonnes=50,
            cargo_type="bulk",
            priority=1
        ),
        # Cas 2: Courte distance, petit tonnage
        TransportPredictionInput(
            origin="Alger",
            destination="Blida",
            cargo_tonnes=2,
            cargo_type="general",
            priority=1
        ),
        # Cas 3: Zone sud, urgence élevée
        TransportPredictionInput(
            origin="Alger",
            destination="Tamanrasset",
            cargo_tonnes=15,
            cargo_type="refrigerated",
            priority=3
        ),
        # Cas 4: Distance moyenne, cargo standard
        TransportPredictionInput(
            origin="Oran",
            destination="Sétif",
            cargo_tonnes=20,
            cargo_type="general",
            priority=2
        ),
    ]

    for i, test in enumerate(test_cases, 1):
        print(f"\n📍 Cas {i}: {test.origin} → {test.destination}")
        print(f"   Tonnage: {test.cargo_tonnes}t, Type: {test.cargo_type}, Priorité: {test.priority}")

        result = predictor.predict(test)

        print(f"\n   🎯 Prédiction: {result['predicted_mode']}")
        print(f"   📊 Confiance: {result['confidence']:.1%}")
        print(f"   📏 Distance: {result['input_features']['distance_km']} km")
        print(f"   🚂 Rail disponible: {'Oui' if result['input_features']['rail_available'] else 'Non'}")

        print(f"\n   Probabilités par mode:")
        for mode, prob in sorted(result['all_probabilities'].items(), key=lambda x: -x[1]):
            bar = "█" * int(prob * 20)
            print(f"     {mode:15s}: {prob:5.1%} {bar}")

    # Comparaison avec le système expert
    print("\n" + "=" * 60)
    print("COMPARAISON AVEC LE SYSTÈME EXPERT")
    print("=" * 60)

    comparison = predictor.compare_with_expert_system(
        origin="Alger",
        destination="Constantine",
        cargo_tonnes=30,
        cargo_type="general"
    )

    print(f"\n📍 Alger → Constantine (30t, general)")
    print(f"   🌳 Arbre de décision: {comparison['decision_tree_prediction']}")
    print(f"   🧠 Système expert:    {comparison['expert_system_recommendation']}")
    print(f"   ✅ Accord: {'Oui' if comparison['agreement'] else 'Non'}")

    # Chemin de décision
    print("\n" + "=" * 60)
    print("CHEMIN DE DÉCISION (EXPLICABILITÉ)")
    print("=" * 60)

    test_input = TransportPredictionInput(
        origin="Alger",
        destination="Oran",
        cargo_tonnes=25,
        cargo_type="general",
        priority=1
    )

    print(f"\n📍 {test_input.origin} → {test_input.destination}")
    path = predictor.get_decision_path(test_input)
    print("\n🔍 Règles appliquées:")
    for i, rule in enumerate(path, 1):
        print(f"   {i}. {rule}")

    result = predictor.predict(test_input)
    print(f"\n   → Décision finale: {result['predicted_mode']}")
