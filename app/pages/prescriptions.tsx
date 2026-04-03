import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import dashboardStyles from './dashboard.module.css';
import presStyles from './prescriptions.module.css';

export default function PrescriptionsPage() {
  const [filter, setFilter] = useState('all');
  const [addedIds, setAddedIds] = useState<number[]>([]);

  const handleAdd = (id: number) => {
    if (!addedIds.includes(id)) {
      setAddedIds(prev => [...prev, id]);
    }
  };

  const cards = [
    {
      id: 1,
      category: 'diet',
      type: 'Diet',
      typeIcon: 'fa-apple-whole',
      typeClass: presStyles.rxTypeDiet,
      title: 'High-Protein Breakfast',
      confidence: '98%',
      body: 'Based on your caloric deficit and recent strength training metrics, we recommend increasing morning protein intake by 15g.',
      features: ['Muscle Recovery', 'Energy'],
      footer: (
        <div className={presStyles.rxFooter}>
          <button className={`${presStyles.actionBtn} ${presStyles.actionBtnSecondary}`}>
            <i className="fa-solid fa-book-open"></i> <span data-i18n="pr_view_recipe">View Recipe</span>
          </button>
          <button 
            className={`${presStyles.actionBtn} ${presStyles.actionBtnPrimary} ${addedIds.includes(1) ? presStyles.actionBtnPrimaryAdded : ''}`}
            onClick={() => handleAdd(1)}
          >
            {addedIds.includes(1) ? <><i className="fa-solid fa-check"></i> <span>Added to Plan</span></> : <><i className="fa-solid fa-plus"></i> <span data-i18n="pr_add_plan">Add to Plan</span></>}
          </button>
        </div>
      )
    },
    {
      id: 2,
      category: 'exercise',
      type: 'Exercise',
      typeIcon: 'fa-dumbbell',
      typeClass: presStyles.rxTypeExercise,
      title: 'Posture Correction Routine',
      confidence: '95%',
      body: 'Your RealSense scan detected a 5° anterior spinal curvature. This 10-minute daily routine targets upper back mobility.',
      features: ['10 Mins/Day', 'Zero Eqpt'],
      footer: (
        <div className={presStyles.rxFooter}>
          <button className={`${presStyles.actionBtn} ${presStyles.actionBtnSecondary}`}>
            <i className="fa-solid fa-play"></i> <span data-i18n="pr_watch_video">Watch Video</span>
          </button>
          <button 
            className={`${presStyles.actionBtn} ${presStyles.actionBtnPrimary} ${addedIds.includes(2) ? presStyles.actionBtnPrimaryAdded : ''}`}
            onClick={() => handleAdd(2)}
          >
            {addedIds.includes(2) ? <><i className="fa-solid fa-check"></i> <span>Added to Plan</span></> : <><i className="fa-solid fa-plus"></i> <span data-i18n="pr_add_plan">Add to Plan</span></>}
          </button>
        </div>
      )
    },
    {
      id: 3,
      category: 'supplements',
      type: 'Supplement',
      highlight: true,
      typeIcon: 'fa-capsules',
      typeClass: presStyles.rxTypeSupplements,
      title: 'Premium Omega-3 Fish Oil',
      confidence: '92%',
      body: 'Suggested to help lower inflammation markers derived from your recent high-intensity cardio frequency.',
      features: ['Joint Health', 'Inflammation'],
      footer: (
        <div className={presStyles.rxFooter}>
          <button className={`${presStyles.actionBtn} ${presStyles.actionBtnPrimary}`}>
            <span data-i18n="pr_buy_now">Buy Now</span> - $29
          </button>
        </div>
      )
    },
    {
      id: 4,
      category: 'habits',
      type: 'Habit',
      typeIcon: 'fa-moon',
      typeClass: presStyles.rxTypeHabits,
      title: 'Screen-time Curfew',
      confidence: '88%',
      body: 'Poor REM sleep cycles indicate blue light interference. We prescribe turning off displays 1 hour before target bedtime.',
      features: ['Sleep Quality', 'Recovery'],
      footer: (
        <div className={presStyles.rxFooter}>
          <button 
            className={`${presStyles.actionBtn} ${presStyles.actionBtnPrimary} ${addedIds.includes(4) ? presStyles.actionBtnPrimaryAdded : ''}`}
            onClick={() => handleAdd(4)}
          >
            {addedIds.includes(4) ? <><i className="fa-solid fa-check"></i> <span>Added to Plan</span></> : <><i className="fa-solid fa-plus"></i> <span data-i18n="pr_set_remind">Set Reminder</span></>}
          </button>
        </div>
      )
    },
    {
      id: 5,
      category: 'diet',
      type: 'Diet',
      typeIcon: 'fa-bowl-food',
      typeClass: presStyles.rxTypeDiet,
      title: 'Macro-Balanced Meal Prep',
      confidence: '85%',
      body: 'Convenience foods tailored to your exact metabolic rate. Pre-portioned lunches to help maintain your target weight.',
      features: ['Time Saver', 'Weight Mgmt'],
      footer: (
        <div className={presStyles.rxFooter}>
          <button className={`${presStyles.actionBtn} ${presStyles.actionBtnSecondary}`} data-i18n="pr_view_menu">
            View Menu
          </button>
          <button className={`${presStyles.actionBtn} ${presStyles.actionBtnPrimary}`} data-i18n="pr_sub">
            Subscribe
          </button>
        </div>
      )
    }
  ];

  const filteredCards = filter === 'all' ? cards : cards.filter(c => c.category === filter);

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
            <h1 data-i18n="pr_title">Recommended Prescriptions</h1>
            <p data-i18n="pr_subtitle">Personalized routines and products based on your RealSense data.</p>
          </div>

          <button className={`${presStyles.actionBtnPrimary} ${presStyles.primaryBtnSlim}`} style={{ width: 'auto', padding: '10px 20px', borderRadius: '8px', border: 'none', color: 'white', background: 'linear-gradient(135deg, var(--intel-blue), var(--intel-dark-blue))', cursor: 'pointer', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <i className="fa-solid fa-arrows-rotate"></i>
            <span data-i18n="pr_refresh">Refresh Suggestions</span>
          </button>
        </header>

        {/* Dynamic Category Filters */}
        <div className={presStyles.filterTabs}>
          <button onClick={() => setFilter('all')} className={`${presStyles.filterTab} ${filter === 'all' ? presStyles.filterTabActive : ''}`} data-i18n="pr_filter_all">All Specs</button>
          <button onClick={() => setFilter('diet')} className={`${presStyles.filterTab} ${filter === 'diet' ? presStyles.filterTabActive : ''}`} data-i18n="pr_filter_diet">Diet & Nutrition</button>
          <button onClick={() => setFilter('exercise')} className={`${presStyles.filterTab} ${filter === 'exercise' ? presStyles.filterTabActive : ''}`} data-i18n="pr_filter_exc">Exercise Routines</button>
          <button onClick={() => setFilter('supplements')} className={`${presStyles.filterTab} ${filter === 'supplements' ? presStyles.filterTabActive : ''}`} data-i18n="pr_filter_supp">Supplements</button>
          <button onClick={() => setFilter('habits')} className={`${presStyles.filterTab} ${filter === 'habits' ? presStyles.filterTabActive : ''}`} data-i18n="pr_filter_habit">Daily Habits</button>
        </div>

        {/* Prescription Grid */}
        <div className={presStyles.prescriptionGrid}>
          {filteredCards.map(card => (
            <div key={card.id} className={`${presStyles.rxCard} ${card.highlight ? presStyles.rxCardHighlight : ''}`}>
              {card.highlight && <div className={presStyles.highlightBanner}>Top Recommendation</div>}
              <div className={`${presStyles.rxType} ${card.typeClass}`}>
                <i className={`fa-solid ${card.typeIcon}`}></i> <span data-i18n={`pr_filter_${card.category}`}>{card.type}</span>
              </div>
              <div className={presStyles.rxHeader}>
                <h3>{card.title}</h3>
                <span className={presStyles.rxConfidence}>{card.confidence} <span data-i18n="pr_match">Match</span></span>
              </div>
              <div className={presStyles.rxBody}>
                <p>{card.body}</p>
                <div className={presStyles.rxFeatures}>
                  {card.features.map((feat, idx) => (
                    <span key={idx} className={presStyles.tag}>{feat}</span>
                  ))}
                </div>
              </div>
              {card.footer}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
