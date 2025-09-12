import { useEffect, useRef } from "react";
import type { FilterState } from "@/types/analytics";
import { semantics } from "@/lib/semantics";

interface RevenueTrendChartProps {
  filterState: FilterState;
}

export default function RevenueTrendChart({ filterState }: RevenueTrendChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (canvasRef.current) {
      import("chart.js/auto").then((Chart) => {
        const ctx = canvasRef.current!.getContext('2d')!;
        
        // Destroy existing chart
        if (chartRef.current) {
          chartRef.current.destroy();
        }

        const timeSeriesData = semantics.getTimeSeriesData(filterState);
        
        chartRef.current = new Chart.default(ctx, {
          type: 'line',
          data: {
            labels: timeSeriesData.map(d => new Date(d.date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })),
            datasets: [{
              label: '売上 (万円)',
              data: timeSeriesData.map(d => Math.round(d.revenue / 10000)),
              borderColor: 'hsl(220, 70%, 50%)',
              backgroundColor: 'hsla(220, 70%, 50%, 0.1)',
              tension: 0.4,
              yAxisID: 'y'
            }, {
              label: '新規顧客数',
              data: timeSeriesData.map(d => d.new_customers),
              borderColor: 'hsl(160, 60%, 45%)',
              backgroundColor: 'hsla(160, 60%, 45%, 0.1)',
              tension: 0.4,
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
                title: { display: true, text: '新規顧客数', color: 'hsl(213, 31%, 91%)' },
                ticks: { color: 'hsl(217.9, 10.6%, 64.9%)' },
                grid: { drawOnChartArea: false }
              }
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
  }, [filterState]);

  return <canvas ref={canvasRef} className="w-full h-80" data-testid="revenue-trend-chart" />;
}
