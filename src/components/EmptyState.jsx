export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}) {
  return (
    <div className="empty-state">
      {Icon && (
        <div className="empty-state-icon">
          <Icon size={20} strokeWidth={2.2} />
        </div>
      )}
      <p className="empty-state-title">{title}</p>
      {description && <p className="empty-state-description">{description}</p>}
      {actionLabel && onAction && (
        <button onClick={onAction} className="empty-state-action">
          {actionLabel}
        </button>
      )}
    </div>
  )
}
