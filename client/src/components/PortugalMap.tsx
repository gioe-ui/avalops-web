import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface PortugalMapProps {
  neop4ByCter?: Record<string, number>;
  cterCoordinates: Record<string, { lat: number; lng: number }>;
}

/**
 * Mapa dos registos de 4º NEOP por Comando Territorial.
 *
 * Os tiles vêm do OpenStreetMap, ou seja, o browser de cada utilizador faz
 * pedidos a um servidor externo enquanto o mapa está aberto. Se isso não for
 * aceitável para dados desta natureza, substituir a camada de tiles por uma
 * interna ou por uma imagem estática de Portugal.
 */
export default function PortugalMap({ neop4ByCter, cterCoordinates }: PortugalMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    if (!mapContainer.current) return;

    if (!map.current) {
      map.current = L.map(mapContainer.current).setView([39.5, -8.0], 7);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map.current);
    }

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    if (neop4ByCter) {
      Object.entries(neop4ByCter).forEach(([cterName, count]) => {
        const coords = cterCoordinates[cterName];
        if (!coords) return;

        const size = Math.min(20 + count * 5, 40);
        const icon = L.divIcon({
          html: `
            <div style="
              width: ${size}px;
              height: ${size}px;
              background-color: #ef4444;
              border: 2px solid #dc2626;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: bold;
              color: white;
              font-size: 12px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            ">${count}</div>
          `,
          className: "",
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
          popupAnchor: [0, -size / 2],
        });

        const marker = L.marker([coords.lat, coords.lng], { icon })
          .bindPopup(
            `<div><strong>${cterName}</strong><br/>4º NEOP: ${count}</div>`,
          )
          .addTo(map.current!);

        markersRef.current.push(marker);
      });
    }
  }, [neop4ByCter, cterCoordinates]);

  // Sem cabeçalho próprio: quem usa este componente já o envolve num cartão
  // com título. Na versão anterior o título aparecia duas vezes.
  return (
    <div>
      <div
        ref={mapContainer}
        className="w-full rounded-lg overflow-hidden"
        style={{ minHeight: "600px" }}
      />
      <p className="text-xs text-gray-600 mt-2">
        Cada ponto vermelho é um Comando Territorial; o tamanho corresponde ao número de registos
        de 4º NEOP. Clique num ponto para ver o detalhe.
      </p>
    </div>
  );
}
