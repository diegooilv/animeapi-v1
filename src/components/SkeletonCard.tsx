import styles from './SkeletonCard.module.css';

export default function SkeletonCard() {
    return (
        <div className={styles.card}>
            <div className={styles.media} />
            <div className={styles.body}>
                <div className={styles.line} style={{ width: '75%' }} />
                <div className={styles.line} />
                <div className={styles.line} style={{ width: '60%' }} />
                <div className={styles.line} style={{ width: '40%' }} />
            </div>
        </div>
    );
}