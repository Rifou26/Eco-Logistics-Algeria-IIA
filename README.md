# Eco-Logistics Algeria

## Optimisation Hybride et Multi-Objectif (Coût/Carbone) de la Chaîne Logistique Nationale

Système intelligent d'optimisation logistique pour l'Algérie, combinant trois modules d'IA pour trouver le meilleur compromis entre coûts financiers et impact environnemental.

## Architecture du Système

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + Vite)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Carte       │  │  Curseur α   │  │  Graphiques  │          │
│  │  Algérie     │  │  (Coût/CO2)  │  │  Pareto      │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │ API REST
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (FastAPI + Python)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Module A    │  │  Module B    │  │  Module C    │          │
│  │  K-Means     │  │  Système     │  │  NSGA-II     │          │
│  │  Clustering  │  │  Expert CO2  │  │  Optimizer   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                              │                                   │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Données: 58 Wilayas + Réseau SNTF + Demandes Simulées    │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Modules d'IA

### Module A : Segmentation Territoriale (K-Means)
- **Technique** : Clustering K-Means avec scikit-learn
- **Objectif** : Positionner intelligemment des Hubs Régionaux
- **Features** : Latitude, Longitude, Demande pondérée
- **Sortie** : 3-10 clusters avec hub optimal par zone

### Module B : Calculateur d'Empreinte (Système Expert)
- **Technique** : Système à Base de Règles (IA Symbolique)
- **8 Règles intégrées** :
  - R1: Facteur de base par mode de transport
  - R2: Zone de destination (Nord/Hauts-Plateaux/Sud)
  - R3: Traversée multi-zones
  - R4: Taux de chargement (pénalité si < 50%)
  - R5: Type de cargo (réfrigéré +35%)
  - R6: Trajet retour à vide
  - R7: Bonus train longue distance
  - R8: Pénalité extrême Sud

### Module C : Optimiseur Multi-Objectif (NSGA-II)
- **Technique** : Algorithme Génétique NSGA-II avec DEAP
- **Objectifs** : Minimiser simultanément Coût ET CO2
- **Sortie** : Front de Pareto avec solutions non-dominées
- **Curseur α** : Permet de choisir le compromis

## Prérequis

- Python 3.9+
- Node.js 18+
- npm ou yarn

## Installation

### Backend Python

```bash
cd backend

# Créer un environnement virtuel
python -m venv venv

# Activer l'environnement
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Installer les dépendances
pip install -r requirements.txt
```

### Frontend React

```bash
cd frontend

# Installer les dépendances
npm install
```

## Lancement

### 1. Démarrer le Backend (API)

```bash
cd backend
python -m uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

L'API sera disponible sur : http://localhost:8000
Documentation Swagger : http://localhost:8000/docs

### 2. Démarrer le Frontend

```bash
cd frontend
npm run dev
```

L'interface sera disponible sur : http://localhost:5173

## Utilisation

### 1. Onglet "Optimisation"
- Ajustez le curseur α (0 = priorité écologie, 1 = priorité économie)
- Choisissez le nombre de demandes de test
- Cliquez sur "Lancer l'Optimisation"
- Visualisez le Front de Pareto et la solution recommandée

### 2. Onglet "Clustering"
- Choisissez le nombre de hubs régionaux (3-10)
- Lancez le clustering K-Means
- Visualisez les clusters sur la carte avec les itinéraires réels

### 3. Onglet "Empreinte CO2"
- Cliquez sur deux wilayas sur la carte
- Comparez l'empreinte carbone par mode de transport
- Consultez les règles du système expert

## API Endpoints

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/wilayas` | GET | Liste des 58 wilayas |
| `/clustering` | POST | Segmentation K-Means |
| `/clustering/optimize-k` | GET | Trouver K optimal |
| `/carbon/calculate` | POST | Calcul empreinte CO2 |
| `/carbon/compare` | POST | Comparaison modes transport |
| `/optimize` | POST | Optimisation NSGA-II |
| `/optimize/sample` | POST | Génération + Optimisation |
| `/routing/route` | POST | Itinéraire réel OSRM |
| `/routing/cluster-routes` | GET | Routes des clusters |

## Structure des Fichiers

```
projet_finale_raouf/
├── backend/
│   ├── api/
│   │   └── main.py              # API FastAPI
│   ├── data/
│   │   └── wilayas_algeria.py   # Données 58 wilayas
│   ├── modules/
│   │   ├── clustering.py        # Module A: K-Means
│   │   ├── carbon_expert.py     # Module B: Système Expert
│   │   ├── optimizer.py         # Module C: NSGA-II
│   │   ├── routing.py           # Routage OSRM
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AlgeriaMap.jsx   # Carte interactive
│   │   │   ├── AlgeriaMapReal.jsx # Carte avec routes OSRM
│   │   │   ├── Charts.jsx       # Graphiques Recharts
│   │   │   └── Controls.jsx     # Composants UI
│   │   ├── utils/
│   │   │   └── api.js           # Client API
│   │   ├── App.jsx              # Application principale
│   │   └── main.jsx             # Point d'entrée
│   └── package.json
│
├── rapport_projet.tex           # Rapport LaTeX complet
├── references.bib               # Références bibliographiques
└── README.md
```

## Technologies Utilisées

### Backend
- **FastAPI** : Framework API REST haute performance
- **scikit-learn** : Clustering K-Means
- **DEAP** : Algorithmes évolutionnaires (NSGA-II)
- **NumPy/Pandas** : Calcul scientifique

### Frontend
- **React 18** : Interface utilisateur
- **Vite** : Build tool rapide
- **Tailwind CSS** : Styling
- **Recharts** : Graphiques (Pareto, évolution)
- **Lucide React** : Icônes

## Données

Le système inclut des données réalistes pour les 58 wilayas :
- Coordonnées GPS
- Population
- Demande logistique (tonnes/mois)
- Zone climatique (Nord, Hauts-Plateaux, Sud)
- Accessibilité ferroviaire SNTF

## Formule d'Optimisation

```
Minimize f(x) = α × CoûtTotal(x) + (1-α) × EmissionCO2(x)
```

Où α ∈ [0, 1] est le curseur de compromis :
- α = 0 : Minimiser uniquement le CO2
- α = 0.5 : Équilibre coût/écologie
- α = 1 : Minimiser uniquement le coût
