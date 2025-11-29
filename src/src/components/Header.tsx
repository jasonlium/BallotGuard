import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/Header.css';

export function Header() {
  return (
    <header className="header">
      <div className="header-container">
        <div className="header-content">
          <div className="header-left">
            <h1 className="header-title">
              BallotGuard
            </h1>
            <span className="header-badge">Encrypted polls on Sepolia</span>
          </div>
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
