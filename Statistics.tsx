import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PortugalMap from "@/components/PortugalMap";
import { useChartDownload } from "@/hooks/useChartDownload";
import { Download } from "lucide-react";
import { trpc } from "@/lib/trpc";
import OperationsStatistics from "./OperationsStatistics";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const NEOP_COLORS = ["#1a472a", "#b8860b", "#8b0000"];

/** Coordenadas geográficas dos Comandos Territoriais, para o mapa. */
const CTER_COORDINATES: Record<string, { lat: number; lng: number }> = {
  "CT Aveiro": { lat: 40.64, lng: -8.65 },
  "CT Beja": { lat: 38.01, lng: -7.86 },
  "CT Braga": { lat: 41.55, lng: -8.43 },
  "CT Bragança": { lat: 41.81, lng: -6.76 },
  "CT Castelo Branco": { lat: 40.28, lng: -7.5 },
  "CT Coimbra": { lat: 40.28, lng: -8.49 },
  "CT Évora": { lat: 38.66, lng: -8.9 },
  "CT Faro": { lat: 37.02, lng: -7.93 },
  "CT Guarda": { lat: 40.54, lng: -7.27 },
  "CT Leiria": { lat: 39.74, lng: -8.81 },
  "CT Lisboa": { lat: 38.72, lng: -9.14 },
  "CT Portalegre": { lat: 39.3, lng: -7.43 },
  "CT Porto": { lat: 41.16, lng: -8.63 },
  "CT Santarém": { lat: 39.24, lng: -8.73 },
  "CT Setúbal": { lat: 38.52, lng: -8.89 },
  "CT Viana do Castelo": { lat: 41.7, lng: -8.83 },
  "CT Vila Real": { lat: 41.3, lng: -7.74 },
  "CT Viseu": { lat: 40.66, lng: -7.47 },
};

const DownloadButton = ({
  onClick,
  format,
  isLoading,
}: {
  onClick: () => void;
  format: "png" | "jpeg";
  isLoading?: boolean;
}) => (
  <button
    onClick={onClick}
    disabled={isLoading}
    className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-xs font-semibold flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
    title={`Descarregar como ${format.toUpperCase()}`}
    style={{ color: "#1a472a" }}
  >
    <Download className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
    {isLoading ? "A descarregar..." : format.toUpperCase()}
  </button>
);

export default function Statistics() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const { downloadChart, isDownloading } = useChartDownload();

  const { data: stats, isLoading } = trpc.statistics.get.useQuery({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  const { data: neop4ByCter } = trpc.statistics.neop4ByCter.useQuery({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  if (isLoading) {
    return <div className="text-center py-16 text-gray-400">A carregar estatísticas...</div>;
  }

  if (!stats) {
    return <div className="text-center py-16 text-gray-400">Sem dados disponíveis.</div>;
  }

  const neopData = [
    { name: "2º NEOP", value: stats.neop2 },
    { name: "3º NEOP", value: stats.neop3 },
    { name: "4º NEOP", value: stats.neop4 },
  ];

  const scoreData = [
    { range: "0–25", count: stats.score0_25 },
    { range: "26–50", count: stats.score26_50 },
    { range: "51–75", count: stats.score51_75 },
    { range: "76–100", count: stats.score76_100 },
  ];

  const statCards = [
    { label: "Total de Avaliações", value: stats.total },
    { label: "Pontuação Média", value: stats.avgScore.toFixed(1) },
    { label: "2º NEOP", value: stats.neop2 },
    { label: "3º NEOP", value: stats.neop3 },
    { label: "4º NEOP", value: stats.neop4 },
  ];

  const handleClearFilters = () => {
    setStartDate("");
    setEndDate("");
  };

  return (
    <div className="max-w-7xl mx-auto">
      <h2 className="text-xl font-bold mb-6" style={{ color: "#1a472a" }}>
        Estatísticas
      </h2>

      <div className="bg-white rounded-lg sm:rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-sm font-semibold text-gray-600 mb-2 block">Data inicial</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border-2 focus:border-[#1a472a]"
            />
          </div>
          <div>
            <Label className="text-sm font-semibold text-gray-600 mb-2 block">Data final</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border-2 focus:border-[#1a472a]"
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={handleClearFilters}
              variant="outline"
              className="w-full border-2 text-gray-600 hover:bg-gray-50"
            >
              Limpar filtros
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 lg:gap-4 mb-8">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="text-white text-center py-3 sm:py-4 px-2 sm:px-3 rounded-lg sm:rounded-xl"
            style={{ background: "linear-gradient(135deg, #1a472a 0%, #2d5a3d 100%)" }}
          >
            <p className="text-[10px] sm:text-xs uppercase tracking-wider opacity-80 mb-1 sm:mb-2">
              {card.label}
            </p>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-8">
        <div className="bg-white rounded-lg sm:rounded-xl p-3 sm:p-5 shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-3 sm:mb-4">
            <h3
              className="text-xs sm:text-sm font-bold uppercase tracking-wider"
              style={{ color: "#1a472a" }}
            >
              Distribuição por NEOP
            </h3>
            <div className="flex gap-2">
              <DownloadButton
                onClick={() => downloadChart("chart-neop", "distribuicao-neop", "png")}
                format="png"
                isLoading={isDownloading}
              />
              <DownloadButton
                onClick={() => downloadChart("chart-neop", "distribuicao-neop", "jpeg")}
                format="jpeg"
                isLoading={isDownloading}
              />
            </div>
          </div>
          {stats.total === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-xs sm:text-sm">
              Sem dados
            </div>
          ) : (
            <div id="chart-neop">
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={neopData}
                    cx="50%"
                    cy="45%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ cx, cy, midAngle, outerRadius, name, percent, index }: any) => {
                      if (!percent) return "";
                      const RADIAN = Math.PI / 180;
                      const baseRadius = outerRadius + 60;
                      const radius = percent < 0.1 ? baseRadius + 40 : baseRadius;
                      const x = cx + radius * Math.cos(-midAngle * RADIAN);
                      const y = cy + radius * Math.sin(-midAngle * RADIAN);
                      return (
                        <text
                          x={x}
                          y={y}
                          fill={NEOP_COLORS[index]}
                          textAnchor={x > cx ? "start" : "end"}
                          dominantBaseline="central"
                          fontSize="11"
                          fontWeight="bold"
                        >
                          {`${name} ${(percent * 100).toFixed(0)}%`}
                        </text>
                      );
                    }}
                    labelLine
                  >
                    {neopData.map((_, i) => (
                      <Cell key={i} fill={NEOP_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ paddingTop: "20px", fontSize: "11px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg sm:rounded-xl p-3 sm:p-5 shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-3 sm:mb-4">
            <h3
              className="text-xs sm:text-sm font-bold uppercase tracking-wider"
              style={{ color: "#1a472a" }}
            >
              Distribuição por pontuação
            </h3>
            <div className="flex gap-2">
              <DownloadButton
                onClick={() => downloadChart("chart-score", "distribuicao-pontuacao", "png")}
                format="png"
                isLoading={isDownloading}
              />
              <DownloadButton
                onClick={() => downloadChart("chart-score", "distribuicao-pontuacao", "jpeg")}
                format="jpeg"
                isLoading={isDownloading}
              />
            </div>
          </div>
          {stats.total === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-xs sm:text-sm">
              Sem dados
            </div>
          ) : (
            <div id="chart-score">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={scoreData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Avaliações" fill="#1a472a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg sm:rounded-xl p-3 sm:p-5 shadow-sm border border-gray-100 mb-8">
        <div className="flex justify-between items-center mb-3 sm:mb-4">
          <h3
            className="text-xs sm:text-sm font-bold uppercase tracking-wider"
            style={{ color: "#1a472a" }}
          >
            Mapa de 4º NEOP por CTer
          </h3>
          <div className="flex gap-2">
            <DownloadButton
              onClick={() => downloadChart("map-container", "mapa-4neop", "png")}
              format="png"
              isLoading={isDownloading}
            />
            <DownloadButton
              onClick={() => downloadChart("map-container", "mapa-4neop", "jpeg")}
              format="jpeg"
              isLoading={isDownloading}
            />
          </div>
        </div>
        <div id="map-container">
          <PortugalMap neop4ByCter={neop4ByCter} cterCoordinates={CTER_COORDINATES} />
        </div>
      </div>
    </div>
  );
}

export function StatisticsPage() {
  const [activeTab, setActiveTab] = useState<"avaliacoes" | "operacoes">("avaliacoes");

  return (
    <div>
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("avaliacoes")}
          className={`px-4 py-2 font-semibold transition-colors ${
            activeTab === "avaliacoes" ? "border-b-2" : "text-gray-600 hover:text-gray-800"
          }`}
          style={
            activeTab === "avaliacoes" ? { borderBottomColor: "#1a472a", color: "#1a472a" } : {}
          }
        >
          Avaliações
        </button>
        <button
          onClick={() => setActiveTab("operacoes")}
          className={`px-4 py-2 font-semibold transition-colors ${
            activeTab === "operacoes" ? "border-b-2" : "text-gray-600 hover:text-gray-800"
          }`}
          style={
            activeTab === "operacoes" ? { borderBottomColor: "#1a472a", color: "#1a472a" } : {}
          }
        >
          Operações
        </button>
      </div>
      {activeTab === "avaliacoes" ? <Statistics /> : <OperationsStatistics />}
    </div>
  );
}
