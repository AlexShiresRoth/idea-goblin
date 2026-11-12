import { ChartNetwork, Crosshair, LayoutDashboard, Plus, Trash2, Upload } from "lucide-react";
import { FocusBadge, ThemePill } from "../main/bucket-badges";
import { bucketStyleVars } from "./bucket-icon";
import styles from "../page.module.css";

const buckets = [
  { name: "A calmer reading list", theme: "Software", category: "software", active: true, description: "A simple place to save articles and find the ones worth coming back to.", done: "1 of 4 done", updated: "2m" },
  { name: "The weekend project", theme: "Software", category: "software", active: false, description: "Small tools I could build in a weekend. Keep it useful, keep it finishable.", done: null, updated: "1h" },
  { name: "A tiny AI helper", theme: "AI", category: "ai", active: false, description: "Experiments for making the everyday admin a little easier.", done: "2 of 6 done", updated: "3h" },
];

// A static board example using the same category colors and badges as the app.
export default function MarketingPreview() {
  return (
    <figure className={styles.preview} aria-label="Idea Goblin board preview with example buckets">
      <div className={styles.boardHeader}>
        <div className={styles.boardLogo}><span>IG</span> Idea Goblin</div>
        <div className={styles.boardActions}><span><Plus /> New Idea</span><span><Upload /> Import</span><span><ChartNetwork /> Analyze Vault</span></div>
      </div>
      <div className={styles.boardLayout}>
        <div className={styles.boardSidebar} aria-hidden="true">
          <span className={styles.boardSelected}><LayoutDashboard /> Board</span>
          <span><ChartNetwork /> Analysis</span>
          <span><Trash2 /> Trash</span>
        </div>
        <div className={styles.boardMain}>
          <div className={styles.boardFocus}><Crosshair /><span>Working on</span><span className={styles.boardFocusName}>A calmer reading list</span><span className={styles.boardChange}>Change</span></div>
          <div className={styles.boardSort}><span>Sort by</span><span>Actively working on</span><span className={styles.boardSortSelected}>Recently updated</span></div>
          <div className={styles.boardBuckets}>
            {buckets.map((bucket) => (
              <div key={bucket.name} style={bucketStyleVars(bucket.category)} className={`${styles.boardBucket} ${bucket.active ? "" : styles.boardParked}`}>
                <div className={styles.boardBadges}><div><ThemePill bucket={bucket} /><FocusBadge active={bucket.active} /></div><span>{bucket.updated}</span></div>
                <h3>{bucket.name}</h3>
                <p>{bucket.description}</p>
                {bucket.done && <p className={styles.boardDone}>{bucket.done}</p>}
              </div>
            ))}
          </div>
          <span className={styles.boardAdd} aria-hidden="true"><Plus /></span>
        </div>
      </div>
      <figcaption className={styles.previewCaption}>Your board, with example ideas. A little less chaos.</figcaption>
    </figure>
  );
}
