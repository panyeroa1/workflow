/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useUI } from '@/lib/state';
import cn from 'classnames';

export default function Header() {
  const { toggleSidebar, theme, toggleTheme } = useUI();

  return (
    <header>
      <div className="header-left">
        <h1 className="header-logo-text">
          Zoomie
          <span className="accent-dot">.</span>
        </h1>
      </div>
      <div className="header-right">
        <button 
          className="theme-button" 
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          <span 
            className="icon header-icon theme-toggle-icon"
          >
            {theme === 'dark' ? 'light_mode' : 'dark_mode'}
          </span>
        </button>
        <button
          className="settings-button"
          onClick={toggleSidebar}
          aria-label="Settings"
          title="Settings & Configuration"
        >
          <span className="icon header-icon settings-icon">settings</span>
        </button>
      </div>
    </header>
  );
}