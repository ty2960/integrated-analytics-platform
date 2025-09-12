import { useEffect, useRef, useState } from "react";
import type { PredictionResult } from "@/types/analytics";

interface PredictionChartProps {
  predictionResult: PredictionResult;
}

export default function PredictionChart({ predictionResult }: PredictionChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<any>(null);
  const [isChartLoaded, setIsChartLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function initChart() {
      if (!canvasRef.current || !predictionResult) return;

      try {
        // Dynamic import of Chart.js
        const Chart = (await import("chart.js/auto")).default;
        
        if (!mounted) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Destroy existing chart instance
        if (chartInstanceRef.current) {
          chartInstanceRef.current.destroy();
          chartInstanceRef.current = null;
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
        
        // Create chart instance
        chartInstanceRef.current = new Chart(ctx, {
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
            animation: {
              duration: 750,
              easing: 'easeInOutCubic'
            },
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
                    const unit = predictionResult.target_metric === 'AOV' ? '円' : '%';
                    return `${context.dataset.label}: ${context.parsed.y.toFixed(1)}${unit}`;
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
                title: { 
                  display: true, 
                  text: predictionResult.target_metric === 'AOV' ? `${predictionResult.target_metric} (円)` : `${predictionResult.target_metric} (%)`, 
                  color: 'hsl(213, 31%, 91%)' 
                },
                ticks: { 
                  color: 'hsl(217.9, 10.6%, 64.9%)',
                  callback: function(value) {
                    const unit = predictionResult.target_metric === 'AOV' ? '円' : '%';
                    return value + unit;
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

        if (mounted) {
          setIsChartLoaded(true);
        }
      } catch (error) {
        console.error('Failed to initialize prediction chart:', error);
        setIsChartLoaded(false);
      }
    }

    initChart();

    return () => {
      mounted = false;
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [predictionResult]);

  return (
    <div className="relative w-full h-64">
      <canvas 
        ref={canvasRef} 
        className="w-full h-full" 
        data-testid="prediction-chart"
      />
      {!isChartLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-card/50 backdrop-blur-sm rounded-lg">
          <div className="flex items-center space-x-2 text-muted-foreground">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            <span className="text-sm">予測チャートを読み込み中...</span>
          </div>
        </div>
      )}
    </div>
  );
}
