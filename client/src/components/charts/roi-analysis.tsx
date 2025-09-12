import { useEffect, useRef, useState } from "react";
import type { DecisionLogWithOutcome } from "@/types/analytics";

interface ROIAnalysisChartProps {
  decisions: DecisionLogWithOutcome[];
}

export default function ROIAnalysisChart({ decisions }: ROIAnalysisChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;
    
    const initChart = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Wait for canvas ref to be available
        if (!canvasRef.current) {
          // Retry after a short delay
          timeoutId = setTimeout(() => {
            if (isMounted) {
              initChart();
            }
          }, 100);
          return;
        }

        // Destroy existing chart
        if (chartRef.current) {
          chartRef.current.destroy();
          chartRef.current = null;
        }

        const Chart = await import("chart.js/auto");
        
        if (!isMounted) return;
        
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) {
          throw new Error('Unable to get canvas context');
        }

        // Process decisions with outcomes for ROI analysis
        const dataPoints = decisions
          .filter(d => d.outcome && d.outcome.status !== 'Ongoing')
          .map(d => {
            const expectedValue = parseFloat(d.expected_uplift.match(/\d+/)?.[0] || '0');
            const actualValue = d.outcome!.actual_value;
            
            // Calculate ROI: (Actual Value / Expected Value) * 100 - 100
            const roi = expectedValue > 0 ? ((actualValue / expectedValue) * 100) : 0;
            
            return {
              x: expectedValue,
              y: Math.max(0, roi),
              status: d.outcome!.status,
              context: d.context,
              decision_id: d.decision_id
            };
          });

        // Color mapping by status
        const colors = dataPoints.map(point => {
          switch (point.status) {
            case 'Success': return 'hsl(160, 60%, 45%)';
            case 'Partial': return 'hsl(30, 80%, 55%)';
            case 'Failed': return 'hsl(0, 62.8%, 50%)';
            default: return 'hsl(220, 70%, 50%)';
          }
        });

        const borderColors = dataPoints.map(point => {
          switch (point.status) {
            case 'Success': return 'hsl(160, 60%, 55%)';
            case 'Partial': return 'hsl(30, 80%, 65%)';
            case 'Failed': return 'hsl(0, 62.8%, 60%)';
            default: return 'hsl(220, 70%, 60%)';
          }
        });
        
        chartRef.current = new Chart.default(ctx, {
          type: 'scatter',
          data: {
            datasets: [{
              label: '意思決定結果',
              data: dataPoints,
              backgroundColor: colors,
              borderColor: borderColors,
              pointRadius: 6,
              pointHoverRadius: 8,
              borderWidth: 2
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
                  title: function(context) {
                    const point = context[0].raw as any;
                    return point.decision_id || '';
                  },
                  label: function(context) {
                    const point = context.raw as any;
                    return [
                      `期待効果: ${point.x}%`,
                      `ROI: ${point.y.toFixed(1)}%`,
                      `ステータス: ${point.status}`,
                      `内容: ${point.context.substring(0, 50)}...`
                    ];
                  }
                }
              }
            },
            scales: {
              x: { 
                title: { display: true, text: '期待効果 (%)', color: 'hsl(213, 31%, 91%)' },
                ticks: { 
                  color: 'hsl(217.9, 10.6%, 64.9%)',
                  callback: function(value) {
                    return value + '%';
                  }
                },
                grid: { color: 'hsl(215, 27.9%, 16.9%)' }
              },
              y: { 
                title: { display: true, text: 'ROI (%)', color: 'hsl(213, 31%, 91%)' },
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
              mode: 'point',
              intersect: true,
            }
          }
        });
        
        if (isMounted) {
          setIsLoading(false);
        }
      } catch (err) {
        console.error('ROI Chart initialization failed:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Chart initialization failed');
          setIsLoading(false);
        }
      }
    };

    initChart();

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [decisions]);

  return (
    <div className="relative w-full h-64">
      <canvas ref={canvasRef} className="w-full h-full" data-testid="roi-analysis-chart" />
      
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex items-center space-x-2 text-muted-foreground">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            <span>ROI分析を読み込み中...</span>
          </div>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="text-center text-muted-foreground">
            <p>ROI分析の読み込みに失敗しました</p>
            <p className="text-xs mt-1">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}