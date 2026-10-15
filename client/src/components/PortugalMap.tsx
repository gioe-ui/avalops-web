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

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
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

        const total = Math.max(0, Math.floor(Number(count) || 0));
        const size = Math.min(20 + total * 5, 40);
        const icon = L.divIcon({
          // Só números entram neste HTML; o nome do CTer vai por textContent.
          html: `
            <div style="
              width: ${size}px;
              height: ${size}px;
              background-color: #8e1b1b;
              border: 2px solid #ffffff;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: bold;
              color: white;
              font-size: 12px;
              box-shadow: 0 2px 6px rgba(0,0,0,0.35);
            ">${total}</div>
          `,
          className: "",
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
          popupAnchor: [0, -size / 2],
        });

        // O conteúdo do popup é construído com nós DOM e textContent, nunca com
        // HTML montado a partir de texto vindo da base de dados.
        const popup = document.createElement("div");
        const nome = document.createElement("strong");
        nome.textContent = cterName;
        popup.append(nome, document.createElement("br"), document.createTextNode(`4º NEOP: ${total}`));

        const marker = L.marker([coords.lat, coords.lng], { icon, title: `${cterName}: ${total}` })
          .bindPopup(popup)
          .addTo(map.current!);

        markersRef.current.push(marker);
      });
    }
  }, [neop4ByCter, cterCoordinates]);

  // Ao sair da página o mapa é destruído; sem isto o Leaflet ficava em memória.
  useEffect(
    () => () => {
      map.current?.remove();
      map.current = null;
    },
    [],
  );

  // Sem cabeçalho próprio: quem usa este componente já o envolve num cartão
  // com título. Na versão anterior o título aparecia duas vezes.
  return (
    <div>
      <div
        ref={mapContainer}
        className="w-full rounded-lg overflow-hidden border border-ral-200 h-[420px] sm:h-[600px]"
        role="region"
        aria-label="Mapa de Portugal com o número de 4º NEOP por Comando Territorial"
      />
      <p className="text-xs text-ral-600 mt-2">
        Cada ponto é um Comando Territorial; o tamanho corresponde ao número de registos de 4º NEOP.
        Clique num ponto para ver o detalhe.
      </p>
    </div>
  );
}
