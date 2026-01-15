"""
Module de Routage Réel avec OSRM

Ce module utilise l'API OSRM (Open Source Routing Machine) pour obtenir
les itinéraires réels entre les wilayas algériennes.

OSRM retourne :
- La géométrie exacte de la route (polyline)
- La distance réelle (pas à vol d'oiseau)
- Le temps de trajet estimé
"""

import httpx
import asyncio
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from data.wilayas_algeria import WILAYAS_DATA, calculate_distance


@dataclass
class RouteResult:
    """Résultat d'un calcul d'itinéraire."""
    origin: str
    destination: str
    distance_km: float
    duration_minutes: float
    geometry: List[List[float]]  # Liste de [longitude, latitude]
    waypoints: List[Dict]
    success: bool
    error: Optional[str] = None


class OSRMRouter:
    """
    Client pour l'API OSRM (Open Source Routing Machine).
    Utilise le serveur public de démonstration OSRM.
    """

    # Serveur OSRM public (limité, pour production utiliser son propre serveur)
    BASE_URL = "https://router.project-osrm.org"

    # Cache pour éviter les appels répétés
    _cache: Dict[str, RouteResult] = {}

    def __init__(self, timeout: float = 10.0):
        """
        Initialise le routeur OSRM.

        Args:
            timeout: Timeout en secondes pour les requêtes HTTP
        """
        self.timeout = timeout

    def _get_cache_key(self, origin: str, destination: str) -> str:
        """Génère une clé de cache unique."""
        return f"{origin}|{destination}"

    async def get_route_async(
        self,
        origin: str,
        destination: str,
        use_cache: bool = True
    ) -> RouteResult:
        """
        Obtient l'itinéraire réel entre deux wilayas (async).

        Args:
            origin: Nom de la wilaya d'origine
            destination: Nom de la wilaya de destination
            use_cache: Utiliser le cache

        Returns:
            RouteResult avec la géométrie et les informations
        """
        cache_key = self._get_cache_key(origin, destination)

        # Vérifier le cache
        if use_cache and cache_key in self._cache:
            return self._cache[cache_key]

        # Valider les wilayas
        if origin not in WILAYAS_DATA:
            return RouteResult(
                origin=origin,
                destination=destination,
                distance_km=0,
                duration_minutes=0,
                geometry=[],
                waypoints=[],
                success=False,
                error=f"Wilaya origine '{origin}' non trouvée"
            )

        if destination not in WILAYAS_DATA:
            return RouteResult(
                origin=origin,
                destination=destination,
                distance_km=0,
                duration_minutes=0,
                geometry=[],
                waypoints=[],
                success=False,
                error=f"Wilaya destination '{destination}' non trouvée"
            )

        # Coordonnées (OSRM utilise lon,lat)
        origin_data = WILAYAS_DATA[origin]
        dest_data = WILAYAS_DATA[destination]

        origin_lon, origin_lat = origin_data[1], origin_data[0]
        dest_lon, dest_lat = dest_data[1], dest_data[0]

        # Construire l'URL OSRM
        url = (
            f"{self.BASE_URL}/route/v1/driving/"
            f"{origin_lon},{origin_lat};{dest_lon},{dest_lat}"
            f"?overview=full&geometries=geojson&steps=false"
        )

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url)
                response.raise_for_status()
                data = response.json()

            if data.get("code") != "Ok":
                # Fallback vers ligne droite si OSRM échoue
                return self._fallback_route(origin, destination, data.get("message"))

            route = data["routes"][0]
            geometry = route["geometry"]["coordinates"]

            result = RouteResult(
                origin=origin,
                destination=destination,
                distance_km=round(route["distance"] / 1000, 2),
                duration_minutes=round(route["duration"] / 60, 1),
                geometry=geometry,
                waypoints=[
                    {
                        "name": wp.get("name", ""),
                        "location": wp["location"]
                    }
                    for wp in data.get("waypoints", [])
                ],
                success=True
            )

            # Mettre en cache
            if use_cache:
                self._cache[cache_key] = result

            return result

        except httpx.TimeoutException:
            return self._fallback_route(origin, destination, "Timeout OSRM")
        except httpx.HTTPError as e:
            return self._fallback_route(origin, destination, str(e))
        except Exception as e:
            return self._fallback_route(origin, destination, str(e))

    def get_route(
        self,
        origin: str,
        destination: str,
        use_cache: bool = True
    ) -> RouteResult:
        """
        Obtient l'itinéraire réel entre deux wilayas (sync).
        """
        return asyncio.run(self.get_route_async(origin, destination, use_cache))

    def _fallback_route(
        self,
        origin: str,
        destination: str,
        error_msg: str
    ) -> RouteResult:
        """
        Crée une route de fallback (ligne droite) si OSRM échoue.
        """
        origin_data = WILAYAS_DATA.get(origin)
        dest_data = WILAYAS_DATA.get(destination)

        if not origin_data or not dest_data:
            return RouteResult(
                origin=origin,
                destination=destination,
                distance_km=0,
                duration_minutes=0,
                geometry=[],
                waypoints=[],
                success=False,
                error=error_msg
            )

        # Ligne droite comme fallback
        distance = calculate_distance(origin, destination)
        geometry = [
            [origin_data[1], origin_data[0]],  # [lon, lat]
            [dest_data[1], dest_data[0]]
        ]

        return RouteResult(
            origin=origin,
            destination=destination,
            distance_km=round(distance, 2),
            duration_minutes=round(distance / 60 * 60, 1),  # ~60 km/h
            geometry=geometry,
            waypoints=[],
            success=True,
            error=f"Fallback (ligne droite): {error_msg}"
        )

    async def get_multi_route_async(
        self,
        waypoints: List[str],
        use_cache: bool = True
    ) -> Dict:
        """
        Obtient un itinéraire passant par plusieurs wilayas.

        Args:
            waypoints: Liste ordonnée des wilayas

        Returns:
            Dictionnaire avec la route complète
        """
        if len(waypoints) < 2:
            return {
                "success": False,
                "error": "Au moins 2 waypoints requis",
                "segments": [],
                "total_distance_km": 0,
                "total_duration_minutes": 0,
                "full_geometry": []
            }

        segments = []
        full_geometry = []
        total_distance = 0
        total_duration = 0

        for i in range(len(waypoints) - 1):
            route = await self.get_route_async(
                waypoints[i],
                waypoints[i + 1],
                use_cache
            )

            segments.append({
                "from": waypoints[i],
                "to": waypoints[i + 1],
                "distance_km": route.distance_km,
                "duration_minutes": route.duration_minutes,
                "geometry": route.geometry,
                "success": route.success,
                "error": route.error
            })

            total_distance += route.distance_km
            total_duration += route.duration_minutes

            # Ajouter la géométrie (éviter les doublons aux jonctions)
            if route.geometry:
                if full_geometry:
                    full_geometry.extend(route.geometry[1:])
                else:
                    full_geometry = route.geometry.copy()

        return {
            "success": True,
            "waypoints": waypoints,
            "segments": segments,
            "total_distance_km": round(total_distance, 2),
            "total_duration_minutes": round(total_duration, 1),
            "full_geometry": full_geometry
        }

    def get_multi_route(self, waypoints: List[str], use_cache: bool = True) -> Dict:
        """Version synchrone de get_multi_route_async."""
        return asyncio.run(self.get_multi_route_async(waypoints, use_cache))


# Instance globale
router = OSRMRouter()


# Test du module
if __name__ == "__main__":
    import asyncio

    async def test():
        print("=" * 60)
        print("TEST: Module de Routage OSRM")
        print("=" * 60)

        router = OSRMRouter()

        # Test 1: Route simple Alger → Constantine
        print("\n📍 Route Alger → Constantine:")
        result = await router.get_route_async("Alger", "Constantine")
        print(f"   Distance: {result.distance_km} km")
        print(f"   Durée: {result.duration_minutes} min")
        print(f"   Points géométrie: {len(result.geometry)}")
        print(f"   Succès: {result.success}")
        if result.error:
            print(f"   Note: {result.error}")

        # Test 2: Route multi-points
        print("\n📍 Route Alger → Sétif → Batna → Biskra:")
        multi = await router.get_multi_route_async(
            ["Alger", "Sétif", "Batna", "Biskra"]
        )
        print(f"   Distance totale: {multi['total_distance_km']} km")
        print(f"   Durée totale: {multi['total_duration_minutes']} min")
        print(f"   Segments: {len(multi['segments'])}")
        for seg in multi['segments']:
            print(f"      {seg['from']} → {seg['to']}: {seg['distance_km']} km")

        # Test 3: Route vers le Sud
        print("\n📍 Route Alger → Ghardaïa → Tamanrasset:")
        multi_south = await router.get_multi_route_async(
            ["Alger", "Ghardaïa", "Tamanrasset"]
        )
        print(f"   Distance totale: {multi_south['total_distance_km']} km")
        print(f"   Durée totale: {multi_south['total_duration_minutes']} min")

    asyncio.run(test())
