'use client';

import { useState } from 'react';
import Sidebar from './components/Sidebar';
import styles from './dashboard.module.css';

export default function DashboardPage() {
  const [userName] = useState('Alex');
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className={styles.appShell}>
      {/* Background effects */}
      <div className={styles.backgroundEffects}>
        <div className={`${styles.glow} ${styles.glow1}`} />
        <div className={`${styles.glow} ${styles.glow2}`} />
        <div className={`${styles.glow} ${styles.glow3}`} />
      </div>

      <Sidebar />

      {/* Main content */}
      <main className={styles.main}>
        {/* Header */}
        <header className={styles.topHeader}>
          <div className={styles.greeting}>
            <h1>
              <span data-i18n="dash_welcome">Welcome back,</span>{' '}
              <span id="greeting-user-name">{userName}</span>
            </h1>
            <p data-i18n="dash_subtitle">Here&apos;s your BodumCare health overview for today.</p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.iconBtn} aria-label="Notifications">
              <i className="fa-regular fa-bell" />
              <span className={styles.badge}>3</span>
            </button>
            <div className={styles.dateDisplay}>
              <i className="fa-regular fa-calendar" />
              <span id="currentDate">{today}</span>
            </div>
          </div>
        </header>

        {/* Dashboard grid */}
        <div className={styles.dashboardGrid}>
          {/* Status Card 1: BMI */}
          <div className={`${styles.gridCard} ${styles.statusCard} ${styles.obesity}`}>
            <div className={styles.cardIcon}>
              <i className="fa-solid fa-scale-balanced" />
            </div>
            <div className={styles.cardContent}>
              <h3 data-i18n="dash_bmi">BMI Level</h3>
              <div className={styles.metricValue}>
                22.4 <span className={styles.unit} data-i18n="status_normal">Normal</span>
              </div>
              <div className={`${styles.trend} ${styles.positive}`}>
                <i className="fa-solid fa-arrow-down" /> 0.2 from last month
              </div>
            </div>
            <div className={styles.miniChartContainer}>
              <div className={`${styles.progressRing} ${styles.ringCyan}`}>
                <span data-i18n="status_optimal">Optimal</span>
              </div>
            </div>
          </div>

          {/* Status Card 2: Activity */}
          <div className={`${styles.gridCard} ${styles.statusCard} ${styles.activity}`}>
            <div className={styles.cardIcon}>
              <i className="fa-solid fa-bolt" />
            </div>
            <div className={styles.cardContent}>
              <h3 data-i18n="dash_activity">Activity Score</h3>
              <div className={styles.metricValue}>
                84 <span className={styles.unit}>/ 100</span>
              </div>
              <div className={`${styles.trend} ${styles.positive}`}>
                <i className="fa-solid fa-arrow-up" /> 12% vs last week
              </div>
            </div>
            <div className={styles.miniChartContainer}>
              <div className={`${styles.progressRing} ${styles.ringBlue}`}>
                <span data-i18n="status_high">High</span>
              </div>
            </div>
          </div>

          {/* Status Card 3: Health Score */}
          <div className={`${styles.gridCard} ${styles.statusCard} ${styles.overallHealth}`}>
            <div className={styles.cardIcon}>
              <i className="fa-solid fa-shield-heart" />
            </div>
            <div className={styles.cardContent}>
              <h3 data-i18n="dash_health_score">Health Score</h3>
              <div className={styles.metricValue}>
                92 <span className={styles.unit}>/ 100</span>
              </div>
              <div className={`${styles.trend} ${styles.stable}`}>
                <i className="fa-solid fa-minus" /> <span data-i18n="status_stable">Stable</span>
              </div>
            </div>
            <div className={styles.healthCore}>
              <div className={styles.coreInner} />
            </div>
          </div>

          {/* Main Chart + Recent Measurements */}
          <div className={`${styles.gridCard} ${styles.recentActivityContainer}`}>
            <div className={styles.activitySplitView}>
              {/* Chart section */}
              <div className={styles.trendChartSection}>
                <div className={styles.cardHeader}>
                  <h2 data-i18n="dash_trends">Health Trends</h2>
                  <div className={styles.chartFilters}>
                    <button className={`${styles.filterBtn} ${styles.active}`} data-i18n="dash_week">Week</button>
                    <button className={styles.filterBtn} data-i18n="dash_month">Month</button>
                    <button className={styles.filterBtn} data-i18n="dash_year">Year</button>
                  </div>
                </div>
                <div className={styles.chartWrapper}>
                  {/* Chart placeholder */}
                  <div className={styles.chartPlaceholder}>
                    <i className="fa-solid fa-chart-line" style={{ fontSize: '3rem', opacity: 0.2 }} />
                    <p>Health chart loading...</p>
                  </div>
                </div>
              </div>

              {/* Recent measurements */}
              <div className={styles.recentListSection}>
                <div className={styles.cardHeader}>
                  <h2 data-i18n="dash_recent">Recent Measurements</h2>
                  <a href="/history" className={styles.viewAllLink}>
                    <span data-i18n="dash_view_all">View All</span>
                    <i className="fa-solid fa-chevron-right" />
                  </a>
                </div>
                <div id="recentMeasurementsList" className={styles.measurementsListSlim}>
                  <div className={styles.measureLoadingShimmer}>
                    <div className={styles.shimmerItem} />
                    <div className={styles.shimmerItem} />
                    <div className={styles.shimmerItem} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          <div className={`${styles.gridCard} ${styles.recommendationsContainer}`}>
            <div className={styles.cardHeader}>
              <h2 data-i18n="dash_recs">Smart Recommendations</h2>
              <button className={`${styles.iconBtn} ${styles.small}`}>
                <i className="fa-solid fa-ellipsis" />
              </button>
            </div>
            <div className={styles.recommendationsList}>
              <div className={`${styles.recommendationItem} ${styles.alert}`}>
                <div className={styles.recIcon}><i className="fa-solid fa-droplet" /></div>
                <div className={styles.recText}>
                  <h4 data-i18n="rec_hydrate_title">Hydration Alert</h4>
                  <p data-i18n="rec_hydrate_desc">You are 30% below your daily water intake goal.</p>
                </div>
              </div>
              <div className={`${styles.recommendationItem} ${styles.success}`}>
                <div className={styles.recIcon}><i className="fa-solid fa-bed" /></div>
                <div className={styles.recText}>
                  <h4 data-i18n="rec_sleep_title">Sleep Quality Optimal</h4>
                  <p data-i18n="rec_sleep_desc">Excellent REM cycles detected via RealSense overnight.</p>
                </div>
              </div>
              <div className={`${styles.recommendationItem} ${styles.warning}`}>
                <div className={styles.recIcon}><i className="fa-solid fa-person-walking" /></div>
                <div className={styles.recText}>
                  <h4 data-i18n="rec_sedentary_title">Sedentary Warning</h4>
                  <p data-i18n="rec_sedentary_desc">You&apos;ve been inactive for 2 hours. Time for a quick walk.</p>
                </div>
              </div>
            </div>
            <button className={styles.viewAllBtn}>
              <span data-i18n="dash_insight_btn">View All Insights</span>
              <i className="fa-solid fa-arrow-right" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
