import { useEffect } from 'react';
import Sidebar from './components/Sidebar';
import dashboardStyles from './dashboard.module.css';
import statsStyles from './statistics.module.css';

export default function StatisticsPage() {

  useEffect(() => {
    // 1. Load Chart.js from CDN
    const chartScript = document.createElement('script');
    chartScript.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    chartScript.async = true;
    document.body.appendChild(chartScript);

    chartScript.onload = () => {
      // @ts-ignore
      const Chart = window.Chart;
      if (!Chart) return;

      // Common Chart.js Options for Premium Look
      Chart.defaults.color = '#90A0B7';
      Chart.defaults.font.family = "'Inter', sans-serif";

      const commonOptions = {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
              legend: { display: false },
              tooltip: {
                  backgroundColor: 'rgba(7, 9, 15, 0.95)',
                  titleColor: '#FFFFFF',
                  bodyColor: '#FFFFFF',
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  borderWidth: 1,
                  padding: 12,
                  cornerRadius: 8,
                  displayColors: true,
                  boxPadding: 4,
                  boxWidth: 8,
                  boxHeight: 8,
                  usePointStyle: true,
              }
          },
          interaction: {
              intersect: false,
              mode: 'index',
          },
          animation: {
              duration: 1500,
              easing: 'easeOutQuart'
          }
      };

      // 1. Movement Trends (Line Chart)
      const movementCtxElement = document.getElementById('movementChart') as HTMLCanvasElement;
      if (movementCtxElement) {
        const movementCtx = movementCtxElement.getContext('2d');
        if (movementCtx) {
          const gradientLine = movementCtx.createLinearGradient(0, 0, 0, 400);
          gradientLine.addColorStop(0, 'rgba(0, 199, 253, 0.5)'); // Cyan
          gradientLine.addColorStop(1, 'rgba(0, 199, 253, 0.0)');

          const movementChartData = {
              labels: ['Oct 20', 'Oct 21', 'Oct 22', 'Oct 23', 'Oct 24', 'Oct 25', 'Oct 26'],
              datasets: [
                  {
                      label: 'Steps Walked',
                      data: [6500, 8200, 7100, 11000, 9500, 6800, 10200],
                      borderColor: '#00C7FD',
                      backgroundColor: gradientLine,
                      borderWidth: 3,
                      fill: true,
                      tension: 0.4,
                      pointBackgroundColor: '#07090F',
                      pointBorderColor: '#00C7FD',
                      pointHoverBackgroundColor: '#00C7FD',
                      pointHoverBorderColor: '#FFF',
                      pointRadius: 4,
                      pointHoverRadius: 6
                  },
                  {
                      label: 'Daily Goal',
                      data: [8000, 8000, 8000, 8000, 8000, 8000, 8000],
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                      borderWidth: 2,
                      borderDash: [5, 5],
                      fill: false,
                      pointRadius: 0,
                      pointHoverRadius: 0
                  }
              ]
          };

          new Chart(movementCtxElement, {
              type: 'line',
              data: movementChartData,
              options: {
                  ...commonOptions,
                  scales: {
                      y: {
                          beginAtZero: true,
                          grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
                          ticks: { stepSize: 2000 }
                      },
                      x: {
                          grid: { display: false, drawBorder: false }
                      }
                  }
              }
          });
        }
      }

      // 2. Dietary Intake (Bar Chart)
      const dietCtxElement = document.getElementById('dietChart') as HTMLCanvasElement;
      if (dietCtxElement) {
        const dietCtx = dietCtxElement.getContext('2d');
        if (dietCtx) {
          const dietChartData = {
              labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
              datasets: [
                  {
                      label: 'Calories Consumed',
                      data: [2100, 2400, 1950, 2600, 2300, 2800, 2500],
                      backgroundColor: '#00C7FD', // Cyan
                      borderRadius: 4,
                      barPercentage: 0.6,
                      categoryPercentage: 0.8
                  },
                  {
                      label: 'Calories Burned',
                      data: [2300, 2200, 2400, 2100, 2600, 2000, 2700],
                      backgroundColor: '#0071C5', // Blue
                      borderRadius: 4,
                      barPercentage: 0.6,
                      categoryPercentage: 0.8
                  }
              ]
          };

          new Chart(dietCtxElement, {
              type: 'bar',
              data: dietChartData,
              options: {
                  ...commonOptions,
                  plugins: {
                      ...commonOptions.plugins,
                      tooltip: {
                          ...commonOptions.plugins.tooltip,
                          mode: 'index',
                          intersect: false
                      }
                  },
                  scales: {
                      y: {
                          beginAtZero: true,
                          grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
                          ticks: { stepSize: 500 }
                      },
                      x: {
                          grid: { display: false, drawBorder: false }
                      }
                  }
              }
          });
        }
      }

      // 3. Health Balance (Radar Chart)
      const balanceCtxElement = document.getElementById('balanceChart') as HTMLCanvasElement;
      if (balanceCtxElement) {
        const balanceCtx = balanceCtxElement.getContext('2d');
        if (balanceCtx) {
          const balanceChartData = {
              labels: ['Sleep Quality', 'Hydration', 'Nutrition', 'Cardio', 'Strength', 'Recovery'],
              datasets: [{
                  label: 'Current Balance',
                  data: [85, 70, 68, 92, 80, 75],
                  backgroundColor: 'rgba(0, 199, 253, 0.2)', // Cyan transparent
                  borderColor: '#00C7FD', // Cyan
                  pointBackgroundColor: '#0071C5',
                  pointBorderColor: '#fff',
                  pointHoverBackgroundColor: '#fff',
                  pointHoverBorderColor: '#00C7FD',
                  borderWidth: 2,
              }]
          };

          new Chart(balanceCtxElement, {
              type: 'radar',
              data: balanceChartData,
              options: {
                  maintainAspectRatio: false,
                  plugins: {
                      legend: { display: false },
                      tooltip: commonOptions.plugins.tooltip
                  },
                  scales: {
                      r: {
                          angleLines: {
                              color: 'rgba(255, 255, 255, 0.1)'
                          },
                          grid: {
                              color: 'rgba(255, 255, 255, 0.1)'
                          },
                          pointLabels: {
                              color: '#90A0B7',
                              font: {
                                  family: "'Inter', sans-serif",
                                  size: 11
                              }
                          },
                          ticks: {
                              display: false, // Hide number ticks to keep it clean
                              min: 0,
                              max: 100,
                              stepSize: 20
                          }
                      }
                  },
                  animation: {
                      duration: 2000,
                      easing: 'easeOutQuart'
                  }
              }
          });
        }
      }
    };

    return () => {
      // Cleanup Chart.js script if component unmounts quickly
      if (document.body.contains(chartScript)) {
        document.body.removeChild(chartScript);
      }
    };
  }, []);

  return (
    <div className={dashboardStyles.appShell}>
      {/* Background effects */}
      <div className={dashboardStyles.backgroundEffects}>
        <div className={`${dashboardStyles.glow} ${dashboardStyles.glow1}`} />
        <div className={`${dashboardStyles.glow} ${dashboardStyles.glow2}`} />
        <div className={`${dashboardStyles.glow} ${dashboardStyles.glow3}`} />
      </div>

      <Sidebar />

      <main className={dashboardStyles.main}>
        <header className={dashboardStyles.topHeader}>
          <div className={dashboardStyles.greeting}>
            <h1 data-i18n="st_title">Health Analytics</h1>
            <p data-i18n="st_subtitle">Deep dive into your progression over time.</p>
          </div>

          <div className={statsStyles.datePickerControls}>
            <button className={statsStyles.dateNavBtn}><i className="fa-solid fa-chevron-left"></i></button>
            <div className={statsStyles.dateRange}>Oct 20, 2023 - Oct 26, 2023</div>
            <button className={statsStyles.dateNavBtn}><i className="fa-solid fa-chevron-right"></i></button>
          </div>
        </header>

        <div className={statsStyles.statsGrid}>

          {/* Movement Chart (Large Line Graph) */}
          <div className={`${statsStyles.gridCard} ${statsStyles.wide} ${statsStyles.chartCard}`}>
            <div className={statsStyles.cardHeader} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <h2 data-i18n="st_move_trends" style={{ color: 'white' }}>Movement Trends</h2>
                <span className={statsStyles.subtitle} data-i18n="st_move_sub">Daily step count vs goal</span>
              </div>
              <div className={statsStyles.metricSummary}>
                <div className={statsStyles.summaryItem}>
                  <span className={statsStyles.label} data-i18n="st_avg_steps">Avg Steps</span>
                  <span className={`${statsStyles.value} ${statsStyles.cyan}`}>8,432</span>
                </div>
              </div>
            </div>
            <div className={`${statsStyles.chartWrapper} ${statsStyles.lineChartWrapper}`}>
              <canvas id="movementChart"></canvas>
            </div>
          </div>

          {/* Dietary Intake (Bar Chart) */}
          <div className={`${statsStyles.gridCard} ${statsStyles.chartCard}`}>
            <div className={statsStyles.cardHeader}>
              <div>
                <h2 data-i18n="st_diet_intake" style={{ color: 'white' }}>Dietary Intake</h2>
                <span className={statsStyles.subtitle} data-i18n="st_diet_sub">Calories consumed vs burned</span>
              </div>
            </div>
            <div className={`${statsStyles.chartWrapper} ${statsStyles.barChartWrapper}`}>
              <canvas id="dietChart"></canvas>
            </div>
            <div className={statsStyles.customLegend}>
              <div className={statsStyles.legendItem}>
                <span className={`${statsStyles.dot} ${statsStyles.consumed}`}></span> <span data-i18n="st_consumed">Consumed</span>
              </div>
              <div className={statsStyles.legendItem}>
                <span className={`${statsStyles.dot} ${statsStyles.burned}`}></span> <span data-i18n="st_burned">Burned</span>
              </div>
            </div>
          </div>

          {/* Overall Health Balance (Radar Chart) */}
          <div className={`${statsStyles.gridCard} ${statsStyles.chartCard}`}>
            <div className={statsStyles.cardHeader}>
              <div>
                <h2 data-i18n="st_balance" style={{ color: 'white' }}>Health Balance</h2>
                <span className={statsStyles.subtitle} data-i18n="st_balance_sub">Holistic score breakdown</span>
              </div>
            </div>
            <div className={`${statsStyles.chartWrapper} ${statsStyles.radarChartWrapper}`}>
              <canvas id="balanceChart"></canvas>
            </div>
            <ul className={statsStyles.balanceMetrics}>
              <li><span data-i18n="st_sleep">Sleep</span> <strong className={statsStyles.cyan}>85%</strong></li>
              <li><span data-i18n="st_activity">Activity</span> <strong className={statsStyles.blue}>92%</strong></li>
              <li><span data-i18n="st_nutrition">Nutrition</span> <strong className={statsStyles.warning}>68%</strong></li>
            </ul>
          </div>

          {/* Quick Insights List */}
          <div className={`${statsStyles.gridCard} ${statsStyles.insightsCard} ${statsStyles.wide}`}>
            <div className={statsStyles.cardHeader}>
              <h2 data-i18n="st_insights" style={{ color: 'white' }}>Weekly Insights</h2>
            </div>
            <div className={statsStyles.insightsGrid}>
              <div className={statsStyles.insightItem}>
                <div className={`${statsStyles.iconCircle} ${statsStyles.positive}`}><i className="fa-solid fa-arrow-trend-up"></i></div>
                <div>
                  <h4 data-i18n="st_insight_act_title" style={{ color: 'white' }}>Activity Increased</h4>
                  <p data-i18n="st_insight_act_desc">Your movement score is up 12% this week compared to last week.</p>
                </div>
              </div>
              <div className={statsStyles.insightItem}>
                <div className={`${statsStyles.iconCircle} ${statsStyles.warning}`}><i className="fa-solid fa-utensils"></i></div>
                <div>
                  <h4 data-i18n="st_insight_diet_title" style={{ color: 'white' }}>Caloric Surplus</h4>
                  <p data-i18n="st_insight_diet_desc">You consumed 300 calories over your daily target on average.</p>
                </div>
              </div>
              <div className={statsStyles.insightItem}>
                <div className={`${statsStyles.iconCircle} ${statsStyles.positive}`}><i className="fa-solid fa-moon"></i></div>
                <div>
                  <h4 data-i18n="st_insight_sleep_title" style={{ color: 'white' }}>Consistent Sleep</h4>
                  <p data-i18n="st_insight_sleep_desc">You maintained a healthy 8-hour sleep schedule for 5 days straight.</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
