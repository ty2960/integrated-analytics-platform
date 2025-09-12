import { useEffect, useRef } from "react";
import type { PredictionResult } from "@/types/analytics";

interface PredictionChartProps {
  predictionResult: PredictionResult;
}

export default function PredictionChart({ predictionResult }: PredictionChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (canvasRef.current && predictionResult) {
      import("chart.js/auto").then((Chart) => {
        const ctx = canvasRef.current!.getContext('2d')!;
        
        // Destroy existing chart
        if (chartRef.current) {
          chartRef.current.destroy();
        }

        // Generate mock weekly progression for visualization
        const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
        const baseValue = predictionResult.predicted_value;
        const progression = weeks.map((_, index) => {
          const progress = (index + 1) / weeks.length;
          return baseValue * (0.7 + progress * 0.3); // Gradual increase to predicted value
        });

        const upperBound = weeks.map((_, index) => {
          const progress = (index + 1) / weeks.length;
          return predictionResult.confidence_upper * (0.7 + progress * 0.3);
        });

        const lowerBound = weeks.map((_, index) => {
          const progress = (index + 1) / weeks.length;
          return predictionResult.confidence_lower * (0.7 + progress * 0.3);
        });
        
        chartRef.current = new Chart.default(ctx, {
          type: 'line',
          data: {
            labels: weeks,
            datasets: [{
              label: `予測${predictionResult.target_metric}`,
              data: progression,
              borderColor: 'hsl(220, 70%, 50%)',
              backgroundColor: 'hsla(220, 70%, 50%, 0.1)',
              tension: 0.4,
              fill: false,
              pointRadius: 4,
              pointHoverRadius: 6
            }, {
              label: '上限 (95%信頼区間)',
              data: upperBound,
              borderColor: 'hsl(160, 60%, 45%)',
              backgroundColor: 'transparent',
              borderDash: [5, 5],
              tension: 0.4,
              fill: false,
              pointRadius: 2,
              pointHoverRadius: 4
            }, {
              label: '下限 (95%信頼区間)',
              data: lowerBound,
              borderColor: 'hsl(0, 62.8%, 50%)',
              backgroundColor: 'transparent',
              borderDash: [5, 5],
              tension: 0.4,
              fill: false,
              pointRadius: 2,
              pointHoverRadius: 4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                labels: { 
                  color: 'hsl(213, 31%, 91%)',
                  usePointStyle: true
                }
              },
              tooltip: {
                callbacks: {
                  label: function(context) {
                    return `${context.dataset.label}: ${context.parsed.y.toFixed(1)}%`;
                  }
                }
              }
            },
            scales: {
              x: { 
                title: { display: true, text: '予測期間', color: 'hsl(213, 31%, 91%)' },
                ticks: { color: 'hsl(217.9, 10.6%, 64.9%)' },
                grid: { color: 'hsl(215, 27.9%, 16.9%)' }
              },
              y: { 
                title: { display: true, text: `${predictionResult.target_metric} (%)`, color: 'hsl(213, 31%, 91%)' },
                ticks: { 
                  color: 'hsl(217.9, 10.6%, 64.9%)',
                  callback: function(value) {
                    return value + '%';
                  }
                },
                grid: { color: 'hsl(215, 27.9%, 16.9%)' }
              }
            },
            interaction: {
              mode: 'index',
              intersect: false,
            }
          }
        });
      });
    }

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [predictionResult]);

  return <canvas ref={canvasRef} className="w-full h-64" data-testid="prediction-chart" />;
}
