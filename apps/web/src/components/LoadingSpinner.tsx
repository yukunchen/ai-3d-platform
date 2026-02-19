'use client';

import React from 'react';
import styles from './LoadingSpinner.module.css';

interface LoadingSpinnerProps {
  status?: string;
  progress?: number;
}

export default function LoadingSpinner({ status, progress }: LoadingSpinnerProps) {
  return (
    <div className={styles.container}>
      <div className={styles.spinnerWrapper}>
        <div className={styles.spinner}>
          <div className={styles.spinnerInner}></div>
        </div>
        <div className={styles.particles}>
          <span className={styles.particle}></span>
          <span className={styles.particle}></span>
          <span className={styles.particle}></span>
          <span className={styles.particle}></span>
          <span className={styles.particle}></span>
        </div>
      </div>

      <div className={styles.textContainer}>
        <p className={styles.statusText}>
          {status || 'Processing your request...'}
        </p>
        {progress !== undefined && (
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        )}
        <p className={styles.hintText}>
          This may take a few moments...
        </p>
      </div>
    </div>
  );
}
