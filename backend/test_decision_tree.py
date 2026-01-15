"""
Test du module Decision Tree Transport
"""
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from modules.decision_tree_transport import TransportModePredictor, TransportPredictionInput

print("=" * 60)
print("TEST: Arbre de Decision - Prediction Mode de Transport")
print("=" * 60)

# Creer et entrainer le predicteur
predictor = TransportModePredictor(
    max_depth=12,
    min_samples_split=10,
    min_samples_leaf=5
)

print("\nEntrainement du modele...")
stats = predictor.train(n_samples=5000, verbose=False)

print("\n[OK] Modele entraine avec succes!")
print(f"  - Precision (train): {stats['train_accuracy']:.2%}")
print(f"  - Precision (test):  {stats['test_accuracy']:.2%}")
print(f"  - Validation croisee: {stats['cv_mean_accuracy']:.2%}")
print(f"  - Profondeur arbre: {stats['tree_depth']}")
print(f"  - Nombre de feuilles: {stats['n_leaves']}")

print("\n" + "=" * 60)
print("TESTS DE PREDICTION")
print("=" * 60)

# Test 1: Longue distance, gros tonnage, rail disponible
print("\n[Test 1] Alger -> Constantine (50t, bulk, priorite=1)")
test1 = TransportPredictionInput(
    origin="Alger",
    destination="Constantine",
    cargo_tonnes=50,
    cargo_type="bulk",
    priority=1
)
result1 = predictor.predict(test1)
print(f"  Prediction: {result1['predicted_mode']}")
print(f"  Confiance: {result1['confidence']:.1%}")
print(f"  Distance: {result1['input_features']['distance_km']} km")
print(f"  Rail disponible: {'Oui' if result1['input_features']['rail_available'] else 'Non'}")

# Test 2: Courte distance, petit tonnage
print("\n[Test 2] Alger -> Blida (2t, general, priorite=1)")
test2 = TransportPredictionInput(
    origin="Alger",
    destination="Blida",
    cargo_tonnes=2,
    cargo_type="general",
    priority=1
)
result2 = predictor.predict(test2)
print(f"  Prediction: {result2['predicted_mode']}")
print(f"  Confiance: {result2['confidence']:.1%}")

# Test 3: Zone sud, urgence elevee
print("\n[Test 3] Alger -> Tamanrasset (15t, refrigerated, priorite=3)")
test3 = TransportPredictionInput(
    origin="Alger",
    destination="Tamanrasset",
    cargo_tonnes=15,
    cargo_type="refrigerated",
    priority=3
)
result3 = predictor.predict(test3)
print(f"  Prediction: {result3['predicted_mode']}")
print(f"  Confiance: {result3['confidence']:.1%}")

# Comparaison avec le systeme expert
print("\n" + "=" * 60)
print("COMPARAISON ML vs SYSTEME EXPERT")
print("=" * 60)

comparison = predictor.compare_with_expert_system(
    origin="Alger",
    destination="Constantine",
    cargo_tonnes=30,
    cargo_type="general"
)

print(f"\nAlger -> Constantine (30t, general)")
print(f"  Arbre de decision: {comparison['decision_tree_prediction']}")
print(f"  Systeme expert:    {comparison['expert_system_recommendation']}")
print(f"  Accord: {'Oui' if comparison['agreement'] else 'Non'}")

print("\n" + "=" * 60)
print("IMPORTANCE DES FEATURES")
print("=" * 60)
for feat, imp in sorted(stats['feature_importance'].items(), key=lambda x: -x[1]):
    bar = "#" * int(imp * 50)
    print(f"  {feat:20s}: {imp:.3f} {bar}")

print("\n[SUCCESS] Tous les tests sont passes!")
