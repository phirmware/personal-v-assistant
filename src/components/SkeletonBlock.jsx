export default function SkeletonBlock({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-2.5 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton-pulse"
          style={{
            height: '0.875rem',
            width: i === lines - 1 ? '60%' : i % 2 === 0 ? '100%' : '85%',
          }}
        />
      ))}
    </div>
  )
}
