'use client';

import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import styles from './history.module.css';

interface HistoryItem {
  id: string;
  module: string;
  date: string;
  meta?: string;
  summary?: string;
}

export default function HistoryPage() {
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showEmptyList, setShowEmptyList] = useState(true);
  const [showEmptyDetail, setShowEmptyDetail] = useState(true);

  useEffect(() => {
    logTerminal('> History page mounted.');
  }, []);

  function logTerminal(msg: string) {
    console.log('[history]', msg);
  }

  function handleSelectHistory(id: string) {
    setSelectedId(id);
    setIsLoadingDetail(true);
    setShowEmptyDetail(false);
    // history.js drives detail population via DOM
  }

  return (
    <div className={styles.appShell}>
      {/* Background */}
      <div className={styles.backgroundEffects}>
        <div className={`${styles.glow} ${styles.glow1}`} />
        <div className={`${styles.glow} ${styles.glow2}`} />
        <div className={`${styles.glow} ${styles.glow3}`} />
      </div>

      <Sidebar />

      <div className={styles.historyPage}>
        {/* Left: History List Sidebar */}
        <aside className={styles.historySidebar}>
          <div className={styles.sidebarTop} />

          <div className={styles.sidebarListCard}>
            <div className={styles.listHeader}>
              <div
                id="historyLoading"
                className={styles.loadingChip}
                style={{ display: isLoadingList ? 'inline-flex' : 'none' }}
              >
                <i className="fa-solid fa-spinner fa-spin" />
                <span data-i18n="hist_loading">불러오는 중...</span>
              </div>
            </div>

            <div
              id="historyEmpty"
              className={styles.emptyState}
              data-i18n="hist_email_prompt"
              style={{ display: showEmptyList ? 'block' : 'none' }}
            >
              이메일(subject_no)을 입력해 주세요.
            </div>

            <div id="historyList" className={styles.historyList}>
              {historyItems.map((item) => (
                <button
                  key={item.id}
                  className={`${styles.historyItem} ${selectedId === item.id ? styles.active : ''}`}
                  onClick={() => handleSelectHistory(item.id)}
                >
                  <div className={styles.historyItemTop}>
                    <span className={styles.historyItemModule}>{item.module}</span>
                    <span className={styles.historyItemDate}>{item.date}</span>
                  </div>
                  {item.meta && (
                    <div className={styles.historyItemMeta}>{item.meta}</div>
                  )}
                  {item.summary && (
                    <div className={styles.historyItemSummary}>{item.summary}</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Right: History Detail */}
        <main className={styles.historyMain}>
          <div
            id="historyDetailLoading"
            className={styles.loadingChip}
            style={{ display: isLoadingDetail ? 'inline-flex' : 'none', marginBottom: '20px' }}
          >
            <i className="fa-solid fa-spinner fa-spin" />
            <span data-i18n="hist_detail_loading">상세 조회 중...</span>
          </div>

          <div
            id="historyDetailEmpty"
            className={styles.detailEmptyState}
            data-i18n="hist_select_prompt"
            style={{ display: showEmptyDetail ? 'flex' : 'none' }}
          >
            이력 항목을 선택해 주세요.
          </div>

          <div id="historyDetail" className={styles.historyDetail} />
        </main>
      </div>
    </div>
  );
}
