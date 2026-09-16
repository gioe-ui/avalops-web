import { useState } from "react";
import { toast } from "sonner";

/**
 * Descarrega um gráfico como imagem.
 *
 * Os gráficos do Recharts são SVG, por isso o SVG é serializado, desenhado num
 * canvas ao dobro da resolução e exportado. Procura o maior SVG dentro do
 * elemento indicado, para não apanhar ícones.
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

      const canvas = document.createElement("canvas");
      canvas.width = rect.width * 2;
      canvas.height = rect.height * 2;

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Não foi possível obter o contexto 2D do canvas.");

      ctx.scale(2, 2);
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, rect.width, rect.height);

      const svgString = new XMLSerializer().serializeToString(svgElement);
      const img = new Image();

      img.onload = () => {
        ctx.drawImage(img, 0, 0);

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
