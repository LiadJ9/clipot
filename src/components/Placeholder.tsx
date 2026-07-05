type Props = { message: string; actionLabel?: string; onAction?: () => void }

export default function Placeholder({ message, actionLabel, onAction }: Props) {
  return (
    <div className="canvas-wrap placeholder-view" data-testid="canvas">
      <div className="placeholder-box">
        <p>{message}</p>
        {actionLabel && onAction && <button className="placeholder-action" onClick={onAction}>{actionLabel}</button>}
      </div>
    </div>
  )
}
