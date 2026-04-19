import '@/components/apple-sign-in-button.css'

type Props = { label: string; onClick: () => void; disabled?: boolean }

export function AppleSignInButton({ label, onClick, disabled }: Props) {
  return (
    <button className="apple-sign-in-button" onClick={onClick} disabled={disabled}>
      <div className="apple-sign-in-button-state" />
      <div className="apple-sign-in-button-content-wrapper">
        <div className="apple-sign-in-button-icon">
          {/* Apple logo — official SVG from Apple brand guidelines */}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 814 1000" fill="#ffffff" style={{ display: 'block', width: 17, height: 20 }}>
            <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.7 0 663 0 541.8c0-207.5 135.4-317.3 269-317.3 70.1 0 128.4 46.4 172.5 46.4 42.8 0 109.6-49 192.5-49 30.8 0 134.2 2.6 198.4 99zM549.8 148.2c23.8-28.2 40.8-67.5 40.8-106.8 0-5.5-.6-11.1-1.3-16.6-38.9 1.5-85.5 26-113.7 57.8-22.5 25.4-43.2 64.7-43.2 104.6 0 6.1.6 12.2 1.3 14.2 2.6.6 6.5 1.3 10.4 1.3 35.4 0 79.8-23.2 105.7-54.5z" />
          </svg>
        </div>
        <span className="apple-sign-in-button-contents">{label}</span>
        <span style={{ display: 'none' }}>{label}</span>
      </div>
    </button>
  )
}
