import { useState } from "react";
import { toast } from "sonner";
import { CLASSIFICACAO } from "@/components/Classificacao";
import { api } from "@/lib/api";
import { formatarDataHora } from "@/lib/datas";

/** Altura das faixas com a marca de classificação, em cima e em baixo. */
const FAIXA = 28;

/**
 * Descarrega um gráfico como imagem.
 *
 * Os gráficos do Recharts são SVG, por isso o SVG é serializado, desenhado num
 * canvas ao dobro da resolução e exportado. Procura o maior SVG dentro do
 * elemento indicado, para não apanhar ícones.
 *
 * Como as folhas de Excel, a imagem leva a marca de classificação em cima e
 * em baixo, e a descarga fica no registo de auditoria.
 */
export const useChartDownload = () => {
  const [isDownloading, setIsDownloading] = useState(false);

  const downloadChart = async (
    elementId: string,
    filename: string,
    format: "png" | "jpeg" = "png",
  ) => {
    setIsDownloading(true);

    try {
      const element = document.getElementById(elementId);
      if (!element) {
        toast.error("Não foi possível encontrar o gráfico.");
        setIsDownloading(false);
        return;
      }

      const svgs = element.querySelectorAll("svg");

      let targetSvg: SVGElement | null = null;
      let maxArea = 0;

      svgs.forEach((svg) => {
        const rect = svg.getBoundingClientRect();
        const area = rect.width * rect.height;
        // Ignora SVGs minúsculos, que são ícones e não o gráfico.
        if (area > 50 && area > maxArea) {
          maxArea = area;
          targetSvg = svg as SVGElement;
        }
      });

      if (!targetSvg) {
        toast.error("Não foi possível encontrar o gráfico para exportar.");
        setIsDownloading(false);
        return;
      }

      const svgElement = targetSvg as SVGElement;
      const rect = svgElement.getBoundingClientRect();

      const largura = rect.width;
      const altura = rect.height + 2 * FAIXA;

      const canvas = document.createElement("canvas");
      canvas.width = largura * 2;
      canvas.height = altura * 2;

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Não foi possível obter o contexto 2D do canvas.");

      ctx.scale(2, 2);
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, largura, altura);

      const marca = (texto: string, y: number) => {
        ctx.fillStyle = "#B42318";
        ctx.font = "bold 13px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(texto, largura / 2, y, largura - 16);
      };

      // Numa imagem o SVG não herda o CSS da página: sem isto os rótulos
      // saíam em Times. Copia-se o tipo de letra para uma cópia do SVG.
      const copia = svgElement.cloneNode(true) as SVGElement;
      copia.style.fontFamily = getComputedStyle(svgElement).fontFamily;
      const svgString = new XMLSerializer().serializeToString(copia);
      const img = new Image();

      img.onload = () => {
        ctx.drawImage(img, 0, FAIXA, rect.width, rect.height);
        marca(`${CLASSIFICACAO} — exportado em ${formatarDataHora(new Date())}`, FAIXA / 2);
        marca(CLASSIFICACAO, altura - FAIXA / 2);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              toast.error("Erro ao gerar a imagem do gráfico.");
              setIsDownloading(false);
              return;
            }

            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${filename}.${format}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            setIsDownloading(false);
            void api.audit.registar({
              acao: "EXPORT",
              detalhe: { recurso: "estatisticas", grafico: filename, formato: format },
            });
          },
          `image/${format}`,
          format === "jpeg" ? 0.95 : undefined,
        );
      };

      img.onerror = () => {
        toast.error("Erro ao processar o gráfico.");
        setIsDownloading(false);
      };

      // encodeURIComponent para os caracteres acentuados dos rótulos.
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgString);
    } catch (error) {
      toast.error(
        `Erro ao descarregar o gráfico: ${error instanceof Error ? error.message : "erro desconhecido"}`,
      );
      setIsDownloading(false);
    }
  };

  return { downloadChart, isDownloading };
};
