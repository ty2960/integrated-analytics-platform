import { useEffect, useRef, useState } from "react";
import type { FilterState } from "@/types/analytics";
import { semantics } from "@/lib/semantics";

interface SegmentComparisonChartProps {
  filterState: FilterState;
}

export default function SegmentComparisonChart({ filterState }: SegmentComparisonChartProps) {
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

        const segmentData = semantics.getSegmentData(filterState);
        
        if (!segmentData || segmentData.length === 0) {
          throw new Error('No segment data available');
        }

        chartRef.current = new Chart.default(ctx, {
          type: 'bar',
          data: {
            labels: segmentData.map(s => s.segment),
            datasets: [{
              label: '売上 (万円)',
              data: segmentData.map(s => Math.round(s.revenue / 10000)),
              backgroundColor: [
                'hsl(220, 70%, 50%)',
                'hsl(160, 60%, 45%)', 
                'hsl(30, 80%, 55%)'
              ],
              borderColor: [
                'hsl(220, 70%, 60%)',
                'hsl(160, 60%, 55%)', 
                'hsl(30, 80%, 65%)'
              ],
              borderWidth: 1
            }, {
              label: 'AOV (円)',
              data: segmentData.map(s => Math.round(s.aov / 100)), // Scale down for better visualization
              backgroundColor: [
                'hsl(280, 65%, 60%)',
                'hsl(340, 75%, 55%)',
                'hsl(200, 70%, 50%)'
              ],
              borderColor: [
                'hsl(280, 65%, 70%)',
                'hsl(340, 75%, 65%)',
                'hsl(200, 70%, 60%)'
              ],
              borderWidth: 1,
              yAxisID: 'y1'
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
                    const datasetLabel = context.dataset.label || '';
                    if (datasetLabel.includes('AOV')) {
                      return `${datasetLabel}: ¥${(context.parsed.y * 100).toLocaleString()}`;
                    } else {
                      return `${datasetLabel}: ¥${(context.parsed.y * 10000).toLocaleString()}`;
                    }
                  }
                }
              }
            },
            scales: {
              x: { 
                ticks: { color: 'hsl(217.9, 10.6%, 64.9%)' },
                grid: { color: 'hsl(215, 27.9%, 16.9%)' }
              },
              y: { 
                type: 'linear',
                display: true,
                position: 'left',
                title: { display: true, text: '売上 (万円)', color: 'hsl(213, 31%, 91%)' },
                ticks: { color: 'hsl(217.9, 10.6%, 64.9%)' },
                grid: { color: 'hsl(215, 27.9%, 16.9%)' }
              },
              y1: {
                type: 'linear',
                display: true,
                position: 'right',
                title: { display: true, text: 'AOV (百円)', color: 'hsl(213, 31%, 91%)' },
                ticks: { color: 'hsl(217.9, 10.6%, 64.9%)' },
                grid: { drawOnChartArea: false }
              }
            },
            interaction: {
              mode: 'index',
              intersect: false,
            }
          }
        });
        
        if (isMounted) {
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Chart initialization failed:', err);
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
  }, [filterState]);

  return (
    <div className="relative w-full h-64">
      <canvas ref={canvasRef} className="w-full h-full" data-testid="segment-comparison-chart" />
      
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex items-center space-x-2 text-muted-foreground">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            <span>チャートを読み込み中...</span>
          </div>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="text-center text-muted-foreground">
            <p>チャートの読み込みに失敗しました</p>
            <p className="text-xs mt-1">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}