"""
Script de vérification du backend avec Decision Tree
"""
import requests
import json

API_URL = "http://localhost:8000"

print("=" * 60)
print("VERIFICATION DU BACKEND")
print("=" * 60)

# 1. Vérifier que le serveur répond
print("\n[1] Test de sante du serveur...")
try:
    response = requests.get(f"{API_URL}/health")
    if response.status_code == 200:
        print("   OK - Serveur en ligne")
    else:
        print(f"   ERREUR - Code {response.status_code}")
        exit(1)
except Exception as e:
    print(f"   ERREUR - Serveur non accessible: {e}")
    print("\n   >> Lancez d'abord: restart_backend.bat")
    exit(1)

# 2. Vérifier l'endpoint de prédiction
print("\n[2] Test de l'endpoint de prediction...")
try:
    response = requests.get(f"{API_URL}/predict/model-info")
    if response.status_code == 200:
        data = response.json()
        print("   OK - Module Decision Tree charge")
        print(f"   - Precision: {data['training_stats']['test_accuracy']*100:.1f}%")
        print(f"   - Profondeur: {data['training_stats']['tree_depth']}")
    else:
        print(f"   ERREUR - Code {response.status_code}")
        print("\n   >> Le module Decision Tree n'est pas charge")
        print("   >> Relancez: restart_backend.bat")
        exit(1)
except Exception as e:
    print(f"   ERREUR - {e}")
    exit(1)

# 3. Test de prédiction
print("\n[3] Test de prediction Alger -> Constantine...")
try:
    payload = {
        "origin": "Alger",
        "destination": "Constantine",
        "cargo_tonnes": 50,
        "cargo_type": "bulk",
        "priority": 1
    }

    response = requests.post(
        f"{API_URL}/predict/transport-mode",
        json=payload,
        headers={"Content-Type": "application/json"}
    )

    if response.status_code == 200:
        data = response.json()
        print("   OK - Prediction reussie")
        print(f"   - Mode predit: {data['predicted_mode']}")
        print(f"   - Confiance: {data['confidence']*100:.1f}%")
        print(f"   - Distance: {data['input_features']['distance_km']} km")
    else:
        print(f"   ERREUR - Code {response.status_code}")
        print(f"   Detail: {response.text}")
        exit(1)
except Exception as e:
    print(f"   ERREUR - {e}")
    exit(1)

# 4. Test de comparaison
print("\n[4] Test de comparaison ML vs Expert...")
try:
    response = requests.post(
        f"{API_URL}/predict/compare-methods",
        json=payload,
        headers={"Content-Type": "application/json"}
    )

    if response.status_code == 200:
        data = response.json()
        print("   OK - Comparaison reussie")
        print(f"   - ML: {data['decision_tree_prediction']}")
        print(f"   - Expert: {data['expert_system_recommendation']}")
        print(f"   - Accord: {'Oui' if data['agreement'] else 'Non'}")
    else:
        print(f"   ERREUR - Code {response.status_code}")
        exit(1)
except Exception as e:
    print(f"   ERREUR - {e}")
    exit(1)

print("\n" + "=" * 60)
print("TOUS LES TESTS SONT PASSES !")
print("=" * 60)
print("\nLe backend fonctionne correctement avec le module Decision Tree.")
print("Vous pouvez maintenant utiliser l'interface web.")
print("\nFrontend: http://localhost:5173")
print("API Docs: http://localhost:8000/docs")
